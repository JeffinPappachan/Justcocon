export type MessageDirection = "incoming" | "outgoing";
export type MessageType = "text" | "template" | "system";

export type EnvironmentName = "development" | "staging" | "production";

export interface MessageResult {
  ok: boolean;
  messageId?: string;
  provider: string;
  timestamp: string;
  error?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  provider: string;
  status: "disconnected" | "connecting" | "connected" | "error";
  details?: string;
}

export interface WhatsAppProvider {
  sendTextMessage(recipient: string, message: string): Promise<MessageResult>;
  getConnectionStatus(): Promise<ConnectionStatus>;
}
