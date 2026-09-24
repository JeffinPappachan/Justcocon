import assert from "node:assert/strict";
import test from "node:test";
import { createInitialContext } from "@justcocon/booking-domain";
import { reduceConversation } from "@justcocon/booking-domain";
import { planWhatsAppOutboundInteractiveMessages } from "./interactive-outbound-planner.js";

const clock = { todayIsoDate: () => "2026-09-24" };

test("interactive planner: welcome uses native flow Start button", () => {
  const ctx = createInitialContext("+919876543210");
  const turn = reduceConversation(
    ctx,
    { kind: "user_message", text: "hi" },
    { clock, createIdempotencyKey: () => "k1" },
  );
  const messages = planWhatsAppOutboundInteractiveMessages(turn, {
    interactiveEnabled: true,
    clock,
  });
  assert.ok(messages.length >= 2);
  assert.equal(messages[0]?.kind, "text");
  const native = messages.find((m) => m.kind === "native_flow");
  assert.ok(native);
  if (native?.kind === "native_flow") {
    assert.equal(native.buttons[0]?.buttonId, "btn_start");
  }
  assert.match(
    messages.map((m) => (m.kind === "text" ? m.body : "")).join(" "),
    /Welcome to JustCocon/,
  );
});

test("interactive planner: menu uses native flow Book and Close", () => {
  let ctx = createInitialContext("+919876543210");
  ctx = reduceConversation(
    ctx,
    { kind: "user_message", text: "hi" },
    { clock, createIdempotencyKey: () => "k1" },
  ).context;
  const turn = reduceConversation(
    ctx,
    { kind: "user_message", text: "btn_start" },
    { clock, createIdempotencyKey: () => "k2" },
  );
  const messages = planWhatsAppOutboundInteractiveMessages(turn, {
    interactiveEnabled: true,
    clock,
  });
  assert.ok(messages.length >= 2);
  const native = messages.find((m) => m.kind === "native_flow");
  assert.ok(native?.kind === "native_flow");
  if (native?.kind === "native_flow") {
    assert.equal(native.buttons.length, 2);
    assert.equal(native.buttons[0]?.buttonId, "btn_book");
    assert.equal(native.buttons[1]?.buttonId, "btn_close");
  }
});
