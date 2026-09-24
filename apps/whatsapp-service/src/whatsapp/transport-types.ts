import type { ConnectionStatus, MessageResult } from "../types.js";
import type { WhatsAppOutboundMessage } from "./outbound-types.js";

export type InboundMessageKind = "text" | "unsupported";

export interface InboundWhatsAppMessage {
  providerMessageId: string;
  fromMe: boolean;
  kind: InboundMessageKind;
  text?: string;
  senderWhatsAppId: string;
  /** Baileys remote JID to use for replies (required for @lid addressing). */
  replyWhatsAppJid?: string;
  timestamp: string;
}

export interface WhatsAppTransport {
  start(
    onInbound: (message: InboundWhatsAppMessage) => Promise<void>,
  ): Promise<void>;
  stop(): Promise<void>;
  sendOutbound(
    recipient: string,
    message: WhatsAppOutboundMessage,
  ): Promise<MessageResult>;
  sendTextMessage(recipient: string, message: string): Promise<MessageResult>;
  getConnectionStatus(): Promise<ConnectionStatus>;
}
