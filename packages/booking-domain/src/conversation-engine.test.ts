import test from "node:test";
import assert from "node:assert/strict";
import type { DateValidationClock } from "@justcocon/validation";
import { createInitialContext, type ConversationContext } from "./conversation-context.js";
import {
  reduceConversation,
  type ConversationEngineDeps,
} from "./conversation-engine.js";
import { buildBookingFromDraft } from "./build-booking-from-draft.js";
import type { ConversationPhase } from "@justcocon/shared-types";

const clock: DateValidationClock = {
  todayIsoDate: () => "2026-09-23",
};

let idemCounter = 0;
const deps: ConversationEngineDeps = {
  clock,
  createIdempotencyKey: () => `idem-${++idemCounter}`,
};

function user(ctx: ConversationContext, text: string) {
  return reduceConversation(ctx, { kind: "user_message", text }, deps);
}

function external(
  ctx: ConversationContext,
  event:
    | { type: "persistence_success"; bookingReference: string; bookingId: string }
    | { type: "persistence_failure" },
) {
  return reduceConversation(ctx, { kind: "external_event", event }, deps);
}

function openBookingMenu(ctx: ConversationContext): ConversationContext {
  let c = ctx;
  c = user(c, "hi").context;
  c = user(c, "start").context;
  c = user(c, "BOOK").context;
  return c;
}

function happyDraftSteps(ctx: ConversationContext): ConversationContext {
  let c = openBookingMenu(ctx);
  c = user(c, "Anu Thomas").context;
  c = user(c, "Kochi, Kerala").context;
  c = user(c, "2").context;
  c = user(c, "2026-09-25").context;
  c = user(c, "1").context;
  c = user(c, "Near the gate").context;
  return c;
}

test("IDLE + START shows welcome then menu then BOOK begins name collection", () => {
  const ctx = createInitialContext("+919876543210");
  const welcome = user(ctx, "start");
  assert.equal(welcome.phase, "AWAITING_START");
  const menu = user(welcome.context, "start");
  assert.equal(menu.phase, "AWAITING_MENU");
  const result = user(menu.context, "BOOK");
  assert.equal(result.phase, "COLLECTING_NAME");
});

test("CLOSE on menu returns to welcome", () => {
  const ctx = createInitialContext("+919876543210");
  let c = user(ctx, "hi").context;
  c = user(c, "start").context;
  assert.equal(c.phase, "AWAITING_MENU");
  const back = user(c, "CLOSE");
  assert.equal(back.phase, "AWAITING_START");
  assert.match(back.replies.join(" "), /Welcome to JustCocon/);
});

test("full happy path reaches AWAITING_CONFIRMATION", () => {
  const ctx = createInitialContext("+919876543210");
  const c = happyDraftSteps(ctx);
  assert.equal(c.phase, "AWAITING_CONFIRMATION");
});

test("SKIP on notes reaches summary with null notes", () => {
  let c = createInitialContext("+919876543210");
  c = openBookingMenu(c);
  c = user(c, "Anu Thomas").context;
  c = user(c, "Kochi").context;
  c = user(c, "1").context;
  c = user(c, "2026-09-30").context;
  c = user(c, "4").context;
  const result = user(c, "SKIP");
  assert.equal(result.phase, "AWAITING_CONFIRMATION");
  assert.equal(result.context.draft.notes, null);
});

test("incomplete CONFIRM stays on summary", () => {
  let c = createInitialContext("+919876543210");
  c = openBookingMenu(c);
  c = user(c, "Anu").context;
  c.phase = "AWAITING_CONFIRMATION";
  const result = user(c, "CONFIRM");
  assert.equal(result.phase, "AWAITING_CONFIRMATION");
  assert.equal(result.effects[0]?.type, "none");
});

test("complete CONFIRM enters PERSISTING with submit effect", () => {
  const c = happyDraftSteps(createInitialContext("+919876543210"));
  const result = user(c, "CONFIRM");
  assert.equal(result.phase, "PERSISTING");
  assert.equal(result.effects.length, 1);
  assert.equal(result.effects[0]?.type, "submit_booking");
});

test("exactly one submit_booking effect on first confirm", () => {
  const c = happyDraftSteps(createInitialContext("+919876543210"));
  const result = user(c, "confirm");
  assert.equal(result.effects.filter((e) => e.type === "submit_booking").length, 1);
});

test("persistence success moves to COMPLETED", () => {
  let c = happyDraftSteps(createInitialContext("+919876543210"));
  c = user(c, "yes").context;
  const result = external(c, {
    type: "persistence_success",
    bookingReference: "JC-20260923-0001",
    bookingId: "b1",
  });
  assert.equal(result.phase, "COMPLETED");
  assert.equal(result.context.submission.bookingReference, "JC-20260923-0001");
});

