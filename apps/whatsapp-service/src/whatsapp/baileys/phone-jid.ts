/** Map E.164 (+919876543210) or digits to a WhatsApp user JID. */
export function e164ToWhatsAppUserJid(recipient: string): string {
  const digits = recipient.replace(/\D/g, "");
  if (!digits) {
    throw new Error("Recipient phone has no digits.");
  }
  return `${digits}@s.whatsapp.net`;
}

/** Prefer the inbound remote JID; fall back to E.164-derived user JID. */
export function resolveWhatsAppOutboundJid(recipient: string): string {
  const trimmed = recipient.trim();
  if (trimmed.includes("@")) {
    return trimmed;
  }
  return e164ToWhatsAppUserJid(trimmed);
}
