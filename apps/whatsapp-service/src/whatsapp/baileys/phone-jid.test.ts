import assert from "node:assert/strict";
import test from "node:test";
import { e164ToWhatsAppUserJid, resolveWhatsAppOutboundJid } from "./phone-jid.js";

test("e164ToWhatsAppUserJid strips plus and suffixes s.whatsapp.net", () => {
  assert.equal(e164ToWhatsAppUserJid("+919876543210"), "919876543210@s.whatsapp.net");
});

test("resolveWhatsAppOutboundJid keeps remote JID including lid", () => {
  assert.equal(
    resolveWhatsAppOutboundJid("123456789@lid"),
    "123456789@lid",
  );
});