test("persistence failure moves to ERROR", () => {
  let c = happyDraftSteps(createInitialContext("+919876543210"));
  c = user(c, "CONFIRM").context;
  const result = external(c, { type: "persistence_failure" });
  assert.equal(result.phase, "ERROR");
  assert.equal(result.context.submission.status, "failed");
});

test("ERROR + RETRY reuses idempotency key and resubmits", () => {
  let c = happyDraftSteps(createInitialContext("+919876543210"));
  c = user(c, "CONFIRM").context;
  const key = c.submission.idempotencyKey;
  c = external(c, { type: "persistence_failure" }).context;
  const retry = user(c, "RETRY");
  assert.equal(retry.phase, "PERSISTING");
  assert.equal(retry.context.submission.idempotencyKey, key);
  assert.equal(retry.effects[0]?.type, "submit_booking");
});

test("duplicate CONFIRM in PERSISTING is no-op for effects", () => {
  let c = happyDraftSteps(createInitialContext("+919876543210"));
  c = user(c, "CONFIRM").context;
  const again = user(c, "CONFIRM");
  assert.equal(again.phase, "PERSISTING");
  assert.equal(again.effects[0]?.type, "none");
});

test("CONFIRM in COMPLETED does not submit again", () => {
  let c = happyDraftSteps(createInitialContext("+919876543210"));
  c = user(c, "CONFIRM").context;
  c = external(c, {
    type: "persistence_success",
    bookingReference: "JC-1",
    bookingId: "id-1",
  }).context;
  const result = user(c, "CONFIRM");
  assert.equal(result.effects[0]?.type, "none");
});

function contextAfterSuccessfulSubmit(
  ref = "JC-20260924-F4EB",
): ConversationContext {
  let c = happyDraftSteps(createInitialContext("+919876543210"));
  c = user(c, "CONFIRM").context;
  return external(c, {
    type: "persistence_success",
    bookingReference: ref,
    bookingId: "id-1",
  }).context;
}

function assertCompletedClosingReply(
  result: ReturnType<typeof user>,
  expectedRef?: string,
) {
  assert.equal(result.phase, "COMPLETED");
  assert.equal(result.effects[0]?.type, "none");
  assert.equal(
    result.effects.filter((e) => e.type === "submit_booking").length,
    0,
  );
  const text = result.replies.join("\n");
  if (expectedRef) {
    assert.match(text, new RegExp(expectedRef));
  }
  assert.match(text, /pending staff review/i);
  assert.match(text, /no harvesting crew has been assigned yet/i);
  assert.match(text, /START or BOOK/);
  assert.doesNotMatch(text, /CONFIRM only on the summary/);
}

for (const casual of ["Ok", "Thanks", "Thank you", "Great", "👍"]) {
  test(`COMPLETED casual "${casual}" returns closing message`, () => {
    const c = contextAfterSuccessfulSubmit();
    assertCompletedClosingReply(user(c, casual), "JC-20260924-F4EB");
  });
}

test("COMPLETED closing message omits hardcoded reference when unavailable", () => {
  let c = contextAfterSuccessfulSubmit();
  c = {
    ...c,
    submission: { ...c.submission, bookingReference: undefined },
  };
  const result = user(c, "Thanks");
  assertCompletedClosingReply(result);
  const text = result.replies.join("\n");
  assert.match(text, /booking request has been received/i);
  assert.doesNotMatch(text, /JC-/);
});

test("CANCELLED casual text returns cancellation closing", () => {
  const c = happyDraftSteps(createInitialContext("+919876543210"));
  const cancelled = user(c, "stop").context;
  assert.equal(cancelled.phase, "CANCELLED");
  const result = user(cancelled, "Ok");
  assert.equal(result.phase, "CANCELLED");
  assert.equal(result.effects[0]?.type, "none");
  const text = result.replies.join("\n");
  assert.match(text, /cancelled/i);
  assert.match(text, /START or BOOK/);
  assert.doesNotMatch(text, /CONFIRM only on the summary/);
});

test("START after COMPLETED opens welcome without resubmitting", () => {
  const c = contextAfterSuccessfulSubmit();
  const result = user(c, "start");
  assert.equal(result.phase, "AWAITING_START");
  assert.equal(result.effects[0]?.type, "none");
});

test("RESTART after COMPLETED opens welcome without resubmitting", () => {
  const c = contextAfterSuccessfulSubmit();
  const result = user(c, "RESTART");
  assert.equal(result.phase, "AWAITING_START");
  assert.equal(result.effects[0]?.type, "none");
});

const cancelPhases: ConversationPhase[] = [
  "COLLECTING_NAME",
  "COLLECTING_LOCATION",
  "COLLECTING_TREE_COUNT",
  "COLLECTING_PREFERRED_DATE",
  "COLLECTING_PREFERRED_TIME",
  "COLLECTING_NOTES",
];

