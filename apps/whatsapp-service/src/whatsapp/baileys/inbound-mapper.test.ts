import assert from "node:assert/strict";
import test from "node:test";
import { mapBaileysMessageToInbound } from "./inbound-mapper.js";

test("inbound-mapper: conversation text", () => {
  const mapped = mapBaileysMessageToInbound({
    key: { id: "BAILEYS-1", fromMe: false, remoteJid: "919990002001@s.whatsapp.net" },
    message: { conversation: "BOOK" },
    messageTimestamp: 1_700_000_000,
  });
  assert.ok(mapped);
  assert.equal(mapped?.kind, "text");
  assert.equal(mapped?.text, "BOOK");
  assert.equal(mapped?.providerMessageId, "BAILEYS-1");
});

test("inbound-mapper: extended text and fromMe ignored upstream", () => {
  const mapped = mapBaileysMessageToInbound({
    key: { id: "BAILEYS-2", fromMe: true, remoteJid: "919990002001@s.whatsapp.net" },
    message: { extendedTextMessage: { text: "hello" } },
    messageTimestamp: 1_700_000_001,
  });
  assert.ok(mapped);
  assert.equal(mapped?.fromMe, true);
});

test("inbound-mapper: missing text is unsupported kind", () => {
  const mapped = mapBaileysMessageToInbound({
    key: { id: "BAILEYS-3", remoteJid: "919990002001@s.whatsapp.net" },
    message: {},
    messageTimestamp: 1_700_000_002,
  });
  assert.ok(mapped);
  assert.equal(mapped?.kind, "unsupported");
});
