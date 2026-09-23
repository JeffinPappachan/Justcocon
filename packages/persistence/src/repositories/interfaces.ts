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

export interface CustomersRepository {
  findByNormalizedPhone(normalized: string): Promise<CustomerRow | null>;
  insert(input: CreateCustomerInput): Promise<CustomerRow>;
  updateFullName(id: string, fullName: string): Promise<CustomerRow>;
}

export interface BookingsRepository {
  findByIdempotencyKey(key: string): Promise<BookingRow | null>;
  findByReference(reference: string): Promise<BookingRow | null>;
  insert(input: CreateBookingInput): Promise<BookingRow>;
}

export interface ConversationSessionsRepository {
  findById(id: string): Promise<ConversationSessionRow | null>;
  findActiveByNormalizedPhone(
    normalized: string,
  ): Promise<ConversationSessionRow | null>;
  create(input: CreateConversationSessionInput): Promise<ConversationSessionRow>;
  updateState(
    input: UpdateConversationSessionStateInput,
  ): Promise<ConversationSessionRow>;
  deactivate(sessionId: string): Promise<ConversationSessionRow>;
  linkBooking(input: {
    sessionId: string;
    bookingId: string;
    submissionIdempotencyKey: string;
    currentPhase: string;
  }): Promise<ConversationSessionRow>;
}

export interface WhatsAppMessagesRepository {
  findByProviderMessageId(
    providerMessageId: string,
  ): Promise<WhatsAppMessageRow | null>;
  insert(input: CreateWhatsAppMessageInput): Promise<WhatsAppMessageRow>;
}

export interface AuditLogsRepository {
  insert(input: CreateAuditLogInput): Promise<AuditLogRow>;
}

export interface PersistenceRepositories {
  customers: CustomersRepository;
  bookings: BookingsRepository;
  conversationSessions: ConversationSessionsRepository;
  whatsappMessages: WhatsAppMessagesRepository;
  auditLogs: AuditLogsRepository;
}
