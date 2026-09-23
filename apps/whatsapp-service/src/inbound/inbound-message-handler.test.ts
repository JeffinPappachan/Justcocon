import assert from "node:assert/strict";
import test from "node:test";
import {
  createInMemoryPersistenceRepositories,
  type InMemoryPersistenceRepositories,
} from "@justcocon/persistence";
import {
  createInMemoryBookingOrchestratorBundle,
  type BookingOrchestrator,
} from "../booking-orchestrator.js";
import { createLogger } from "../logger.js";
import type { AppConfig } from "../config.js";
import { MockFirstBaileysAdapter } from "../whatsapp/baileys/baileys-adapter.js";
import type { InboundWhatsAppMessage } from "../whatsapp/transport-types.js";
import { createInboundMessageHandler } from "./inbound-message-handler.js";

const clock = { todayIsoDate: () => "2026-09-25" };
const logger = createLogger("test", "error");

const stubConfig: AppConfig = {
  appEnv: "staging",
  logLevel: "error",
  whatsappProvider: "baileys",
  whatsappEnableLive: false,
  bookingMode: "demo",
};

function textInbound(
  id: string,
  text: string,
  sender = "919990002001",
): InboundWhatsAppMessage {
  return {
    providerMessageId: id,
    fromMe: false,
    kind: "text",
    text,
    senderWhatsAppId: sender,
    timestamp: new Date().toISOString(),
  };
}

function createTestStack(orchestrator?: BookingOrchestrator): {
  handler: ReturnType<typeof createInboundMessageHandler>;
  transport: MockFirstBaileysAdapter;
  repos: InMemoryPersistenceRepositories;
  bundle: ReturnType<typeof createInMemoryBookingOrchestratorBundle>;
} {
  const bundle = createInMemoryBookingOrchestratorBundle(clock);
  const repos = bundle.repos as InMemoryPersistenceRepositories;
  const transport = new MockFirstBaileysAdapter(stubConfig);
  const handler = createInboundMessageHandler({
    repos,
    orchestrator: orchestrator ?? bundle.orchestrator,
    transport,
    logger,
  });
  return { handler, transport, repos, bundle };
}

async function start(
  transport: MockFirstBaileysAdapter,
  handler: ReturnType<typeof createInboundMessageHandler>,
) {
  await transport.start((msg) => handler.handleInbound(msg));
}

test("inbound: duplicate provider message id is processed once", async () => {
  const { handler, transport, repos } = createTestStack();
  await start(transport, handler);

  let inboundInserts = 0;
  const baseInsert = repos.whatsappMessages.insert.bind(repos.whatsappMessages);
  repos.whatsappMessages.insert = async (input) => {
    if (input.direction === "incoming") inboundInserts++;
    return baseInsert(input);
  };

  await transport.mockTransport.injectInbound(textInbound("dup-1", "BOOK"));
  await transport.mockTransport.injectInbound(textInbound("dup-1", "BOOK"));
  assert.equal(inboundInserts, 1);
});

test("inbound: reuses active session then creates new after COMPLETED", async () => {
  const { handler, transport, repos } = createTestStack();
  await start(transport, handler);

  await transport.mockTransport.injectInbound(textInbound("s1", "BOOK"));
  const afterFirst =
    await repos.conversationSessions.findActiveByNormalizedPhone(
      "+919990002001",
    );
  assert.ok(afterFirst);

  await transport.mockTransport.injectInbound(textInbound("s2", "Anu Thomas"));
  const afterSecond =
    await repos.conversationSessions.findActiveByNormalizedPhone(
      "+919990002001",
    );
  assert.equal(afterSecond?.id, afterFirst?.id);

  for (const [idx, step] of [
    "Kochi, Kerala",
    "2",
    "2026-09-25",
    "1",
    "Near gate",
    "CONFIRM",
  ].entries()) {
    await transport.mockTransport.injectInbound(
      textInbound(`s${idx + 3}`, step),
    );
  }

  const completed = await repos.conversationSessions.findById(afterFirst!.id);
  assert.equal(completed?.current_phase, "COMPLETED");
  assert.equal(completed?.is_active, false);

  await transport.mockTransport.injectInbound(textInbound("s10", "BOOK"));
  const newActive =
    await repos.conversationSessions.findActiveByNormalizedPhone(
      "+919990002001",
    );
  assert.ok(newActive);
  assert.notEqual(newActive?.id, afterFirst?.id);
});

