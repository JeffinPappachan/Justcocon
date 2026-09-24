import type { ConversationPhase } from "@justcocon/shared-types";
import type { EditFieldTarget } from "./conversation-context.js";

export type GlobalCommand =
  | "BOOK"
  | "START"
  | "CLOSE"
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

const OPEN_CHAT_PHASES = new Set<ConversationPhase>([
  "IDLE",
  "COMPLETED",
  "CANCELLED",
]);

/** Maps WhatsApp list/button row ids to engine input. */
function parseInteractiveSelection(raw: string): ParsedUserInput | null {
  const text = raw.trim();
  const lower = text.toLowerCase();
  if (lower === "row_start" || lower === "btn_start") {
    return { kind: "command", command: "START" };
  }
  if (lower === "row_book" || lower === "btn_book" || lower === "book_harvest") {
    return { kind: "command", command: "BOOK" };
  }
  if (lower === "row_close" || lower === "btn_close") {
    return { kind: "command", command: "CLOSE" };
  }
  if (lower === "row_help") {
    return { kind: "command", command: "HELP" };
  }
  if (lower === "row_confirm") {
    return { kind: "command", command: "CONFIRM" };
  }
  if (lower === "row_edit") {
    return { kind: "command", command: "EDIT" };
  }
  if (lower === "row_skip_notes") {
    return { kind: "command", command: "SKIP" };
  }
  const tree = /^trees_([1-5])$/i.exec(text);
  if (tree) {
    return { kind: "text", text: tree[1]! };
  }
  const time = /^time_([1-4])$/i.exec(text);
  if (time) {
    return { kind: "text", text: time[1]! };
  }
  const date = /^date_(\d{4}-\d{2}-\d{2})$/i.exec(text);
  if (date) {
    return { kind: "text", text: date[1]! };
  }
  return null;
}

export function parseUserInput(
  raw: string,
  phase: ConversationPhase,
): ParsedUserInput {
  const interactive = parseInteractiveSelection(raw);
  if (interactive) {
    return interactive;
  }

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
  if (
    (OPEN_CHAT_PHASES.has(phase) || phase === "AWAITING_START") &&
    (firstLine === "hi" ||
      firstLine === "hello" ||
      firstLine === "start" ||
      firstLine === "hey")
  ) {
    return { kind: "command", command: "START" };
  }
  if (phase === "AWAITING_MENU") {
    if (firstLine === "book") {
      return { kind: "command", command: "BOOK" };
    }
    if (firstLine === "close") {
      return { kind: "command", command: "CLOSE" };
    }
  }
  if (
    firstLine === "book" &&
    (OPEN_CHAT_PHASES.has(phase) ||
      phase === "AWAITING_START" ||
      phase === "COMPLETED" ||
      phase === "CANCELLED")
  ) {
    return { kind: "command", command: "BOOK" };
  }
  if (
    (phase === "COMPLETED" || phase === "CANCELLED") &&
    firstLine === "close"
  ) {
    return { kind: "command", command: "CLOSE" };
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
    "Commands: HELP, CANCEL, RESTART. Reply START, then BOOK. CONFIRM only on the summary.";
  if (phase === "COLLECTING_TREE_COUNT") {
    return "Tree count: reply 1=1-5, 2=6-10, 3=11-25, 4=26-50, 5=50+. HELP, CANCEL, RESTART.";
  }
  if (phase === "COLLECTING_PREFERRED_DATE") {
    return "Preferred date as YYYY-MM-DD (e.g. 2026-09-29). HELP, CANCEL, RESTART.";
  }
  if (phase === "COLLECTING_PREFERRED_TIME") {
    return "Preferred time: 1=Morning, 2=Afternoon, 3=Evening, 4=Flexible. HELP, CANCEL, RESTART.";
  }
  if (phase === "COLLECTING_NOTES") {
    return `${base} Type notes or SKIP to omit.`;
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
  if (phase === "AWAITING_START") {
    return "Reply START to continue.";
  }
  if (phase === "AWAITING_MENU") {
    return "Reply BOOK to schedule a visit, or CLOSE to return to welcome.";
  }
  if (phase === "COMPLETED") {
    return "Your booking was submitted. Reply START or BOOK for another visit.";
  }
  if (phase === "CANCELLED") {
    return "Draft cancelled. Reply START or BOOK to begin again.";
  }
  return base;
}

export function editingMenuMessage(): string {
  return (
    "What would you like to change? Reply: name, location, trees, date, time, or notes."
  );
}
