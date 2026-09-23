import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeWhatsAppPhone,
} from "./phone-normalizer.js";
import { PersistenceValidationError } from "./errors.js";

test("normalizeWhatsAppPhone: 10-digit India mobile", () => {
  const r = normalizeWhatsAppPhone("9876543210");
  assert.equal(r.normalized, "+919876543210");
});

test("normalizeWhatsAppPhone: already E.164", () => {
  const r = normalizeWhatsAppPhone("+919876543210");
  assert.equal(r.normalized, "+919876543210");
});

test("normalizeWhatsAppPhone: strips spaces and dashes", () => {
  const r = normalizeWhatsAppPhone(" +91 98765-43210 ");
  assert.equal(r.normalized, "+919876543210");
});

test("normalizeWhatsAppPhone: leading 0 trunk prefix", () => {
  const r = normalizeWhatsAppPhone("09876543210");
  assert.equal(r.normalized, "+919876543210");
});

test("normalizeWhatsAppPhone: rejects empty", () => {
  assert.throws(
    () => normalizeWhatsAppPhone("   "),
    PersistenceValidationError,
  );
});
