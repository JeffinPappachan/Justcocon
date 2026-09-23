import type { ConnectionStatus, MessageResult } from "../types.js";

export type InboundMessageKind = "text" | "unsupported";

export interface InboundWhatsAppMessage {
  providerMessageId: string;
  fromMe: boolean;
  kind: InboundMessageKind;
  text?: string;
  senderWhatsAppId: string;
  timestamp: string;
}

export interface WhatsAppTransport {
  start(
    onInbound: (message: InboundWhatsAppMessage) => Promise<void>,
  ): Promise<void>;
  stop(): Promise<void>;
  sendTextMessage(recipient: string, message: string): Promise<MessageResult>;
  getConnectionStatus(): Promise<ConnectionStatus>;
}
