import {
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isJidStatusBroadcast,
} from "@whiskeysockets/baileys";

/** Direct 1:1 chats the booking bot may reply to (never groups or broadcasts). */
export function isDirectUserChatJid(jid: string | undefined): boolean {
  const trimmed = jid?.trim();
  if (!trimmed) {
    return false;
  }
  if (
    isJidGroup(trimmed) ||
    isJidBroadcast(trimmed) ||
    isJidNewsletter(trimmed) ||
    isJidStatusBroadcast(trimmed)
  ) {
    return false;
  }
  return (
    trimmed.endsWith("@s.whatsapp.net") ||
    trimmed.endsWith("@lid") ||
    trimmed.endsWith("@hosted") ||
    trimmed.endsWith("@hosted.lid") ||
    trimmed.endsWith("@c.us")
  );
}

export function jidLocalUserPart(jid: string): string {
  const at = jid.indexOf("@");
  return at === -1 ? jid : jid.slice(0, at);
}
