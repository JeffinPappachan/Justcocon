import type {
  ConversationPhase,
  PreferredTimeWindow,
  TreeCountCategory,
} from "@justcocon/shared-types";
import type { BookingDraftFields } from "@justcocon/validation";

export type SubmissionStatus = "none" | "submitting" | "submitted" | "failed";

export interface WebsiteHint {
  rawPrefill?: string;
  suggestedLocation?: string;
  suggestedTreeLabel?: string;
}

export interface ConversationSubmission {
  status: SubmissionStatus;
  idempotencyKey?: string;
  bookingReference?: string;
  bookingId?: string;
}

export interface ConversationEditing {
  returnTo: "AWAITING_CONFIRMATION";
}

export interface ConversationContext {
  customerPhoneNormalized: string;
  phase: ConversationPhase;
  draft: BookingDraftFields;
  websiteHint?: WebsiteHint;
  submission: ConversationSubmission;
  editing?: ConversationEditing;
}

export function createInitialContext(
  customerPhoneNormalized: string,
): ConversationContext {
  return {
    customerPhoneNormalized,
    phase: "IDLE",
    draft: {},
    submission: { status: "none" },
  };
}

export function clearDraft(context: ConversationContext): ConversationContext {
  return {
    ...context,
    draft: {},
    websiteHint: undefined,
    editing: undefined,
    submission: { status: "none" },
  };
}

export type EditFieldTarget =
  | "name"
  | "location"
  | "trees"
  | "date"
  | "time"
  | "notes";

export function phaseForEditTarget(target: EditFieldTarget): ConversationPhase {
  switch (target) {
    case "name":
      return "COLLECTING_NAME";
    case "location":
      return "COLLECTING_LOCATION";
    case "trees":
      return "COLLECTING_TREE_COUNT";
    case "date":
      return "COLLECTING_PREFERRED_DATE";
    case "time":
      return "COLLECTING_PREFERRED_TIME";
    case "notes":
      return "COLLECTING_NOTES";
  }
}

export function applyDraftField(
  draft: BookingDraftFields,
  phase: ConversationPhase,
  value: string,
  treeCategory?: TreeCountCategory,
  timeWindow?: PreferredTimeWindow,
): BookingDraftFields {
  switch (phase) {
    case "COLLECTING_NAME":
      return { ...draft, customerName: value.trim() };
    case "COLLECTING_LOCATION":
      return { ...draft, locationText: value.trim() };
    case "COLLECTING_TREE_COUNT":
      return { ...draft, treeCountCategory: treeCategory };
    case "COLLECTING_PREFERRED_DATE":
      return { ...draft, preferredDate: value.trim() };
    case "COLLECTING_PREFERRED_TIME":
      return { ...draft, preferredTimeWindow: timeWindow };
    case "COLLECTING_NOTES":
      return { ...draft, notes: value.trim() || null };
    default:
      return draft;
  }
}
