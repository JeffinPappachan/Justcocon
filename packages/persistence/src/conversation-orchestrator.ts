import {
  reduceConversation,
  type ConversationContext,
  type ConversationEngineDeps,
  type ConversationInput,
  type ConversationTurnResult,
} from "@justcocon/booking-domain";
import type { SubmitBookingServiceDeps } from "./submit-booking.js";
import { submitBooking } from "./submit-booking.js";

export interface ConversationPersistenceOrchestratorDeps {
  engine: ConversationEngineDeps;
  persistence: SubmitBookingServiceDeps;
  conversationSessionId?: string;
  environment?: "staging" | "development" | "production";
}

function logPersistenceFailure(error: unknown): void {
  const internalMessage =
    error instanceof Error ? error.message : "Unknown persistence error";
  console.error(
    JSON.stringify({
      level: "error",
      scope: "persistence-orchestrator",
      event: "booking_persistence_failed",
      message: internalMessage,
    }),
  );
}

/**
 * Runs one conversation turn and executes submit_booking effects against persistence,
 * feeding persistence_success / persistence_failure back into the engine.
 */
export async function processConversationTurnWithPersistence(
  context: ConversationContext,
  input: ConversationInput,
  deps: ConversationPersistenceOrchestratorDeps,
): Promise<ConversationTurnResult> {
  let result = reduceConversation(context, input, deps.engine);

  const submitEffect = result.effects.find(
    (e): e is Extract<(typeof result.effects)[number], { type: "submit_booking" }> =>
      e.type === "submit_booking",
  );
  if (!submitEffect || submitEffect.type !== "submit_booking") {
    return result;
  }

  try {
    const saved = await submitBooking(
      {
        draft: submitEffect.draft,
        idempotencyKey: submitEffect.idempotencyKey,
        whatsappIdentity: context.customerPhoneNormalized,
        conversationSessionId: deps.conversationSessionId,
        environment: deps.environment,
      },
      deps.persistence,
    );

    result = reduceConversation(
      result.context,
      {
        kind: "external_event",
        event: {
          type: "persistence_success",
          bookingReference: saved.bookingReference,
          bookingId: saved.bookingId,
        },
      },
      deps.engine,
    );
  } catch (error) {
    logPersistenceFailure(error);
    result = reduceConversation(
      result.context,
      { kind: "external_event", event: { type: "persistence_failure" } },
      deps.engine,
    );
  }

  return result;
}
