import test from "node:test";
import assert from "node:assert/strict";
import { parseUserInput } from "./conversation-commands.js";

test("parseUserInput maps yes to CONFIRM only on summary", () => {
  assert.equal(parseUserInput("yes", "AWAITING_CONFIRMATION").kind, "command");
  assert.equal(
    parseUserInput("yes", "COLLECTING_NAME").kind,
    "text",
  );
});

test("parseUserInput maps edit field in EDITING", () => {
  const parsed = parseUserInput("location", "EDITING");
  assert.equal(parsed.kind, "edit_field");
  if (parsed.kind === "edit_field") {
    assert.equal(parsed.target, "location");
  }
});
