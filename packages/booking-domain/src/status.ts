import type { BookingStatus } from "@justcocon/shared-types";

export const BOOKING_STATUS_ORDER: Record<BookingStatus, number> = {
  NEW: 0,
  PENDING_STAFF_REVIEW: 1,
  CONFIRMED_BY_STAFF: 2,
  SCHEDULED: 3,
  IN_PROGRESS: 4,
  COMPLETED: 5,
  RESCHEDULE_REQUESTED: 1,
  CANCEL_REQUESTED: 1,
  CANCELLED: 6,
  NEEDS_HUMAN_REVIEW: 1,
};

export const VALID_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> =
  {
    NEW: ["PENDING_STAFF_REVIEW", "NEEDS_HUMAN_REVIEW"],
    PENDING_STAFF_REVIEW: [
      "CONFIRMED_BY_STAFF",
      "RESCHEDULE_REQUESTED",
      "CANCEL_REQUESTED",
      "NEEDS_HUMAN_REVIEW",
    ],
    CONFIRMED_BY_STAFF: ["SCHEDULED", "CANCEL_REQUESTED", "NEEDS_HUMAN_REVIEW"],
    RESCHEDULE_REQUESTED: [
      "PENDING_STAFF_REVIEW",
      "CANCEL_REQUESTED",
      "NEEDS_HUMAN_REVIEW",
    ],
    CANCEL_REQUESTED: ["CANCELLED", "NEEDS_HUMAN_REVIEW"],
    SCHEDULED: ["IN_PROGRESS", "RESCHEDULE_REQUESTED", "CANCEL_REQUESTED"],
    IN_PROGRESS: ["COMPLETED", "CANCEL_REQUESTED"],
    COMPLETED: [],
    CANCELLED: [],
    NEEDS_HUMAN_REVIEW: [
      "PENDING_STAFF_REVIEW",
      "CONFIRMED_BY_STAFF",
      "CANCEL_REQUESTED",
    ],
  };

export function isValidStatusTransition(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
