import { createInitialContext, type ConversationContext } from "@justcocon/booking-domain";
import {
  deserializeConversationContext,
  mergeSessionSubmissionIntoContext,
  serializeConversationContext,
  type ConversationSessionRow,
  type PersistenceRepositories,
} from "@justcocon/persistence";

export interface ResolvedConversationSession {
  session: ConversationSessionRow;
  context: ConversationContext;
}

export class ConversationSessionService {
  constructor(private readonly repos: PersistenceRepositories) {}

  async resolveForPhone(phone: {
    normalized: string;
    display: string;
  }): Promise<ResolvedConversationSession> {
    const active =
      await this.repos.conversationSessions.findActiveByNormalizedPhone(
        phone.normalized,
      );
    if (active) {
      const context = mergeSessionSubmissionIntoContext(
        deserializeConversationContext(active.session_data, phone.normalized),
        active,
      );
      return { session: active, context };
    }

    const context = createInitialContext(phone.normalized);
    const session = await this.repos.conversationSessions.create({
      whatsapp_number: phone.display,
      normalized_whatsapp_number: phone.normalized,
      current_phase: context.phase,
      session_data: serializeConversationContext(context),
      last_message_at: new Date().toISOString(),
      is_active: true,
    });
    return { session, context };
  }

  async persistAfterTurn(
    sessionId: string,
    context: ConversationContext,
    lastMessageAt: string,
  ): Promise<void> {
    const terminal =
      context.phase === "COMPLETED" || context.phase === "CANCELLED";
    await this.repos.conversationSessions.updateState({
      sessionId,
      current_phase: context.phase,
      session_data: serializeConversationContext(context),
      submission_idempotency_key: context.submission.idempotencyKey ?? null,
      last_message_at: lastMessageAt,
      is_active: terminal ? false : true,
    });
  }
}
