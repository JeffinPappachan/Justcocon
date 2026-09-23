import type { ConversationEngineDeps } from "@justcocon/booking-domain";
import type { DateValidationClock } from "@justcocon/validation";

export interface BookingEngineDepsOptions {
  /** Optional session id prefix for traceability in idempotency keys. */
  conversationSessionId?: string;
}

/**
 * Engine deps for WhatsApp turns. Idempotency keys are allocated only when the
 * conversation context has no submission.idempotencyKey yet (first CONFIRM).
 */
export function createBookingEngineDeps(
  clock: DateValidationClock,
  options: BookingEngineDepsOptions = {},
): ConversationEngineDeps {
  let counter = 0;
  const sessionPart = options.conversationSessionId?.slice(0, 8) ?? "nosess";

  return {
    clock,
    createIdempotencyKey: () =>
      `wa-${sessionPart}-${Date.now()}-${++counter}`,
  };
}
