import assert from "node:assert/strict";
import test from "node:test";
import { createInitialContext } from "@justcocon/booking-domain";
import { serializeConversationContext } from "./conversation-context-codec.js";
import { createInMemoryPersistenceRepositories } from "./repositories/in-memory.js";

test("session repo: create, find active, update, deactivate", async () => {
  const repos = createInMemoryPersistenceRepositories();
  const ctx = createInitialContext("+919990002001");
  const session = await repos.conversationSessions.create({
    whatsapp_number: "+919990002001",
    normalized_whatsapp_number: "+919990002001",
    current_phase: ctx.phase,
    session_data: serializeConversationContext(ctx),
    last_message_at: new Date().toISOString(),
  });

  const found = await repos.conversationSessions.findActiveByNormalizedPhone(
    "+919990002001",
  );
  assert.equal(found?.id, session.id);

  await repos.conversationSessions.updateState({
    sessionId: session.id,
    current_phase: "COLLECTING_NAME",
    session_data: serializeConversationContext({
      ...ctx,
      phase: "COLLECTING_NAME",
    }),
    last_message_at: new Date().toISOString(),
  });

  await repos.conversationSessions.deactivate(session.id);
  const after = await repos.conversationSessions.findActiveByNormalizedPhone(
    "+919990002001",
  );
  assert.equal(after, null);
});

test("whatsapp messages: provider id dedupe lookup", async () => {
  const repos = createInMemoryPersistenceRepositories();
  await repos.whatsappMessages.insert({
    whatsapp_number: "+919990002001",
    normalized_whatsapp_number: "+919990002001",
    direction: "incoming",
    message_type: "text",
    message_text: "hello",
    provider_message_id: "MSG-1",
  });
  const row = await repos.whatsappMessages.findByProviderMessageId("MSG-1");
  assert.ok(row);
  assert.equal(row?.message_text, "hello");
});
