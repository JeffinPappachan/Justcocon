import type { AppConfig } from "../../config.js";
import type { ConnectionStatus, MessageResult } from "../../types.js";
import { MockWhatsAppTransport } from "../mock-transport.js";
import type { InboundWhatsAppMessage, WhatsAppTransport } from "../transport-types.js";
import type { BaileysLikeInboundMessage } from "./baileys-types.js";
import { mapBaileysMessageToInbound } from "./inbound-mapper.js";

export interface BaileysAdapter extends WhatsAppTransport {
  /** Test hook: push a Baileys-shaped message through the mapper. */
  ingestBaileysMessage(raw: BaileysLikeInboundMessage): Promise<void>;
}

/**
 * Mock-first Baileys adapter. Live socket wiring is gated behind
 * WHATSAPP_ENABLE_LIVE and is not enabled until staging manual pairing.
 */
export class MockFirstBaileysAdapter implements BaileysAdapter {
  private readonly mock = new MockWhatsAppTransport();
  private readonly enableLive: boolean;

  constructor(config: AppConfig) {
    this.enableLive = config.whatsappEnableLive;
  }

  get mockTransport(): MockWhatsAppTransport {
    return this.mock;
  }

  async start(
    onInbound: (message: InboundWhatsAppMessage) => Promise<void>,
  ): Promise<void> {
    if (this.enableLive) {
      throw new Error(
        "Live Baileys is not enabled in this build. Keep WHATSAPP_ENABLE_LIVE=false until staging review.",
      );
    }
    await this.mock.start(onInbound);
  }

  async stop(): Promise<void> {
    await this.mock.stop();
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    if (this.enableLive) {
      return {
        connected: false,
        provider: "baileys",
        status: "error",
        details: "live mode not implemented",
      };
    }
    const status = await this.mock.getConnectionStatus();
    return { ...status, provider: "baileys-mock" };
  }

  async sendTextMessage(
    recipient: string,
    message: string,
  ): Promise<MessageResult> {
    const result = await this.mock.sendTextMessage(recipient, message);
    return { ...result, provider: "baileys-mock" };
  }

  async ingestBaileysMessage(raw: BaileysLikeInboundMessage): Promise<void> {
    const mapped = mapBaileysMessageToInbound(raw);
    if (!mapped) {
      return;
    }
    await this.mock.injectInbound(mapped);
  }
}
