import {
  extractMessageContent,
  normalizeMessageContent,
} from "@whiskeysockets/baileys";
import type { InboundWhatsAppMessage } from "../transport-types.js";
import type { BaileysLikeInboundMessage } from "./baileys-types.js";
import { isDirectUserChatJid, jidLocalUserPart } from "./chat-jid.js";

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

  const listRowId = message.listResponseMessage?.singleSelectReply?.selectedRowId;
  if (typeof listRowId === "string" && listRowId.trim()) {
    return listRowId.trim();
  }
  const listTitle =
    message.listResponseMessage?.singleSelectReply?.selectedTitle;
  if (typeof listTitle === "string" && listTitle.trim()) {
    return listTitle.trim();
  }
  const templateButtonId = message.templateButtonReplyMessage?.selectedId;
  if (typeof templateButtonId === "string" && templateButtonId.trim()) {
    return templateButtonId.trim();
  }
  const buttonId = message.buttonsResponseMessage?.selectedButtonId;
  if (typeof buttonId === "string" && buttonId.trim()) {
    return buttonId.trim();
  }
  const nativeFlowParams =
    message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
  if (typeof nativeFlowParams === "string" && nativeFlowParams.trim()) {
    try {
      const parsed = JSON.parse(nativeFlowParams) as { id?: string };
      if (typeof parsed.id === "string" && parsed.id.trim()) {
        return parsed.id.trim();
      }
    } catch {
      /* ignore malformed native flow payload */
    }
  }
  const buttonText = message.buttonsResponseMessage?.selectedDisplayText;
  if (typeof buttonText === "string" && buttonText.trim()) {
    return buttonText.trim();
  }

  try {
    const normalized = normalizeMessageContent(
      message as Parameters<typeof normalizeMessageContent>[0],
    );
    const inner = extractMessageContent(
      normalized as Parameters<typeof extractMessageContent>[0],
    );
    if (!inner) return null;
    if (typeof inner.conversation === "string" && inner.conversation.trim()) {
      return inner.conversation.trim();
    }
    const innerExtended = inner.extendedTextMessage?.text;
    if (typeof innerExtended === "string" && innerExtended.trim()) {
      return innerExtended.trim();
    }
  } catch {
    return null;
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
  const remoteJid = message.key.remoteJid?.trim() || "";
  if (isDirectUserChatJid(remoteJid)) {
    return jidLocalUserPart(remoteJid);
  }
  const participant = message.key.participant?.trim() || "";
  if (!participant) {
    return "";
  }
  return jidLocalUserPart(participant);
}

/** Private chat JID for outbound replies (never a group @g.us). */
export function baileysReplyJid(message: BaileysLikeInboundMessage): string {
  const remoteJid = message.key.remoteJid?.trim() || "";
  if (isDirectUserChatJid(remoteJid)) {
    return remoteJid;
  }
  return "";
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

  const remoteJid = raw.key.remoteJid?.trim();
  if (!isDirectUserChatJid(remoteJid)) {
    return null;
  }

  const text = extractBaileysText(raw.message);
  const replyWhatsAppJid = baileysReplyJid(raw);

  if (!text) {
    return {
      providerMessageId,
      fromMe: Boolean(raw.key.fromMe),
      kind: "unsupported",
      senderWhatsAppId: baileysSenderJid(raw),
      replyWhatsAppJid: replyWhatsAppJid || undefined,
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
    replyWhatsAppJid: replyWhatsAppJid || undefined,
    timestamp: baileysTimestampToIso(raw.messageTimestamp),
  };
}
