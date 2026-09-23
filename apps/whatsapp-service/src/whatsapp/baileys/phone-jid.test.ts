import assert from "node:assert/strict";
import test from "node:test";
import { e164ToWhatsAppUserJid } from "./phone-jid.js";

test("e164ToWhatsAppUserJid strips plus and suffixes s.whatsapp.net", () => {
  assert.equal(e164ToWhatsAppUserJid("+919876543210"), "919876543210@s.whatsapp.net");
});
