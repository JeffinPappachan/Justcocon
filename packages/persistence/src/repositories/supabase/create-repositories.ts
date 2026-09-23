import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersistenceRepositories } from "../interfaces.js";
import type {
  CreateAuditLogInput,
  CreateBookingInput,
  CreateCustomerInput,
  CreateWhatsAppMessageInput,
} from "../../types.js";
import { PersistenceRepositoryError, isUniqueViolation } from "../../errors.js";

function mapPostgrestError(context: string, error: unknown): never {
  throw new PersistenceRepositoryError(`${context}: ${formatError(error)}`, error);
}

function formatError(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: string }).message);
  }
  return String(error);
}

export function createSupabasePersistenceRepositories(
  client: SupabaseClient,
): PersistenceRepositories {
  return {
    customers: {
      async findByNormalizedPhone(normalized) {
        const { data, error } = await client
          .from("customers")
          .select("*")
          .eq("normalized_whatsapp_number", normalized)
          .maybeSingle();
        if (error) mapPostgrestError("customers.findByNormalizedPhone", error);
        return data;
      },
      async insert(input: CreateCustomerInput) {
        const { data, error } = await client
          .from("customers")
          .insert(input)
          .select("*")
          .single();
        if (error) mapPostgrestError("customers.insert", error);
        return data;
      },
      async updateFullName(id, fullName) {
        const { data, error } = await client
          .from("customers")
          .update({ full_name: fullName })
          .eq("id", id)
          .select("*")
          .single();
        if (error) mapPostgrestError("customers.updateFullName", error);
        return data;
      },
    },
    bookings: {
      async findByIdempotencyKey(key) {
        const { data, error } = await client
          .from("bookings")
          .select("*")
          .eq("submission_idempotency_key", key)
          .maybeSingle();
        if (error) mapPostgrestError("bookings.findByIdempotencyKey", error);
        return data;
      },
      async findByReference(reference) {
        const { data, error } = await client
          .from("bookings")
          .select("*")
          .eq("booking_reference", reference)
          .maybeSingle();
        if (error) mapPostgrestError("bookings.findByReference", error);
        return data;
      },
      async insert(input: CreateBookingInput) {
        const { data, error } = await client
          .from("bookings")
          .insert(input)
          .select("*")
          .single();
        if (error) {
          if (isUniqueViolation(error)) {
            throw Object.assign(new PersistenceRepositoryError("duplicate booking", error), {
              code: "23505",
            });
          }
          mapPostgrestError("bookings.insert", error);
        }
        return data;
      },
    },
    conversationSessions: {
      async findById(id) {
        const { data, error } = await client
          .from("conversation_sessions")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) mapPostgrestError("conversationSessions.findById", error);
        return data;
      },
      async findActiveByNormalizedPhone(normalized) {
        const { data, error } = await client
          .from("conversation_sessions")
          .select("*")
          .eq("normalized_whatsapp_number", normalized)
          .eq("is_active", true)
          .maybeSingle();
        if (error) {
          mapPostgrestError(
            "conversationSessions.findActiveByNormalizedPhone",
            error,
          );
        }
        return data;
      },
      async create(input) {
        const { data, error } = await client
          .from("conversation_sessions")
          .insert({
            whatsapp_number: input.whatsapp_number,
            normalized_whatsapp_number: input.normalized_whatsapp_number,
            current_phase: input.current_phase,
            session_data: input.session_data,
            submission_idempotency_key: input.submission_idempotency_key ?? null,
            last_message_at: input.last_message_at ?? null,
            is_active: input.is_active ?? true,
          })
          .select("*")
          .single();
        if (error) mapPostgrestError("conversationSessions.create", error);
        return data;
      },
      async updateState(input) {
        const { data, error } = await client
          .from("conversation_sessions")
          .update({
            current_phase: input.current_phase,
            session_data: input.session_data,
            submission_idempotency_key: input.submission_idempotency_key,
            last_message_at: input.last_message_at,
            is_active: input.is_active,
          })
          .eq("id", input.sessionId)
          .select("*")
          .single();
        if (error) mapPostgrestError("conversationSessions.updateState", error);
        return data;
      },
      async deactivate(sessionId) {
        const { data, error } = await client
          .from("conversation_sessions")
          .update({ is_active: false })
          .eq("id", sessionId)
          .select("*")
          .single();
        if (error) mapPostgrestError("conversationSessions.deactivate", error);
        return data;
      },
      async linkBooking(input) {
        const { data, error } = await client
          .from("conversation_sessions")
          .update({
            booking_id: input.bookingId,
            submission_idempotency_key: input.submissionIdempotencyKey,
            current_phase: input.currentPhase,
          })
          .eq("id", input.sessionId)
          .select("*")
          .single();
        if (error) mapPostgrestError("conversationSessions.linkBooking", error);
        return data;
      },
    },
    whatsappMessages: {
      async findByProviderMessageId(providerMessageId) {
        const { data, error } = await client
          .from("whatsapp_messages")
          .select("*")
          .eq("provider_message_id", providerMessageId)
          .maybeSingle();
        if (error) {
          mapPostgrestError("whatsappMessages.findByProviderMessageId", error);
        }
        return data;
      },
      async insert(input: CreateWhatsAppMessageInput) {
        const { data, error } = await client
          .from("whatsapp_messages")
          .insert({
            whatsapp_number: input.whatsapp_number,
            normalized_whatsapp_number: input.normalized_whatsapp_number,
            direction: input.direction,
            message_type: input.message_type,
            message_text: input.message_text,
            conversation_session_id: input.conversation_session_id ?? null,
            provider_message_id: input.provider_message_id ?? null,
            received_at: input.received_at ?? null,
            delivery_status: input.delivery_status ?? null,
          })
          .select("*")
          .single();
        if (error) mapPostgrestError("whatsappMessages.insert", error);
        return data;
      },
    },
    auditLogs: {
      async insert(input: CreateAuditLogInput) {
        const { data, error } = await client
          .from("audit_logs")
          .insert({
            entity_type: input.entity_type,
            entity_id: input.entity_id,
            action: input.action,
            actor_type: input.actor_type,
            actor_id: input.actor_id ?? null,
            metadata: input.metadata ?? {},
          })
          .select("*")
          .single();
        if (error) mapPostgrestError("auditLogs.insert", error);
        return data;
      },
    },
  };
}
