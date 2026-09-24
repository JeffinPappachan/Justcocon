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

/** Mock Baileys transport for tests and WHATSAPP_ENABLE_LIVE=false. */
export class MockFirstBaileysAdapter implements BaileysAdapter {
  private readonly mock = new MockWhatsAppTransport();

  constructor(_config: AppConfig) {}

  get mockTransport(): MockWhatsAppTransport {
    return this.mock;
  }

  async start(
    onInbound: (message: InboundWhatsAppMessage) => Promise<void>,
  ): Promise<void> {
    await this.mock.start(onInbound);
  }

  async stop(): Promise<void> {
    await this.mock.stop();
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    const status = await this.mock.getConnectionStatus();
    return { ...status, provider: "baileys-mock" };
  }

  async sendOutbound(
    recipient: string,
    message: Parameters<MockWhatsAppTransport["sendOutbound"]>[1],
  ): Promise<MessageResult> {
    const result = await this.mock.sendOutbound(recipient, message);
    return { ...result, provider: "baileys-mock" };
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