test("inbound: CONFIRM yields PENDING_STAFF_REVIEW booking", async () => {
  const { handler, transport, repos } = createTestStack();
  await start(transport, handler);

  const flow = [
    "BOOK",
    "Anu Thomas",
    "Kochi, Kerala",
    "2",
    "2026-09-25",
    "1",
    "notes",
    "CONFIRM",
  ];
  let i = 0;
  for (const text of flow) {
    await transport.mockTransport.injectInbound(
      textInbound(`flow-${i++}`, text),
    );
  }

  const sessions = repos.listSessions();
  const withBooking = sessions.find(
    (s: (typeof sessions)[number]) => s.booking_id,
  );
  assert.ok(withBooking?.submission_idempotency_key);
  const booking = await repos.bookings.findByIdempotencyKey(
    withBooking!.submission_idempotency_key!,
  );
  assert.ok(booking);
  assert.equal(booking?.status, "PENDING_STAFF_REVIEW");
});

test("inbound: duplicate CONFIRM does not create second booking", async () => {
  const { handler, transport, repos } = createTestStack();
  await start(transport, handler);

  const flow = [
    "BOOK",
    "Anu Thomas",
    "Kochi, Kerala",
    "2",
    "2026-09-25",
    "1",
    "notes",
    "CONFIRM",
    "CONFIRM",
  ];
  let i = 0;
  for (const text of flow) {
    await transport.mockTransport.injectInbound(
      textInbound(`dupc-${i++}`, text),
    );
  }

  const bookings = repos
    .listSessions()
    .filter((s: ReturnType<typeof repos.listSessions>[number]) => s.booking_id);
  assert.equal(bookings.length, 1);
});

test("inbound: outbound send failure records delivery_status failed", async () => {
  const { handler, transport, repos } = createTestStack();
  await start(transport, handler);
  transport.mockTransport.failNextSend = true;

  await transport.mockTransport.injectInbound(textInbound("fail-1", "BOOK"));

  const outbound = repos
    .listMessages()
    .filter(
      (m: ReturnType<typeof repos.listMessages>[number]) =>
        m.direction === "outgoing" && m.message_type === "text",
    );
  assert.equal(outbound.length, 1);
  assert.equal(outbound[0]?.delivery_status, "failed");
});

test("inbound: persistence failure then RETRY creates one booking", async () => {
  const repos = createInMemoryPersistenceRepositories();
  let failInsert = true;
  const wrapped = {
    ...repos,
    bookings: {
      ...repos.bookings,
      async insert(input: Parameters<typeof repos.bookings.insert>[0]) {
        if (failInsert) {
          failInsert = false;
          throw new Error("db down");
        }
        return repos.bookings.insert(input);
      },
    },
  } as InMemoryPersistenceRepositories;

  const transport = new MockFirstBaileysAdapter(stubConfig);

  const { processConversationTurnWithPersistence } = await import(
    "@justcocon/persistence"
  );
  const handler2 = createInboundMessageHandler({
    repos: wrapped,
    orchestrator: {
      processTurn(context, input, options) {
        return processConversationTurnWithPersistence(context, input, {
          engine: {
            clock,
            createIdempotencyKey: () => "idem-retry-1",
          },
          persistence: {
            repos: wrapped,
            clock,
            createReferenceSuffix: () => "AB12",
          },
          conversationSessionId: options?.conversationSessionId,
          environment: "staging",
        });
      },
    },
    transport,
    logger,
  });
  await start(transport, handler2);

  const flow = [
    "BOOK",
    "Anu",
    "Kochi, Kerala",
    "2",
    "2026-09-25",
    "1",
    "n",
    "CONFIRM",
    "RETRY",
  ];
  let n = 0;
  for (const text of flow) {
    await transport.mockTransport.injectInbound(
      textInbound(`p-${n++}`, text),
    );
  }

  const booking = await wrapped.bookings.findByIdempotencyKey("idem-retry-1");
  assert.ok(booking);
  assert.equal(booking?.status, "PENDING_STAFF_REVIEW");
});

