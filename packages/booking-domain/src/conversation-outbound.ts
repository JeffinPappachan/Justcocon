import { isBookingSummaryMessage } from "./conversation-summary.js";

const INCOMPLETE_HEADER = "Your booking is incomplete or invalid:";
const COMMAND_STEP_PROMPT = "Please use a command or follow the current step.";
const PERSISTENCE_ERROR_INTRO =
  "We could not save your booking due to a system error.";

/**
 * Maps engine reply lines to WhatsApp outbound messages.
 * - Never splits a single reply string on line breaks (summaries stay one message).
 * - Coalesces multi-part validation/error replies into one structured message.
 * - Sends separate WhatsApp messages for distinct conversational reply lines.
 */
export function planWhatsAppOutboundMessages(
  replies: readonly string[],
): string[] {
  const parts = replies.map((r) => r.trim()).filter((r) => r.length > 0);
  if (parts.length === 0) {
    return [];
  }
  if (parts.length === 1) {
    return [parts[0]!];
  }
  if (shouldCoalesceReplyParts(parts)) {
    return [parts.join("\n\n")];
  }
  return [...parts];
}

function shouldCoalesceReplyParts(parts: string[]): boolean {
  const first = parts[0] ?? "";
  if (first.startsWith(INCOMPLETE_HEADER)) {
    return true;
  }
  if (first.startsWith(COMMAND_STEP_PROMPT)) {
    return true;
  }
  if (
    first.startsWith(PERSISTENCE_ERROR_INTRO) ||
    parts.some((p) => p.startsWith("Save failed:"))
  ) {
    return true;
  }
  if (parts.some((p) => isBookingSummaryMessage(p))) {
    return true;
  }
  return false;
}
