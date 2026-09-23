import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  type WASocket,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import type { AppConfig } from "../../config.js";
import type { createLogger } from "../../logger.js";
import type { ConnectionStatus, MessageResult } from "../../types.js";
import type { InboundWhatsAppMessage, WhatsAppTransport } from "../transport-types.js";
import type { BaileysLikeInboundMessage } from "./baileys-types.js";
import { mapBaileysMessageToInbound } from "./inbound-mapper.js";
import { e164ToWhatsAppUserJid } from "./phone-jid.js";

type ServiceLogger = ReturnType<typeof createLogger>;

export class LiveBaileysTransport implements WhatsAppTransport {
  private socket: WASocket | null = null;
  private inboundHandler:
    | ((message: InboundWhatsAppMessage) => Promise<void>)
    | null = null;
  private connectionState: ConnectionStatus = {
    connected: false,
    provider: "baileys",
    status: "disconnected",
  };
  private stopping = false;
  private loggedOut = false;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: ServiceLogger,
  ) {}

  async start(
    onInbound: (message: InboundWhatsAppMessage) => Promise<void>,
  ): Promise<void> {
    this.inboundHandler = onInbound;
    this.stopping = false;
    this.loggedOut = false;
    void this.runConnectLoop();
    await this.waitUntilConnected();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.inboundHandler = null;
    const sock = this.socket;
    this.socket = null;
    if (sock) {
      try {
        sock.end(undefined);
      } catch {
        /* ignore */
      }
    }
    this.connectionState = {
      connected: false,
      provider: "baileys",
      status: "disconnected",
    };
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    return { ...this.connectionState };
  }

  async sendTextMessage(
    recipient: string,
    message: string,
  ): Promise<MessageResult> {
    const sock = this.socket;
    if (!sock || !this.connectionState.connected) {
      return {
        ok: false,
        provider: "baileys",
        timestamp: new Date().toISOString(),
        error: "WhatsApp socket is not connected",
      };
    }

    try {
      const jid = e164ToWhatsAppUserJid(recipient);
      const sent = await sock.sendMessage(jid, { text: message });
      const messageId = sent?.key?.id ?? undefined;
      return {
        ok: true,
        provider: "baileys",
        timestamp: new Date().toISOString(),
        messageId,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "send failed";
      this.logger.error("Baileys outbound send failed", { errMsg });
      return {
        ok: false,
        provider: "baileys",
        timestamp: new Date().toISOString(),
        error: errMsg,
      };
    }
  }

  private authDirectory(): string {
    const raw =
      this.config.whatsappAuthDirectory?.trim() || ".baileys-auth";
    return resolve(raw);
  }

  private async waitUntilConnected(): Promise<void> {
    const deadline = Date.now() + 600_000;
    while (Date.now() < deadline) {
      if (this.connectionState.status === "connected") {
        return;
      }
      if (this.loggedOut) {
        throw new Error(
          "WhatsApp session logged out. Clear WHATSAPP_AUTH_DIRECTORY and scan QR again.",
        );
      }
      if (this.connectionState.status === "error") {
        throw new Error(
          this.connectionState.details ?? "Baileys connection failed",
        );
      }
      await sleep(250);
    }
    this.logger.warn(
      "WhatsApp not connected yet; keep this process running and scan the latest QR in the terminal",
    );
  }

  private async runConnectLoop(): Promise<void> {
    while (!this.stopping && !this.loggedOut) {
      try {
        await this.openSessionUntilClose();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Baileys connect error";
        this.logger.error("Baileys session error", { message });
        this.connectionState = {
          connected: false,
          provider: "baileys",
          status: "error",
          details: message,
        };
      }

      if (this.stopping || this.loggedOut) {
        break;
      }

      this.logger.warn("Baileys reconnecting after disconnect");
      await sleep(3_000);
    }
  }

  private async openSessionUntilClose(): Promise<void> {
    const authDir = this.authDirectory();
    await mkdir(authDir, { recursive: true });

    this.connectionState = {
      connected: false,
      provider: "baileys",
      status: "connecting",
    };

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    this.socket = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", (event) => {
      void this.handleMessagesUpsert({
        type: event.type,
        messages: event.messages as BaileysLikeInboundMessage[],
      });
    });

    await new Promise<void>((resolve) => {
      const onConnectionUpdate = (update: {
        connection?: "close" | "open" | "connecting";
        lastDisconnect?: { error?: Error };
        qr?: string;
      }) => {
        if (update.qr) {
          this.logger.info(
            "Scan WhatsApp QR below to pair staging (QR is not written to logs)",
          );
          qrcode.generate(update.qr, { small: true });
        }

        if (update.connection === "open") {
          this.connectionState = {
            connected: true,
            provider: "baileys",
            status: "connected",
          };
          this.logger.info("Baileys WhatsApp connected", {
            appEnv: this.config.appEnv,
          });
        }

        if (update.connection === "close") {
          this.connectionState = {
            connected: false,
            provider: "baileys",
            status: "connecting",
          };

          const statusCode = new Boom(update.lastDisconnect?.error).output
            ?.statusCode;
          if (statusCode === DisconnectReason.loggedOut) {
            this.loggedOut = true;
            this.connectionState = {
              connected: false,
              provider: "baileys",
              status: "error",
              details: "logged out",
            };
            this.logger.warn(
              "Baileys logged out; clear auth directory and scan QR again",
            );
          } else if (!this.stopping) {
            this.logger.warn("Baileys connection closed", { statusCode });
          }

          sock.ev.off("connection.update", onConnectionUpdate);
          resolve();
        }
      };

      sock.ev.on("connection.update", onConnectionUpdate);
    });

    this.socket = null;
    try {
      sock.end(undefined);
    } catch {
      /* ignore */
    }
  }

  private async handleMessagesUpsert(event: {
    type: string;
    messages: BaileysLikeInboundMessage[];
  }): Promise<void> {
    if (event.type !== "notify") {
      return;
    }
    const handler = this.inboundHandler;
    if (!handler) {
      return;
    }

    for (const raw of event.messages) {
      const mapped = mapBaileysMessageToInbound(raw);
      if (!mapped) {
        continue;
      }
      try {
        await handler(mapped);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "inbound handler error";
        this.logger.error("Inbound handler failed for Baileys message", {
          message,
          providerMessageId: mapped.providerMessageId,
        });
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
