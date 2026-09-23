import type {
  ConversationContext,
  ConversationInput,
  ConversationTurnResult,
} from "@justcocon/booking-domain";
import type { DateValidationClock } from "@justcocon/validation";
import {
  createInMemoryPersistenceRepositories,
  createServerSupabaseClient,
  createSupabasePersistenceRepositories,
  loadSupabaseServerConfigFromEnv,
  processConversationTurnWithPersistence,
  type PersistenceRepositories,
} from "@justcocon/persistence";
import { createBookingEngineDeps } from "./booking/engine-deps.js";

export interface BookingOrchestrator {
  processTurn(
    context: ConversationContext,
    input: ConversationInput,
    options?: { conversationSessionId?: string },
  ): Promise<ConversationTurnResult>;
}

export interface BookingOrchestratorBundle {
  orchestrator: BookingOrchestrator;
  repos: PersistenceRepositories;
}

export function createInMemoryBookingOrchestratorBundle(
  clock: DateValidationClock,
): BookingOrchestratorBundle {
  const repos = createInMemoryPersistenceRepositories();
  return {
    repos,
    orchestrator: createBookingOrchestrator(repos, clock),
  };
}

export function createInMemoryBookingOrchestrator(
  clock: DateValidationClock,
): BookingOrchestrator {
  return createInMemoryBookingOrchestratorBundle(clock).orchestrator;
}

export function createSupabaseBookingOrchestratorBundle(
  clock: DateValidationClock,
  env: Record<string, string | undefined> = process.env,
): BookingOrchestratorBundle {
  const config = loadSupabaseServerConfigFromEnv(env);
  const client = createServerSupabaseClient(config);
  const repos = createSupabasePersistenceRepositories(client);
  return {
    repos,
    orchestrator: createBookingOrchestrator(repos, clock, "staging"),
  };
}

export function createSupabaseBookingOrchestrator(
  clock: DateValidationClock,
  env: Record<string, string | undefined> = process.env,
): BookingOrchestrator {
  return createSupabaseBookingOrchestratorBundle(clock, env).orchestrator;
}

function createBookingOrchestrator(
  repos: PersistenceRepositories,
  clock: DateValidationClock,
  environment: "staging" | "development" | "production" = "staging",
): BookingOrchestrator {
  return {
    processTurn(context, input, options) {
      return processConversationTurnWithPersistence(context, input, {
        engine: createBookingEngineDeps(clock, {
          conversationSessionId: options?.conversationSessionId,
        }),
        persistence: { repos, clock },
        conversationSessionId: options?.conversationSessionId,
        environment,
      });
    },
  };
}
