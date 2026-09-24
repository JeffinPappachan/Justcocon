import type { ConnectionStatus, MessageResult } from "../types.js";
import type { WhatsAppOutboundMessage } from "./outbound-types.js";
import type { InboundWhatsAppMessage, WhatsAppTransport } from "./transport-types.js";

export class MockWhatsAppTransport implements WhatsAppTransport {
  private inboundHandler:
    | ((message: InboundWhatsAppMessage) => Promise<void>)
    | null = null;
  private outboundCounter = 0;
  /** When true, sendTextMessage returns ok: false (for tests). */
  failNextSend = false;
  started = false;

  async start(
    onInbound: (message: InboundWhatsAppMessage) => Promise<void>,
  ): Promise<void> {
    this.inboundHandler = onInbound;
    this.started = true;
  }

  async stop(): Promise<void> {
    this.inboundHandler = null;
    this.started = false;
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    return {
      connected: this.started,
      provider: "mock",
      status: this.started ? "connected" : "disconnected",
    };
  }

  async sendOutbound(
    recipient: string,
    message: WhatsAppOutboundMessage,
  ): Promise<MessageResult> {
    if (message.kind === "list") {
      return this.sendTextMessage(
        recipient,
        `[list:${message.buttonText}] ${message.title}`,
      );
    }
    if (message.kind === "buttons" || message.kind === "native_flow") {
      const labels = message.buttons.map((b) => b.displayText).join(" | ");
      return this.sendTextMessage(
        recipient,
        `[buttons] ${message.body}\n(${labels})`,
      );
    }
    return this.sendTextMessage(recipient, message.body);
  }

  async sendTextMessage(
    recipient: string,
    message: string,
  ): Promise<MessageResult> {
    if (this.failNextSend) {
      this.failNextSend = false;
      return {
        ok: false,
        provider: "mock",
        timestamp: new Date().toISOString(),
        error: "mock send failure",
      };
    }
    void recipient;
    void message;
    return {
      ok: true,
      provider: "mock",
      timestamp: new Date().toISOString(),
      messageId: `mock-out-${++this.outboundCounter}`,
    };
  }

  async injectInbound(message: InboundWhatsAppMessage): Promise<void> {
    if (!this.inboundHandler) {
      throw new Error("MockWhatsAppTransport is not started");
    }
    await this.inboundHandler(message);
  }
}
