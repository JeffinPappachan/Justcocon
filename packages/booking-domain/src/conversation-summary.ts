import type { BookingDraftFields } from "@justcocon/validation";
import { isCompleteBookingDraft } from "@justcocon/validation";

export const BOOKING_SUMMARY_HEADER = "Please review your booking:";

export function isBookingSummaryMessage(text: string): boolean {
  return text.trimStart().startsWith(BOOKING_SUMMARY_HEADER);
}

export function formatBookingSummary(draft: BookingDraftFields): string {
  if (!isCompleteBookingDraft(draft)) {
    return "Summary is incomplete. Please provide the missing details.";
  }
  const notes =
    draft.notes && draft.notes.length > 0 ? draft.notes : "(none)";
  return [
    BOOKING_SUMMARY_HEADER,
    `Name: ${draft.customerName}`,
    `Location: ${draft.locationText}`,
    `Trees: ${draft.treeCountCategory}`,
    `Date: ${draft.preferredDate}`,
    `Time: ${draft.preferredTimeWindow}`,
    `Notes: ${notes}`,
    "",
    "Reply CONFIRM to submit (pending staff review — no crew assigned yet).",
    "Reply EDIT to change a field.",
  ].join("\n");
}
