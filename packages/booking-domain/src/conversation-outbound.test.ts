import assert from "node:assert/strict";
import test from "node:test";
import { formatBookingSummary } from "./conversation-summary.js";
import { planWhatsAppOutboundMessages } from "./conversation-outbound.js";
import { createInitialContext } from "./conversation-context.js";
import { reduceConversation } from "./conversation-engine.js";

const clock = { todayIsoDate: () => "2026-09-25" };

test("outbound: booking summary stays one WhatsApp message", () => {
  const draft = {
    customerName: "Anu",
    locationText: "Kochi",
    treeCountCategory: "1-5" as const,
    preferredDate: "2026-09-25",
    preferredTimeWindow: "MORNING" as const,
    notes: null,
  };
  const summary = formatBookingSummary(draft);
  assert.ok(summary.includes("\n"));
  const planned = planWhatsAppOutboundMessages([summary]);
  assert.equal(planned.length, 1);
  assert.equal(planned[0], summary);
});

test("outbound: incomplete CONFIRM coalesces validation lines", () => {
  const ctx = {
    ...createInitialContext("+919876543210"),
    phase: "AWAITING_CONFIRMATION" as const,
    draft: { customerName: "Anu" },
  };
  const result = reduceConversation(
    ctx,
    { kind: "user_message", text: "CONFIRM" },
    { clock, createIdempotencyKey: () => "k1" },
  );
  assert.ok(result.replies.length > 1);
  const planned = planWhatsAppOutboundMessages(result.replies);
  assert.equal(planned.length, 1);
  assert.match(planned[0]!, /incomplete or invalid/);
});

test("outbound: distinct prompt lines stay separate messages", () => {
  const planned = planWhatsAppOutboundMessages(["Line one", "Line two"]);
  assert.deepEqual(planned, ["Line one", "Line two"]);
});

test("outbound: persistence error plus Save failed coalesces", () => {
  const planned = planWhatsAppOutboundMessages([
    "We could not save your booking due to a system error. Reply RETRY to try again or RESTART to begin a new booking.",
    "Save failed: db down",
  ]);
  assert.equal(planned.length, 1);
  assert.match(planned[0]!, /Save failed:/);
});
