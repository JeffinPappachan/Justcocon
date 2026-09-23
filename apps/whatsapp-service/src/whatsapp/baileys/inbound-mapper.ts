import type { InboundWhatsAppMessage } from "../transport-types.js";
import type { BaileysLikeInboundMessage } from "./baileys-types.js";

export function extractBaileysText(
  message: BaileysLikeInboundMessage["message"],
): string | null {
  if (!message) return null;
  if (typeof message.conversation === "string" && message.conversation.trim()) {
    return message.conversation.trim();
  }
  const extended = message.extendedTextMessage?.text;
  if (typeof extended === "string" && extended.trim()) {
    return extended.trim();
  }
  return null;
}

export function baileysTimestampToIso(
  messageTimestamp: BaileysLikeInboundMessage["messageTimestamp"],
): string {
  if (messageTimestamp == null) {
    return new Date().toISOString();
  }
  const seconds =
    typeof messageTimestamp === "number"
      ? messageTimestamp
      : messageTimestamp.toNumber?.() ?? Date.now() / 1000;
  const ms = seconds > 1_000_000_000_000 ? seconds : seconds * 1000;
  return new Date(ms).toISOString();
}

export function baileysSenderJid(message: BaileysLikeInboundMessage): string {
  const key = message.key;
  const raw = key.participant?.trim() || key.remoteJid?.trim() || "";
  const at = raw.indexOf("@");
  return at === -1 ? raw : raw.slice(0, at);
}

/**
 * Maps a Baileys messages.upsert text payload to the internal inbound shape.
 * Returns null for unsupported or invalid payloads.
 */
export function mapBaileysMessageToInbound(
  raw: BaileysLikeInboundMessage,
): InboundWhatsAppMessage | null {
  const providerMessageId = raw.key.id?.trim();
  if (!providerMessageId) {
    return null;
  }

  const text = extractBaileysText(raw.message);
  if (!text) {
    return {
      providerMessageId,
      fromMe: Boolean(raw.key.fromMe),
      kind: "unsupported",
      senderWhatsAppId: baileysSenderJid(raw),
      timestamp: baileysTimestampToIso(raw.messageTimestamp),
    };
  }

  const sender = baileysSenderJid(raw);
  if (!sender) {
    return null;
  }

  return {
    providerMessageId,
    fromMe: Boolean(raw.key.fromMe),
    kind: "text",
    text,
    senderWhatsAppId: sender,
    timestamp: baileysTimestampToIso(raw.messageTimestamp),
  };
}
