import type { ConversationPhase } from "@justcocon/shared-types";
import type { EditFieldTarget } from "./conversation-context.js";

export type GlobalCommand =
  | "BOOK"
  | "START"
  | "CONFIRM"
  | "CANCEL"
  | "RESTART"
  | "HELP"
  | "SKIP"
  | "EDIT"
  | "RETRY";

export type ParsedUserInput =
  | { kind: "command"; command: GlobalCommand }
  | { kind: "edit_field"; target: EditFieldTarget }
  | { kind: "text"; text: string };

const BOOK_TRIGGERS = new Set(["book", "start", "hi", "hello"]);

export function parseUserInput(
  raw: string,
  phase: ConversationPhase,
): ParsedUserInput {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const firstLine = lower.split(/\r?\n/)[0]?.trim() ?? lower;

  if (lower === "help" || lower === "?") {
    return { kind: "command", command: "HELP" };
  }
  if (lower === "cancel" || lower === "stop") {
    return { kind: "command", command: "CANCEL" };
  }
  if (lower === "restart" || lower === "start over") {
    return { kind: "command", command: "RESTART" };
  }
  if (BOOK_TRIGGERS.has(firstLine) || BOOK_TRIGGERS.has(lower)) {
    return { kind: "command", command: "BOOK" };
  }
  if (lower === "skip" && phase === "COLLECTING_NOTES") {
    return { kind: "command", command: "SKIP" };
  }
  if (
    (lower === "confirm" ||
      lower === "yes" ||
      lower === "ok") &&
    phase === "AWAITING_CONFIRMATION"
  ) {
    return { kind: "command", command: "CONFIRM" };
  }
  if (lower === "edit" && phase === "AWAITING_CONFIRMATION") {
    return { kind: "command", command: "EDIT" };
  }
  if (lower === "retry" && phase === "ERROR") {
    return { kind: "command", command: "RETRY" };
  }
  if (phase === "EDITING") {
    const target = parseEditFieldTarget(lower);
    if (target) {
      return { kind: "edit_field", target };
    }
  }

  return { kind: "text", text };
}

function parseEditFieldTarget(lower: string): EditFieldTarget | null {
  const map: Record<string, EditFieldTarget> = {
    name: "name",
    "edit name": "name",
    "1": "name",
    location: "location",
    address: "location",
    "edit location": "location",
    "2": "location",
    trees: "trees",
    "tree count": "trees",
    "edit trees": "trees",
    "3": "trees",
    date: "date",
    "edit date": "date",
    "4": "date",
    time: "time",
    "edit time": "time",
    "5": "time",
    notes: "notes",
    "edit notes": "notes",
    "6": "notes",
  };
  return map[lower] ?? null;
}

export function helpMessage(phase: ConversationPhase): string {
  const base =
    "Commands: HELP, CANCEL, RESTART. Start with BOOK. CONFIRM only on the summary.";
  if (phase === "COLLECTING_NOTES") {
    return `${base} SKIP to omit notes.`;
  }
  if (phase === "AWAITING_CONFIRMATION") {
    return `${base} EDIT to change a field. CONFIRM to submit.`;
  }
  if (phase === "ERROR") {
    return `${base} RETRY to submit again.`;
  }
  if (phase === "PERSISTING") {
    return "Your booking is being saved. Please wait. HELP only — CANCEL is not available now.";
  }
  return base;
}

export function editingMenuMessage(): string {
  return (
    "What would you like to change? Reply: name, location, trees, date, time, or notes."
  );
}
