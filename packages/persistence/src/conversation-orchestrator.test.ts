import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialContext,
  reduceConversation,
} from "@justcocon/booking-domain";
import { processConversationTurnWithPersistence } from "./conversation-orchestrator.js";
import { createInMemoryPersistenceRepositories } from "./repositories/in-memory.js";
const clock = { todayIsoDate: () => "2026-09-25" };

function happyDraftSteps(context: ReturnType<typeof createInitialContext>) {
  const steps = [
    "hi",
    "START",
    "BOOK",
    "Anu Thomas",
    "Kochi, Kerala",
    "2",
    "2026-09-25",
    "1",
    "Near the gate",
  ];
  let c = context;
  const engineDeps = { clock, createIdempotencyKey: () => "idem-orch-1" };
  for (const text of steps) {
    c = reduceConversation(c, { kind: "user_message", text }, engineDeps).context;
  }
  return c;
}

test("orchestrator: CONFIRM completes after successful persistence", async () => {
  const repos = createInMemoryPersistenceRepositories();
  let context = happyDraftSteps(createInitialContext("+919876543210"));

  const deps = {
    engine: { clock, createIdempotencyKey: () => "idem-orch-1" },
    persistence: { repos, clock, createReferenceSuffix: () => "AB12" },
  };

  const result = await processConversationTurnWithPersistence(
    context,
    { kind: "user_message", text: "CONFIRM" },
    deps,
  );

  assert.equal(result.phase, "COMPLETED");
  assert.equal(result.context.submission.status, "submitted");
  assert.ok(result.context.submission.bookingReference?.startsWith("JC-"));
});

test("orchestrator: persistence failure moves to ERROR and RETRY reuses key", async () => {
  const repos = createInMemoryPersistenceRepositories();
  let failOnce = true;
  const brokenRepos = {
    ...repos,
    bookings: {
      ...repos.bookings,
      async insert(input: Parameters<typeof repos.bookings.insert>[0]) {
        if (failOnce) {
          failOnce = false;
          throw new Error("temporary outage");
        }
        return repos.bookings.insert(input);
      },
      findByIdempotencyKey: repos.bookings.findByIdempotencyKey.bind(repos.bookings),
      findByReference: repos.bookings.findByReference.bind(repos.bookings),
    },
  };

  const engineDeps = { clock, createIdempotencyKey: () => "idem-retry-1" };
  const persistenceDeps = {
    repos: brokenRepos,
    clock,
    createReferenceSuffix: () => "ZZ99",
  };

  let context = happyDraftSteps(createInitialContext("+919876543210"));

  const failed = await processConversationTurnWithPersistence(
    context,
    { kind: "user_message", text: "CONFIRM" },
    { engine: engineDeps, persistence: persistenceDeps },
  );
  assert.equal(failed.phase, "ERROR");
  assert.equal(failed.context.submission.idempotencyKey, "idem-retry-1");
  const customerText = failed.replies.join("\n");
  assert.doesNotMatch(customerText, /temporary outage/i);
  assert.doesNotMatch(customerText, /Save failed:/i);
  assert.match(customerText, /RETRY/);

  const retry = await processConversationTurnWithPersistence(
    failed.context,
    { kind: "user_message", text: "RETRY" },
    { engine: engineDeps, persistence: persistenceDeps },
  );
  assert.equal(retry.phase, "COMPLETED");
});

test("orchestrator: persistence failure logs internally without customer detail leak", async () => {
  const repos = createInMemoryPersistenceRepositories();
  const brokenRepos = {
    ...repos,
    bookings: {
      ...repos.bookings,
      async insert() {
        throw new Error("relation bookings does not exist");
      },
      findByIdempotencyKey: repos.bookings.findByIdempotencyKey.bind(repos.bookings),
      findByReference: repos.bookings.findByReference.bind(repos.bookings),
    },
  };

  const logs: string[] = [];
  const originalError = console.error;
  console.error = (chunk: string) => {
    logs.push(chunk);
  };

  try {
    const context = happyDraftSteps(createInitialContext("+919876543210"));
    const result = await processConversationTurnWithPersistence(
      context,
      { kind: "user_message", text: "CONFIRM" },
      {
        engine: { clock, createIdempotencyKey: () => "idem-safe-1" },
        persistence: {
          repos: brokenRepos,
          clock,
          createReferenceSuffix: () => "AB12",
        },
      },
    );

    assert.equal(result.phase, "ERROR");
    assert.equal(result.replies.length, 1);
    assert.match(result.replies[0]!, /system error/i);
    assert.doesNotMatch(result.replies[0]!, /Failed to insert booking/i);

    assert.equal(logs.length, 1);
    const payload = JSON.parse(logs[0]!);
    assert.equal(payload.event, "booking_persistence_failed");
    assert.equal(payload.message, "Failed to insert booking.");
    assert.doesNotMatch(JSON.stringify(payload), /service.?role|eyJ/i);
  } finally {
    console.error = originalError;
  }
});
