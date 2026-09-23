export type BookingStatus =
  | "NEW"
  | "PENDING_STAFF_REVIEW"
  | "CONFIRMED_BY_STAFF"
  | "RESCHEDULE_REQUESTED"
  | "CANCEL_REQUESTED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NEEDS_HUMAN_REVIEW";

export type TreeCountCategory = "1-5" | "6-10" | "11-25" | "26-50" | "50+";

/** WhatsApp conversation FSM phase (not booking lifecycle status). */
export type ConversationPhase =
  | "IDLE"
  | "COLLECTING_NAME"
  | "COLLECTING_LOCATION"
  | "COLLECTING_TREE_COUNT"
  | "COLLECTING_PREFERRED_DATE"
  | "COLLECTING_PREFERRED_TIME"
  | "COLLECTING_NOTES"
  | "AWAITING_CONFIRMATION"
  | "EDITING"
  | "PERSISTING"
  | "COMPLETED"
  | "CANCELLED"
  | "ERROR";

export type PreferredTimeWindow =
  | "MORNING"
  | "AFTERNOON"
  | "EVENING"
  | "FLEXIBLE";

/**
 * @deprecated Use ConversationPhase. No repo consumers outside shared-types.
 */
export type ConversationState =
  | "INIT"
  | "AWAITING_LOCATION"
  | "AWAITING_TREE_COUNT"
  | "AWAITING_DATE"
  | "AWAITING_CONFIRMATION"
  | "PENDING_STAFF_REVIEW";

export type MessageDirection = "incoming" | "outgoing";
export type MessageType = "text" | "template" | "system";
export type EnvironmentName = "development" | "staging" | "production";
