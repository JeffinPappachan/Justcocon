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

test("inbound-mapper: group messages are ignored", () => {
  const mapped = mapBaileysMessageToInbound({
    key: {
      id: "BAILEYS-GROUP-1",
      fromMe: false,
      remoteJid: "120363422012345678@g.us",
      participant: "919990002001@s.whatsapp.net",
    },
    message: { conversation: "Hi" },
    messageTimestamp: 1_700_000_003,
  });
  assert.equal(mapped, null);
});

test("inbound-mapper: direct chat reply JID is the user remoteJid", () => {
  const mapped = mapBaileysMessageToInbound({
    key: {
      id: "BAILEYS-DM-1",
      fromMe: false,
      remoteJid: "919990002001@s.whatsapp.net",
    },
    message: { conversation: "Hi" },
    messageTimestamp: 1_700_000_004,
  });
  assert.ok(mapped);
  assert.equal(mapped?.replyWhatsAppJid, "919990002001@s.whatsapp.net");
});
