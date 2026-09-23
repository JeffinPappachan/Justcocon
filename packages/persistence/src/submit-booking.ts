import { generateBookingReference } from "@justcocon/booking-domain";
import {
  isCompleteBookingDraft,
  validateBookingDraftComplete,
  type CompleteBookingDraft,
  type DateValidationClock,
} from "@justcocon/validation";
import {
  PersistenceRepositoryError,
  PersistenceValidationError,
  isUniqueViolation,
} from "./errors.js";
import { normalizeWhatsAppPhone } from "./phone-normalizer.js";
import type { PersistenceRepositories } from "./repositories/interfaces.js";
import type { BookingRow, CreateBookingInput } from "./types.js";

export interface SubmitBookingInput {
  draft: CompleteBookingDraft;
  idempotencyKey: string;
  whatsappIdentity: string;
  conversationSessionId?: string;
  environment?: "staging" | "development" | "production";
  source?: string;
}

export interface SubmitBookingResult {
  bookingId: string;
  bookingReference: string;
  customerId: string;
  status: "PENDING_STAFF_REVIEW";
  idempotentReplay: boolean;
}

export interface SubmitBookingServiceDeps {
  repos: PersistenceRepositories;
  clock: DateValidationClock;
  createReferenceSuffix?: () => string;
}

function defaultReferenceSuffix(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
}

function assertValidSubmitInput(input: SubmitBookingInput, clock: DateValidationClock): void {
  if (!input.idempotencyKey.trim()) {
    throw new PersistenceValidationError("Idempotency key is required.");
  }
  if (!isCompleteBookingDraft(input.draft)) {
    throw new PersistenceValidationError("Booking draft is incomplete.");
  }
  const issues = validateBookingDraftComplete(input.draft, clock);
  if (issues.length > 0) {
    throw new PersistenceValidationError(
      issues.map((i) => i.message).join("; "),
    );
  }
}

async function resolveCustomer(
  repos: PersistenceRepositories,
  draft: CompleteBookingDraft,
  phone: { normalized: string; display: string },
) {
  const existing = await repos.customers.findByNormalizedPhone(phone.normalized);
  if (existing) {
    if (existing.full_name !== draft.customerName.trim()) {
      return repos.customers.updateFullName(existing.id, draft.customerName.trim());
    }
    return existing;
  }
  try {
    return await repos.customers.insert({
      full_name: draft.customerName.trim(),
      whatsapp_number: phone.display,
      normalized_whatsapp_number: phone.normalized,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await repos.customers.findByNormalizedPhone(phone.normalized);
      if (raced) return raced;
    }
    throw error;
  }
}

async function insertBookingIdempotent(
  repos: PersistenceRepositories,
  input: CreateBookingInput,
): Promise<{ row: BookingRow; idempotentReplay: boolean }> {
  const existing = await repos.bookings.findByIdempotencyKey(
    input.submission_idempotency_key,
  );
  if (existing) {
    return { row: existing, idempotentReplay: true };
  }

  try {
    const row = await repos.bookings.insert(input);
    return { row, idempotentReplay: false };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await repos.bookings.findByIdempotencyKey(
        input.submission_idempotency_key,
      );
      if (raced) return { row: raced, idempotentReplay: true };
    }
    throw new PersistenceRepositoryError("Failed to insert booking.", error);
  }
}

export async function submitBooking(
  input: SubmitBookingInput,
  deps: SubmitBookingServiceDeps,
): Promise<SubmitBookingResult> {
  assertValidSubmitInput(input, deps.clock);

  const idempotencyKey = input.idempotencyKey.trim();
  const existingBooking = await deps.repos.bookings.findByIdempotencyKey(idempotencyKey);
  if (existingBooking) {
    if (existingBooking.status !== "PENDING_STAFF_REVIEW") {
      throw new PersistenceRepositoryError(
        `Unexpected booking status on idempotent replay: ${existingBooking.status}`,
      );
    }
    return {
      bookingId: existingBooking.id,
      bookingReference: existingBooking.booking_reference,
      customerId: existingBooking.customer_id,
      status: "PENDING_STAFF_REVIEW",
      idempotentReplay: true,
    };
  }

  const phone = normalizeWhatsAppPhone(input.whatsappIdentity);
  const customer = await resolveCustomer(deps.repos, input.draft, phone);

  const suffix = (deps.createReferenceSuffix ?? defaultReferenceSuffix)();
  const bookingReference = generateBookingReference(new Date(), suffix);
  const environment = input.environment ?? "staging";
  const source = input.source ?? "whatsapp";

  const { row: booking, idempotentReplay } = await insertBookingIdempotent(
    deps.repos,
    {
      booking_reference: bookingReference,
      customer_id: customer.id,
      location_text: input.draft.locationText.trim(),
      tree_count_category: input.draft.treeCountCategory,
      preferred_date: input.draft.preferredDate,
      preferred_time_window: input.draft.preferredTimeWindow,
      customer_notes: input.draft.notes,
      status: "PENDING_STAFF_REVIEW",
      source,
      environment,
      submission_idempotency_key: idempotencyKey,
    },
  );

  if (booking.status !== "PENDING_STAFF_REVIEW") {
    throw new PersistenceRepositoryError(
      `Unexpected booking status after submit: ${booking.status}`,
    );
  }

  if (idempotentReplay) {
    return {
      bookingId: booking.id,
      bookingReference: booking.booking_reference,
      customerId: booking.customer_id,
      status: "PENDING_STAFF_REVIEW",
      idempotentReplay: true,
    };
  }

  if (input.conversationSessionId) {
    await deps.repos.conversationSessions.linkBooking({
      sessionId: input.conversationSessionId,
      bookingId: booking.id,
      submissionIdempotencyKey: idempotencyKey,
      currentPhase: "COMPLETED",
    });
  }

  await deps.repos.whatsappMessages.insert({
    whatsapp_number: phone.display,
    normalized_whatsapp_number: phone.normalized,
    direction: "outgoing",
    message_type: "system",
    message_text: `Booking ${booking.booking_reference} submitted (${booking.status}).`,
    conversation_session_id: input.conversationSessionId ?? null,
  });

  await deps.repos.auditLogs.insert({
    entity_type: "booking",
    entity_id: booking.id,
    action: "booking_submitted",
    actor_type: "system",
    metadata: {
      customer_id: customer.id,
      submission_idempotency_key: idempotencyKey,
      booking_reference: booking.booking_reference,
    },
  });

  return {
    bookingId: booking.id,
    bookingReference: booking.booking_reference,
    customerId: customer.id,
    status: "PENDING_STAFF_REVIEW",
    idempotentReplay: false,
  };
}
