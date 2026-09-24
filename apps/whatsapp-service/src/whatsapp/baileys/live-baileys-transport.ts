import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  generateMessageIDV2,
  jidNormalizedUser,
  proto,
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
import { isDirectUserChatJid } from "./chat-jid.js";
import { mapBaileysMessageToInbound } from "./inbound-mapper.js";
import { isRealMessage } from "@whiskeysockets/baileys";
import { resolveWhatsAppOutboundJid } from "./phone-jid.js";
import type { WhatsAppOutboundMessage } from "../outbound-types.js";
import { nativeFlowRelayAdditionalNodes } from "./native-flow-relay-nodes.js";

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

  constructor(
    private readonly config: AppConfig,
    private readonly logger: ServiceLogger,
  ) {}

  async start(
    onInbound: (message: InboundWhatsAppMessage) => Promise<void>,
  ): Promise<void> {
    this.inboundHandler = onInbound;
    this.stopping = false;
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

  async sendOutbound(
    recipient: string,
    message: WhatsAppOutboundMessage,
  ): Promise<MessageResult> {
    if (message.kind === "text") {
      return this.sendTextMessage(recipient, message.body);
    }
    if (message.kind === "native_flow") {
      return this.sendNativeFlowMessage(recipient, message);
    }
    if (message.kind === "buttons") {
      return this.sendButtonsMessage(recipient, message);
    }
    return this.sendListMessage(recipient, message);
  }

  private async sendNativeFlowMessage(
    recipient: string,
    message: Extract<WhatsAppOutboundMessage, { kind: "native_flow" }>,
  ): Promise<MessageResult> {
    const sock = this.socket;
    if (!sock || !this.connectionState.connected || !sock.user?.id) {
      return {
        ok: false,
        provider: "baileys",
        timestamp: new Date().toISOString(),
        error: "WhatsApp socket is not connected",
      };
    }

    const jid = resolveWhatsAppOutboundJid(recipient);
    const messageId = generateMessageIDV2(jidNormalizedUser(sock.user.id));
    const interactiveMessage: proto.Message.IInteractiveMessage = {
      body: { text: message.body },
      footer: message.footer ? { text: message.footer } : undefined,
      header: message.title
        ? { title: message.title, hasMediaAttachment: false }
        : undefined,
      nativeFlowMessage: {
        messageVersion: 1,
        buttons: message.buttons.map((button) => ({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: button.displayText,
            id: button.buttonId,
          }),
        })),
      },
    };

    try {
      const payload = proto.Message.fromObject({ interactiveMessage });
      await sock.relayMessage(jid, payload, {
        messageId,
        additionalNodes: nativeFlowRelayAdditionalNodes(jid) as Parameters<
          typeof sock.relayMessage
        >[2]["additionalNodes"],
      });
      return {
        ok: true,
        provider: "baileys",
        timestamp: new Date().toISOString(),
        messageId,
      };
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "native flow send failed";
      this.logger.error("Baileys native flow message send failed", { errMsg });
      return {
        ok: false,
        provider: "baileys",
        timestamp: new Date().toISOString(),
        error: errMsg,
      };
    }
  }

  private async sendButtonsMessage(
    recipient: string,
    message: Extract<WhatsAppOutboundMessage, { kind: "buttons" }>,
  ): Promise<MessageResult> {
    const sock = this.socket;
    if (!sock || !this.connectionState.connected || !sock.user?.id) {
      return {
        ok: false,
        provider: "baileys",
        timestamp: new Date().toISOString(),
        error: "WhatsApp socket is not connected",
      };
    }

    const jid = resolveWhatsAppOutboundJid(recipient);
    const messageId = generateMessageIDV2(jidNormalizedUser(sock.user.id));
    const buttonsMessage: proto.Message.IButtonsMessage = {
      contentText: message.body,
      footerText: message.footer ?? "JustCocon",
      headerType: proto.Message.ButtonsMessage.HeaderType.EMPTY,
      buttons: message.buttons.map((button) => ({
        buttonId: button.buttonId,
        buttonText: { displayText: button.displayText },
        type: proto.Message.ButtonsMessage.Button.Type.RESPONSE,
      })),
    };

    try {
      const payload = proto.Message.fromObject({ buttonsMessage });
      await sock.relayMessage(jid, payload, { messageId });
      return {
        ok: true,
        provider: "baileys",
        timestamp: new Date().toISOString(),
        messageId,
      };
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "buttons send failed";
      this.logger.error("Baileys buttons message send failed", { errMsg });
      return {
        ok: false,
        provider: "baileys",
        timestamp: new Date().toISOString(),
        error: errMsg,
      };
    }
  }

  private async sendListMessage(
    recipient: string,
    message: Extract<WhatsAppOutboundMessage, { kind: "list" }>,
  ): Promise<MessageResult> {
    const sock = this.socket;
    if (!sock || !this.connectionState.connected || !sock.user?.id) {
      return {
        ok: false,
        provider: "baileys",
        timestamp: new Date().toISOString(),
        error: "WhatsApp socket is not connected",
      };
    }

    const jid = resolveWhatsAppOutboundJid(recipient);
    const messageId = generateMessageIDV2(jidNormalizedUser(sock.user.id));
    const listMessage: proto.Message.IListMessage = {
      title: message.title,
      description: message.description,
      buttonText: message.buttonText,
      listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
      sections: [
        {
          title: message.title,
          rows: message.rows.map((row) => ({
            title: row.title,
            rowId: row.rowId,
            description: row.description ?? "",
          })),
        },
      ],
    };

    try {
      const payload = proto.Message.fromObject({ listMessage });
      await sock.relayMessage(jid, payload, {
        messageId,
        additionalNodes: nativeFlowRelayAdditionalNodes(jid) as Parameters<
          typeof sock.relayMessage
        >[2]["additionalNodes"],
      });
      return {
        ok: true,
        provider: "baileys",
        timestamp: new Date().toISOString(),
        messageId,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "list send failed";
      this.logger.error("Baileys list message send failed", { errMsg });
      return {
        ok: false,
        provider: "baileys",
        timestamp: new Date().toISOString(),
        error: errMsg,
      };
    }
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

    const jid = resolveWhatsAppOutboundJid(recipient);
    for (let attempt = 1; attempt <= 3; attempt++) {
      const active = this.socket;
      if (!active || !this.connectionState.connected) {
        await sleep(500);
        continue;
      }
      try {
        const sent = await active.sendMessage(jid, { text: message });
        const messageId = sent?.key?.id ?? undefined;
        return {
          ok: true,
          provider: "baileys",
          timestamp: new Date().toISOString(),
          messageId,
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "send failed";
        if (attempt === 3) {
          this.logger.error("Baileys outbound send failed", { errMsg, jidKind: jid.includes("@lid") ? "lid" : "standard" });
          return {
            ok: false,
            provider: "baileys",
            timestamp: new Date().toISOString(),
            error: errMsg,
          };
        }
        await sleep(400 * attempt);
      }
    }
    return {
      ok: false,
      provider: "baileys",
      timestamp: new Date().toISOString(),
      error: "WhatsApp socket is not connected",
    };
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
    while (!this.stopping) {
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

      if (this.stopping) {
        break;
      }

      this.logger.warn("Baileys reconnecting after disconnect");
      await sleep(3_000);
    }
  }

  private async clearAuthDirectory(authDir: string): Promise<void> {
    await rm(authDir, { recursive: true, force: true });
    await mkdir(authDir, { recursive: true });
  }

  private sessionNeedsFreshPairing(statusCode: number | undefined): boolean {
    return (
      statusCode === DisconnectReason.loggedOut ||
      statusCode === DisconnectReason.badSession
    );
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
          if (this.sessionNeedsFreshPairing(statusCode)) {
            this.logger.warn(
              "Baileys session invalid; clearing saved auth and preparing a new QR",
              { statusCode },
            );
            void this.clearAuthDirectory(authDir)
              .catch((error: unknown) => {
                const message =
                  error instanceof Error ? error.message : "clear auth failed";
                this.logger.error("Failed to clear Baileys auth directory", {
                  message,
                });
              })
              .finally(() => {
                this.connectionState = {
                  connected: false,
                  provider: "baileys",
                  status: "connecting",
                };
                sock.ev.off("connection.update", onConnectionUpdate);
                resolve();
              });
            return;
          }

          if (!this.stopping) {
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
      if (!isDirectUserChatJid(raw.key.remoteJid?.trim())) {
        continue;
      }
      if (!isRealMessage(raw as Parameters<typeof isRealMessage>[0])) {
        continue;
      }
      const mapped = mapBaileysMessageToInbound(raw);
      if (!mapped) {
        continue;
      }
      if (mapped.kind !== "text" || !mapped.text?.trim()) {
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
