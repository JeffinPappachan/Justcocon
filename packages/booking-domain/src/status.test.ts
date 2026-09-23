import test from "node:test";
import assert from "node:assert/strict";
import { isValidStatusTransition } from "./status.js";

const validTransitions = [
  ["NEW", "PENDING_STAFF_REVIEW"],
  ["PENDING_STAFF_REVIEW", "CONFIRMED_BY_STAFF"],
  ["CONFIRMED_BY_STAFF", "SCHEDULED"],
  ["SCHEDULED", "IN_PROGRESS"],
  ["IN_PROGRESS", "COMPLETED"],
] as const;

for (const [from, to] of validTransitions) {
  test(`allows valid transition ${from} -> ${to}`, () => {
    assert.equal(isValidStatusTransition(from, to), true);
  });
}

const invalidTransitions = [
  ["NEW", "SCHEDULED"],
  ["CONFIRMED_BY_STAFF", "PENDING_STAFF_REVIEW"],
  ["SCHEDULED", "COMPLETED"],
  ["NEW", "CANCELLED"],
  ["COMPLETED", "NEW"],
] as const;

for (const [from, to] of invalidTransitions) {
  test(`rejects invalid transition ${from} -> ${to}`, () => {
    assert.equal(isValidStatusTransition(from, to), false);
  });
}
