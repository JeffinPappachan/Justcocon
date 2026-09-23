import type { CompleteBookingDraft } from "@justcocon/validation";
import type { BookingRequest } from "./booking.js";
import { createInitialBooking } from "./booking.js";

export function buildBookingFromDraft(
  draft: CompleteBookingDraft,
  ids: { id: string; customerPhoneNormalized: string },
): BookingRequest {
  const base = createInitialBooking({
    id: ids.id,
    customerName: draft.customerName,
    location: draft.locationText,
    treeCountCategory: draft.treeCountCategory,
    preferredDate: draft.preferredDate,
    preferredTimeWindow: draft.preferredTimeWindow,
    notes: draft.notes ?? undefined,
  });

  if (base.status !== "PENDING_STAFF_REVIEW") {
    throw new Error("Customer confirmation must not set staff-confirmed status.");
  }

  return base;
}
