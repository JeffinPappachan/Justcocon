import assert from "node:assert/strict";
import test from "node:test";
import { createInitialContext } from "@justcocon/booking-domain";
import {
  deserializeConversationContext,
  mergeSessionSubmissionIntoContext,
  serializeConversationContext,
} from "./conversation-context-codec.js";

test("codec: round-trip preserves submission idempotency key", () => {
  const ctx = createInitialContext("+919990002001");
  ctx.phase = "ERROR";
  ctx.submission = { status: "failed", idempotencyKey: "idem-abc" };

  const blob = serializeConversationContext(ctx);
  const restored = deserializeConversationContext(blob, "+919990002001");
  assert.equal(restored.submission.idempotencyKey, "idem-abc");
  assert.equal(restored.phase, "ERROR");
});

test("codec: corrupt session_data falls back to initial context", () => {
  const restored = deserializeConversationContext({ v: 99, context: {} }, "+919990002001");
  assert.equal(restored.phase, "IDLE");
  assert.equal(restored.customerPhoneNormalized, "+919990002001");
});

test("codec: mergeSessionSubmissionIntoContext restores column key for ERROR", () => {
  const ctx = createInitialContext("+919990002001");
  ctx.phase = "ERROR";
  ctx.submission = { status: "failed" };

  const merged = mergeSessionSubmissionIntoContext(ctx, {
    submission_idempotency_key: "idem-from-column",
  });
  assert.equal(merged.submission.idempotencyKey, "idem-from-column");
});

test("codec: merge ignores column when context already has key", () => {
  const ctx = createInitialContext("+919990002001");
  ctx.submission = { status: "failed", idempotencyKey: "idem-ctx" };

  const merged = mergeSessionSubmissionIntoContext(ctx, {
    submission_idempotency_key: "idem-column",
  });
  assert.equal(merged.submission.idempotencyKey, "idem-ctx");
});