for (const phase of cancelPhases) {
  test(`CANCEL from ${phase}`, () => {
    let c = happyDraftSteps(createInitialContext("+919876543210"));
    c = { ...c, phase };
    const result = user(c, "cancel");
    assert.equal(result.phase, "CANCELLED");
  });
}

test("CANCEL in AWAITING_CONFIRMATION", () => {
  const c = happyDraftSteps(createInitialContext("+919876543210"));
  const result = user(c, "stop");
  assert.equal(result.phase, "CANCELLED");
});

test("CANCEL blocked during PERSISTING", () => {
  let c = happyDraftSteps(createInitialContext("+919876543210"));
  c = user(c, "CONFIRM").context;
  const result = user(c, "CANCEL");
  assert.equal(result.phase, "PERSISTING");
});

test("RESTART clears draft and collects name again", () => {
  let c = happyDraftSteps(createInitialContext("+919876543210"));
  const result = user(c, "start over");
  assert.equal(result.phase, "AWAITING_START");
  assert.deepEqual(result.context.draft, {});
});

test("HELP does not change phase", () => {
  let c = happyDraftSteps(createInitialContext("+919876543210"));
  const before = c.phase;
  const result = user(c, "help");
  assert.equal(result.phase, before);
});

test("EDIT flow returns to summary with updated field", () => {
  let c = happyDraftSteps(createInitialContext("+919876543210"));
  c = user(c, "EDIT").context;
  c = user(c, "location").context;
  const result = user(c, "Aluva, Kerala");
  assert.equal(result.phase, "AWAITING_CONFIRMATION");
  assert.equal(result.context.draft.locationText, "Aluva, Kerala");
  assert.match(result.replies[0]!, /Aluva, Kerala/);
});

test("invalid field input keeps phase", () => {
  let c = createInitialContext("+919876543210");
  c = openBookingMenu(c);
  const result = user(c, " ");
  assert.equal(result.phase, "COLLECTING_NAME");
});

test("buildBookingFromDraft uses PENDING_STAFF_REVIEW only", () => {
  const draft = {
    customerName: "Anu",
    locationText: "Kochi",
    treeCountCategory: "6-10" as const,
    preferredDate: "2026-09-25",
    preferredTimeWindow: "MORNING" as const,
    notes: null,
  };
  const booking = buildBookingFromDraft(draft, {
    id: "booking-1",
    customerPhoneNormalized: "+919876543210",
  });
  assert.equal(booking.status, "PENDING_STAFF_REVIEW");
  assert.notEqual(booking.status, "CONFIRMED_BY_STAFF");
});

test("website BOOK with hints from IDLE starts name collection", () => {
  const result = user(
    createInitialContext("+919876543210"),
    "BOOK\nLocation: Kozhikode (Calicut) & surrounding areas\nTrees: 1-5 trees",
  );
  assert.equal(result.phase, "COLLECTING_NAME");
  assert.equal(
    result.context.draft.locationText,
    "Kozhikode (Calicut) & surrounding areas",
  );
  assert.equal(result.context.draft.treeCountCategory, "1-5");
  assert.match(result.replies[0] ?? "", /name/i);
});

test("website hint does not bypass validation on confirm", () => {
  let c = createInitialContext("+919876543210");
  c = user(c, "hi").context;
  c = user(c, "start").context;
  c = user(c, "BOOK\nLocation: Kochi\nTrees: 6-10 trees").context;
  assert.ok(c.websiteHint?.suggestedLocation);
  c = user(c, "Anu Thomas").context;
  assert.equal(c.phase, "COLLECTING_LOCATION");
  const incompleteSummary = user(
    { ...c, phase: "AWAITING_CONFIRMATION", draft: { customerName: "Anu Thomas" } },
    "CONFIRM",
  );
  assert.equal(incompleteSummary.phase, "AWAITING_CONFIRMATION");
  assert.equal(incompleteSummary.effects[0]?.type, "none");
});

test("BOOK after COMPLETED starts new flow", () => {
  let c = happyDraftSteps(createInitialContext("+919876543210"));
  c = user(c, "CONFIRM").context;
  c = external(c, {
    type: "persistence_success",
    bookingReference: "JC-9",
    bookingId: "9",
  }).context;
  const result = user(c, "BOOK");
  assert.equal(result.phase, "AWAITING_START");
});

test("command synonyms confirm yes and cancel stop", () => {
  let c = happyDraftSteps(createInitialContext("+919876543210"));
  c = user(c, "ok").context;
  assert.equal(c.phase, "PERSISTING");
  c = happyDraftSteps(createInitialContext("+919876543211"));
  const cancelled = user(c, "stop");
  assert.equal(cancelled.phase, "CANCELLED");
});
