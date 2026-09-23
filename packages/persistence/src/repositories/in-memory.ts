import type { PersistenceRepositories } from "./interfaces.js";
import type {
  AuditLogRow,
  BookingRow,
  ConversationSessionRow,
  CreateAuditLogInput,
  CreateBookingInput,
  CreateConversationSessionInput,
  CreateCustomerInput,
  CreateWhatsAppMessageInput,
  CustomerRow,
  UpdateConversationSessionStateInput,
  WhatsAppMessageRow,
} from "../types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function createInMemoryPersistenceRepositories(): PersistenceRepositories & {
  reset(): void;
  seedSession(session: ConversationSessionRow): void;
  listSessions(): ConversationSessionRow[];
  listMessages(): WhatsAppMessageRow[];
} {
  const customers = new Map<string, CustomerRow>();
  const customersByPhone = new Map<string, string>();
  const bookings = new Map<string, BookingRow>();
  const bookingsByIdempotency = new Map<string, string>();
  const sessions = new Map<string, ConversationSessionRow>();
  const messages: WhatsAppMessageRow[] = [];
  const messagesByProviderId = new Map<string, string>();
  const auditLogs: AuditLogRow[] = [];

  return {
    reset() {
      customers.clear();
      customersByPhone.clear();
      bookings.clear();
      bookingsByIdempotency.clear();
      sessions.clear();
      messages.length = 0;
      messagesByProviderId.clear();
      auditLogs.length = 0;
    },
    customers: {
      async findByNormalizedPhone(normalized) {
        const id = customersByPhone.get(normalized);
        return id ? (customers.get(id) ?? null) : null;
      },
      async insert(input) {
        if (customersByPhone.has(input.normalized_whatsapp_number)) {
          throw Object.assign(new Error("duplicate customer phone"), {
            code: "23505",
          });
        }
        const ts = nowIso();
        const row: CustomerRow = {
          id: crypto.randomUUID(),
          full_name: input.full_name,
          whatsapp_number: input.whatsapp_number,
          normalized_whatsapp_number: input.normalized_whatsapp_number,
          created_at: ts,
          updated_at: ts,
        };
        customers.set(row.id, row);
        customersByPhone.set(row.normalized_whatsapp_number, row.id);
        return row;
      },
      async updateFullName(id, fullName) {
        const row = customers.get(id);
        if (!row) throw new Error("customer not found");
        const updated = { ...row, full_name: fullName, updated_at: nowIso() };
        customers.set(id, updated);
        return updated;
      },
    },
    bookings: {
      async findByIdempotencyKey(key) {
        const id = bookingsByIdempotency.get(key);
        return id ? (bookings.get(id) ?? null) : null;
      },
      async findByReference(reference) {
        for (const row of bookings.values()) {
          if (row.booking_reference === reference) return row;
        }
        return null;
      },
      async insert(input) {
        if (bookingsByIdempotency.has(input.submission_idempotency_key)) {
          throw Object.assign(new Error("duplicate idempotency key"), {
            code: "23505",
          });
        }
        const ts = nowIso();
        const row: BookingRow = {
          id: crypto.randomUUID(),
          booking_reference: input.booking_reference,
          customer_id: input.customer_id,
          location_text: input.location_text,
          latitude: null,
          longitude: null,
          tree_count_category: input.tree_count_category,
          preferred_date: input.preferred_date,
          preferred_time_window: input.preferred_time_window,
          customer_notes: input.customer_notes,
          status: input.status,
          source: input.source,
          environment: input.environment,
          submission_idempotency_key: input.submission_idempotency_key,
          created_at: ts,
          updated_at: ts,
        };
        bookings.set(row.id, row);
        bookingsByIdempotency.set(row.submission_idempotency_key, row.id);
        return row;
      },
    },
    conversationSessions: {
      async findById(id) {
        return sessions.get(id) ?? null;
      },
      async findActiveByNormalizedPhone(normalized) {
        for (const row of sessions.values()) {
          if (
            row.is_active &&
            row.normalized_whatsapp_number === normalized
          ) {
            return row;
          }
        }
        return null;
      },
      async create(input: CreateConversationSessionInput) {
        if (input.is_active !== false) {
          for (const row of sessions.values()) {
            if (
              row.is_active &&
              row.normalized_whatsapp_number === input.normalized_whatsapp_number
            ) {
              throw Object.assign(new Error("active session already exists"), {
                code: "23505",
              });
            }
          }
        }
        const ts = nowIso();
        const row: ConversationSessionRow = {
          id: crypto.randomUUID(),
          whatsapp_number: input.whatsapp_number,
          normalized_whatsapp_number: input.normalized_whatsapp_number,
          current_phase: input.current_phase,
          booking_id: null,
          session_data: input.session_data,
          submission_idempotency_key: input.submission_idempotency_key ?? null,
          last_message_at: input.last_message_at ?? null,
          expires_at: null,
          is_active: input.is_active ?? true,
          created_at: ts,
          updated_at: ts,
        };
        sessions.set(row.id, row);
        return row;
      },
      async updateState(input: UpdateConversationSessionStateInput) {
        const row = sessions.get(input.sessionId);
        if (!row) throw new Error("session not found");
        if (input.is_active === true) {
          for (const other of sessions.values()) {
            if (
              other.id !== input.sessionId &&
              other.is_active &&
              other.normalized_whatsapp_number === row.normalized_whatsapp_number
            ) {
              throw Object.assign(new Error("active session already exists"), {
                code: "23505",
              });
            }
          }
        }
        const updated: ConversationSessionRow = {
          ...row,
          current_phase: input.current_phase,
          session_data: input.session_data,
          submission_idempotency_key:
            input.submission_idempotency_key !== undefined
              ? input.submission_idempotency_key
              : row.submission_idempotency_key,
          last_message_at:
            input.last_message_at !== undefined
              ? input.last_message_at
              : row.last_message_at,
          is_active:
            input.is_active !== undefined ? input.is_active : row.is_active,
          updated_at: nowIso(),
        };
        sessions.set(input.sessionId, updated);
        return updated;
      },
      async deactivate(sessionId) {
        const row = sessions.get(sessionId);
        if (!row) throw new Error("session not found");
        const updated: ConversationSessionRow = {
          ...row,
          is_active: false,
          updated_at: nowIso(),
        };
        sessions.set(sessionId, updated);
        return updated;
      },
      async linkBooking(input) {
        const row = sessions.get(input.sessionId);
        if (!row) throw new Error("session not found");
        const updated: ConversationSessionRow = {
          ...row,
          booking_id: input.bookingId,
          submission_idempotency_key: input.submissionIdempotencyKey,
          current_phase: input.currentPhase,
          updated_at: nowIso(),
        };
        sessions.set(input.sessionId, updated);
        return updated;
      },
    },
    whatsappMessages: {
      async findByProviderMessageId(providerMessageId) {
        const id = messagesByProviderId.get(providerMessageId);
        if (!id) return null;
        return messages.find((m) => m.id === id) ?? null;
      },
      async insert(input) {
        if (input.provider_message_id) {
          if (messagesByProviderId.has(input.provider_message_id)) {
            throw Object.assign(new Error("duplicate provider message id"), {
              code: "23505",
            });
          }
        }
        const row: WhatsAppMessageRow = {
          id: crypto.randomUUID(),
          provider_message_id: input.provider_message_id ?? null,
          whatsapp_number: input.whatsapp_number,
          normalized_whatsapp_number: input.normalized_whatsapp_number,
          direction: input.direction,
          message_type: input.message_type,
          message_text: input.message_text,
          conversation_session_id: input.conversation_session_id ?? null,
          delivery_status: input.delivery_status ?? null,
          received_at: input.received_at ?? null,
          created_at: nowIso(),
        };
        messages.push(row);
        if (row.provider_message_id) {
          messagesByProviderId.set(row.provider_message_id, row.id);
        }
        return row;
      },
    },
    auditLogs: {
      async insert(input: CreateAuditLogInput) {
        const row: AuditLogRow = {
          id: crypto.randomUUID(),
          entity_type: input.entity_type,
          entity_id: input.entity_id,
          action: input.action,
          actor_type: input.actor_type,
          actor_id: input.actor_id ?? null,
          metadata: input.metadata ?? {},
          created_at: nowIso(),
        };
        auditLogs.push(row);
        return row;
      },
    },
    seedSession(session: ConversationSessionRow) {
      sessions.set(session.id, session);
    },
    listSessions() {
      return [...sessions.values()];
    },
    listMessages() {
      return [...messages];
    },
  };
}

export type InMemoryPersistenceRepositories = ReturnType<
  typeof createInMemoryPersistenceRepositories
>;
