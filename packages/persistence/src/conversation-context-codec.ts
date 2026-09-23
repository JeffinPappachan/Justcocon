import {
  createInitialContext,
  type ConversationContext,
} from "@justcocon/booking-domain";
import type { ConversationSessionRow } from "./types.js";

export const CONVERSATION_SESSION_DATA_VERSION = 1;

export function serializeConversationContext(
  context: ConversationContext,
): Record<string, unknown> {
  return {
    v: CONVERSATION_SESSION_DATA_VERSION,
    context,
  };
}

export function deserializeConversationContext(
  sessionData: Record<string, unknown>,
  normalizedPhone: string,
): ConversationContext {
  if (
    sessionData.v === CONVERSATION_SESSION_DATA_VERSION &&
    sessionData.context &&
    typeof sessionData.context === "object"
  ) {
    const ctx = sessionData.context as ConversationContext;
    if (
      typeof ctx.customerPhoneNormalized === "string" &&
      ctx.customerPhoneNormalized === normalizedPhone &&
      typeof ctx.phase === "string" &&
      ctx.draft &&
      typeof ctx.draft === "object" &&
      ctx.submission &&
      typeof ctx.submission === "object"
    ) {
      return ctx;
    }
  }
  return createInitialContext(normalizedPhone);
}

/**
 * Restores submission idempotency from the session row when session_data is
 * missing the key (e.g. partial write) but the column was set.
 */
export function mergeSessionSubmissionIntoContext(
  context: ConversationContext,
  session: Pick<ConversationSessionRow, "submission_idempotency_key">,
): ConversationContext {
  const columnKey = session.submission_idempotency_key?.trim();
  if (!columnKey || context.submission.idempotencyKey) {
    return context;
  }
  if (
    context.submission.status === "none" &&
    context.phase !== "PERSISTING" &&
    context.phase !== "ERROR"
  ) {
    return context;
  }
  return {
    ...context,
    submission: {
      ...context.submission,
      idempotencyKey: columnKey,
    },
  };
}