test("inbound: ignores self-sent and unsupported messages", async () => {
  const { handler, transport, repos } = createTestStack();
  await start(transport, handler);

  await handler.handleInbound({
    ...textInbound("self-1", "hi"),
    fromMe: true,
  });
  await handler.handleInbound({
    providerMessageId: "u-1",
    fromMe: false,
    kind: "unsupported",
    senderWhatsAppId: "919990002001",
    timestamp: new Date().toISOString(),
  });

  assert.equal(repos.listMessages().length, 0);
});

test("transport: graceful stop clears started state", async () => {
  const transport = new MockFirstBaileysAdapter(stubConfig);
  const { handler } = createTestStack();
  await start(transport, handler);
  await transport.stop();
  const status = await transport.getConnectionStatus();
  assert.equal(status.status, "disconnected");
});

test("inbound: sends one WhatsApp message per distinct reply line", async () => {
  const bundle = createInMemoryBookingOrchestratorBundle(clock);
  const repos = bundle.repos as InMemoryPersistenceRepositories;
  const transport = new MockFirstBaileysAdapter(stubConfig);
  const handler = createInboundMessageHandler({
    repos,
    orchestrator: {
      async processTurn(context, input, options) {
        void input;
        void options;
        return {
          phase: context.phase,
          context,
          replies: ["Line one", "Line two"],
          effects: [{ type: "none" }],
        };
      },
    },
    transport,
    logger,
  });
  await start(transport, handler);
  await transport.mockTransport.injectInbound(textInbound("multi-1", "HELP"));

  const outbound = repos
    .listMessages()
    .filter(
      (m: ReturnType<typeof repos.listMessages>[number]) =>
        m.direction === "outgoing" && m.message_type === "text",
    );
  assert.equal(outbound.length, 2);
  assert.equal(outbound[0]?.message_text, "Line one");
  assert.equal(outbound[1]?.message_text, "Line two");
});

test("inbound: booking summary is one WhatsApp message with line breaks", async () => {
  const { handler, transport, repos } = createTestStack();
  await start(transport, handler);

  const steps = [
    "BOOK",
    "Anu Thomas",
    "Kochi, Kerala",
    "2",
    "2026-09-25",
    "1",
    "Near gate",
  ];
  let i = 0;
  for (const text of steps) {
    await transport.mockTransport.injectInbound(
      textInbound(`sum-${i++}`, text),
    );
  }

  const outbound = repos
    .listMessages()
    .filter(
      (m: ReturnType<typeof repos.listMessages>[number]) =>
        m.direction === "outgoing" &&
        m.message_type === "text" &&
        m.message_text?.includes("Please review your booking:"),
    );
  assert.equal(outbound.length, 1);
  assert.ok(outbound[0]?.message_text?.includes("\n"));
  assert.match(outbound[0]?.message_text ?? "", /CONFIRM/);
});

test("inbound: final confirmation is one concise WhatsApp message", async () => {
  const { handler, transport, repos } = createTestStack();
  await start(transport, handler);

  const flow = [
    "BOOK",
    "Anu Thomas",
    "Kochi, Kerala",
    "2",
    "2026-09-25",
    "1",
    "n",
    "CONFIRM",
  ];
  let i = 0;
  for (const text of flow) {
    await transport.mockTransport.injectInbound(
      textInbound(`fin-${i++}`, text),
    );
  }

  const confirmations = repos
    .listMessages()
    .filter(
      (m: ReturnType<typeof repos.listMessages>[number]) =>
        m.direction === "outgoing" &&
        m.message_type === "text" &&
        m.message_text?.startsWith("Thank you. Your request"),
    );
  assert.equal(confirmations.length, 1);
  assert.match(confirmations[0]?.message_text ?? "", /JC-/);
  assert.match(confirmations[0]?.message_text ?? "", /pending staff review/);
});

test("baileys adapter: ingestBaileysMessage drives inbound pipeline", async () => {
  const { handler, transport, repos } = createTestStack();
  await start(transport, handler);

  await transport.ingestBaileysMessage({
    key: {
      id: "BAILEYS-INGEST-1",
      fromMe: false,
      remoteJid: "919990002001@s.whatsapp.net",
    },
    message: { conversation: "BOOK" },
    messageTimestamp: 1_700_000_000,
  });

  const inbound = await repos.whatsappMessages.findByProviderMessageId(
    "BAILEYS-INGEST-1",
  );
  assert.ok(inbound);
  assert.equal(inbound?.message_text, "BOOK");
});
