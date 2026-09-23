import type { ConversationPhase } from "@justcocon/shared-types";
import {
  isCompleteBookingDraft,
  parsePreferredTimeWindow,
  parseTreeCountCategory,
  validateBookingDraftComplete,
  validateCustomerName,
  validateLocation,
  validateNotes,
  validatePreferredDateWithClock,
  validatePreferredTimeWindow,
  type CompleteBookingDraft,
  type DateValidationClock,
} from "@justcocon/validation";
import { formatBookingSummary } from "./conversation-summary.js";
import {
  applyDraftField,
  clearDraft,
  createInitialContext,
  phaseForEditTarget,
  type ConversationContext,
  type EditFieldTarget,
} from "./conversation-context.js";
import {
  editingMenuMessage,
  helpMessage,
  parseUserInput,
  type GlobalCommand,
} from "./conversation-commands.js";
import { NO_EFFECT, type ConversationEffect } from "./conversation-effects.js";
import {
  applyWebsiteHintToDraft,
  parseWebsiteHintFromMessage,
} from "./website-hint.js";

export type ExternalConversationEvent =
  | { type: "persistence_success"; bookingReference: string; bookingId: string }
  | { type: "persistence_failure" };

export type ConversationInput =
  | { kind: "user_message"; text: string }
  | { kind: "external_event"; event: ExternalConversationEvent };

export interface ConversationEngineDeps {
  clock: DateValidationClock;
  createIdempotencyKey: () => string;
}

export interface ConversationTurnResult {
  phase: ConversationPhase;
  context: ConversationContext;
  replies: string[];
  effects: ConversationEffect[];
}

const COLLECTION_PHASES: ConversationPhase[] = [
  "COLLECTING_NAME",
  "COLLECTING_LOCATION",
  "COLLECTING_TREE_COUNT",
  "COLLECTING_PREFERRED_DATE",
  "COLLECTING_PREFERRED_TIME",
  "COLLECTING_NOTES",
];

const CANCEL_ALLOWED: ConversationPhase[] = [
  ...COLLECTION_PHASES,
  "AWAITING_CONFIRMATION",
  "EDITING",
];

const RESTART_ALLOWED: ConversationPhase[] = [
  ...CANCEL_ALLOWED,
  "ERROR",
];

export function reduceConversation(
  context: ConversationContext,
  input: ConversationInput,
  deps: ConversationEngineDeps,
): ConversationTurnResult {
  if (input.kind === "external_event") {
    return handleExternalEvent(context, input.event);
  }

  const parsed = parseUserInput(input.text, context.phase);

  if (parsed.kind === "command") {
    return handleGlobalCommand(context, parsed.command, input.text, deps);
  }
  if (parsed.kind === "edit_field") {
    return handleEditFieldSelect(context, parsed.target);
  }

  return handleFieldText(context, input.text, deps);
}

function handleExternalEvent(
  context: ConversationContext,
  event: ExternalConversationEvent,
): ConversationTurnResult {
  if (context.phase !== "PERSISTING") {
    return unchanged(context, [
      "No persistence operation is in progress for this session.",
    ]);
  }

  if (event.type === "persistence_success") {
    return {
      phase: "COMPLETED",
      context: {
        ...context,
        phase: "COMPLETED",
        submission: {
          status: "submitted",
          idempotencyKey: context.submission.idempotencyKey,
          bookingReference: event.bookingReference,
          bookingId: event.bookingId,
        },
      },
      replies: [
        `Thank you. Your request ${event.bookingReference} was received and is pending staff review. No harvesting crew has been assigned yet.`,
      ],
      effects: [NO_EFFECT],
    };
  }

  return {
    phase: "ERROR",
    context: {
      ...context,
      phase: "ERROR",
      submission: {
        ...context.submission,
        status: "failed",
      },
    },
    replies: [
      "We could not save your booking due to a system error. Reply RETRY to try again or RESTART to begin a new booking.",
    ],
    effects: [NO_EFFECT],
  };
}

function handleGlobalCommand(
  context: ConversationContext,
  command: GlobalCommand,
  rawText: string,
  deps: ConversationEngineDeps,
): ConversationTurnResult {
  switch (command) {
    case "HELP":
      return unchanged(context, [helpMessage(context.phase)]);

    case "BOOK":
    case "START":
      return startBooking(context, rawText);

    case "CANCEL":
      return handleCancel(context);

    case "RESTART":
      return handleRestart(context);

    case "SKIP":
      return handleSkipNotes(context);

    case "EDIT":
      return handleEdit(context);

    case "CONFIRM":
      return handleConfirm(context, deps);

    case "RETRY":
      return handleRetry(context);

    default:
      return unchanged(context, [helpMessage(context.phase)]);
  }
}

function startBooking(
  context: ConversationContext,
  rawText: string,
): ConversationTurnResult {
  if (!["IDLE", "COMPLETED", "CANCELLED"].includes(context.phase)) {
    return unchanged(context, [
      "You already have a booking in progress. Reply RESTART to begin again or CANCEL to stop.",
    ]);
  }

  const hint = parseWebsiteHintFromMessage(rawText.trim());
  let next = clearDraft(context);
  next = {
    ...next,
    phase: "COLLECTING_NAME",
    websiteHint: hint,
    draft: applyWebsiteHintToDraft(hint, next.draft),
  };

  return {
    phase: next.phase,
    context: next,
    replies: [
      "Let's start your coconut harvesting request. What is your name?",
    ],
    effects: [NO_EFFECT],
  };
}

function handleCancel(context: ConversationContext): ConversationTurnResult {
  if (context.phase === "PERSISTING") {
    return unchanged(context, [
      "Your booking is being saved. Please wait — CANCEL is not available during this step.",
    ]);
  }
  if (!CANCEL_ALLOWED.includes(context.phase)) {
    return unchanged(context, ["There is no active booking to cancel."]);
  }

  const next: ConversationContext = {
    ...clearDraft(context),
    phase: "CANCELLED",
  };
  return {
    phase: "CANCELLED",
    context: next,
    replies: ["Your booking draft was cancelled. Reply BOOK to start again."],
    effects: [NO_EFFECT],
  };
}

function handleRestart(context: ConversationContext): ConversationTurnResult {
  if (context.phase === "PERSISTING") {
    return unchanged(context, [
      "Please wait while your booking is being saved. RESTART is not available now.",
    ]);
  }
  if (!RESTART_ALLOWED.includes(context.phase) && context.phase !== "IDLE") {
    if (context.phase === "COMPLETED" || context.phase === "CANCELLED") {
      return startBooking(context, "BOOK");
    }
    return unchanged(context, ["Reply BOOK to start a new booking."]);
  }

  const next: ConversationContext = {
    ...clearDraft(context),
    phase: "COLLECTING_NAME",
  };
  return {
    phase: "COLLECTING_NAME",
    context: next,
    replies: ["Starting over. What is your name?"],
    effects: [NO_EFFECT],
  };
}

function handleSkipNotes(context: ConversationContext): ConversationTurnResult {
  if (context.phase !== "COLLECTING_NOTES") {
    return unchanged(context, ["SKIP is only available when collecting notes."]);
  }
  const nextDraft = applyDraftField(context.draft, "COLLECTING_NOTES", "", undefined, undefined);
  nextDraft.notes = null;
  return goToConfirmation({
    ...context,
    draft: nextDraft,
    editing: undefined,
  });
}

function handleEdit(context: ConversationContext): ConversationTurnResult {
  if (context.phase !== "AWAITING_CONFIRMATION") {
    return unchanged(context, ["EDIT is only available on the booking summary."]);
  }
  return {
    phase: "EDITING",
    context: { ...context, phase: "EDITING" },
    replies: [editingMenuMessage()],
    effects: [NO_EFFECT],
  };
}

function handleEditFieldSelect(
  context: ConversationContext,
  target: EditFieldTarget,
): ConversationTurnResult {
  if (context.phase !== "EDITING") {
    return unchanged(context, ["Reply EDIT on the summary to change a field."]);
  }
  const phase = phaseForEditTarget(target);
  const prompts: Record<ConversationPhase, string> = {
    IDLE: "",
    COLLECTING_NAME: "What is your updated name?",
    COLLECTING_LOCATION: "What is your updated location or address?",
    COLLECTING_TREE_COUNT:
      "How many coconut trees? Reply 1–5 for ranges: 1=1-5, 2=6-10, 3=11-25, 4=26-50, 5=50+.",
    COLLECTING_PREFERRED_DATE: "What is your updated preferred date (YYYY-MM-DD)?",
    COLLECTING_PREFERRED_TIME:
      "Preferred time window: 1=Morning, 2=Afternoon, 3=Evening, 4=Flexible.",
    COLLECTING_NOTES: "Updated notes (or SKIP to leave empty):",
    AWAITING_CONFIRMATION: "",
    EDITING: "",
    PERSISTING: "",
    COMPLETED: "",
    CANCELLED: "",
    ERROR: "",
  };

  return {
    phase,
    context: {
      ...context,
      phase,
      editing: { returnTo: "AWAITING_CONFIRMATION" },
    },
    replies: [prompts[phase]],
    effects: [NO_EFFECT],
  };
}

function handleConfirm(
  context: ConversationContext,
  deps: ConversationEngineDeps,
): ConversationTurnResult {
  if (context.phase === "PERSISTING") {
    return unchanged(context, [
      "Your booking is being saved. Please wait.",
    ]);
  }
  if (context.phase === "COMPLETED") {
    const ref = context.submission.bookingReference ?? "your booking";
    return unchanged(context, [
      `Your request ${ref} is already submitted and pending staff review.`,
    ]);
  }
  if (context.phase !== "AWAITING_CONFIRMATION") {
    return unchanged(context, [
      "You can CONFIRM only after reviewing the booking summary.",
    ]);
  }

  const issues = validateBookingDraftComplete(context.draft, deps.clock);
  if (issues.length > 0 || !isCompleteBookingDraft(context.draft)) {
    return unchanged(context, [
      "Your booking is incomplete or invalid:",
      ...issues.map((issue) => `- ${issue.message}`),
    ]);
  }

  const idempotencyKey =
    context.submission.idempotencyKey ?? deps.createIdempotencyKey();
  const draft = context.draft as CompleteBookingDraft;

  return {
    phase: "PERSISTING",
    context: {
      ...context,
      phase: "PERSISTING",
      submission: {
        status: "submitting",
        idempotencyKey,
      },
    },
    replies: ["Saving your booking request…"],
    effects: [
      {
        type: "submit_booking",
        draft,
        idempotencyKey,
      },
    ],
  };
}

function handleRetry(context: ConversationContext): ConversationTurnResult {
  if (context.phase !== "ERROR") {
    return unchanged(context, ["RETRY is only available after a save error."]);
  }
  if (!isCompleteBookingDraft(context.draft)) {
    return unchanged(context, [
      "Your booking draft is no longer complete. Reply RESTART to begin again.",
    ]);
  }
  const idempotencyKey = context.submission.idempotencyKey;
  if (!idempotencyKey) {
    return unchanged(context, [
      "Cannot retry without a submission id. Reply RESTART to begin again.",
    ]);
  }

  const draft = context.draft as CompleteBookingDraft;
  return {
    phase: "PERSISTING",
    context: {
      ...context,
      phase: "PERSISTING",
      submission: {
        ...context.submission,
        status: "submitting",
        idempotencyKey,
      },
    },
    replies: ["Retrying to save your booking request…"],
    effects: [
      {
        type: "submit_booking",
        draft,
        idempotencyKey,
      },
    ],
  };
}

function handleFieldText(
  context: ConversationContext,
  text: string,
  deps: ConversationEngineDeps,
): ConversationTurnResult {
  const phase = context.phase;
  if (!COLLECTION_PHASES.includes(phase)) {
    return unchanged(context, [
      "Please use a command or follow the current step.",
      helpMessage(phase),
    ]);
  }

  let validationError: string | undefined;
  let nextDraft = context.draft;

  switch (phase) {
    case "COLLECTING_NAME": {
      const issues = validateCustomerName(text);
      if (issues.length) {
        validationError = issues[0]!.message;
        break;
      }
      nextDraft = applyDraftField(nextDraft, phase, text);
      break;
    }
    case "COLLECTING_LOCATION": {
      const issues = validateLocation(text);
      if (issues.length) {
        validationError = issues[0]!.message;
        break;
      }
      nextDraft = applyDraftField(nextDraft, phase, text);
      break;
    }
    case "COLLECTING_TREE_COUNT": {
      const category = parseTreeCountCategory(text);
      if (!category) {
        validationError =
          "Tree count is invalid. Reply 1–5 for ranges: 1=1-5, 2=6-10, 3=11-25, 4=26-50, 5=50+.";
        break;
      }
      nextDraft = applyDraftField(nextDraft, phase, text, category);
      break;
    }
    case "COLLECTING_PREFERRED_DATE": {
      const issues = validatePreferredDateWithClock(text, deps.clock);
      if (issues.length) {
        validationError = issues[0]!.message;
        break;
      }
      nextDraft = applyDraftField(nextDraft, phase, text);
      break;
    }
    case "COLLECTING_PREFERRED_TIME": {
      const issues = validatePreferredTimeWindow(text);
      if (issues.length) {
        validationError = issues[0]!.message;
        break;
      }
      const window = parsePreferredTimeWindow(text)!;
      nextDraft = applyDraftField(nextDraft, phase, text, undefined, window);
      break;
    }
    case "COLLECTING_NOTES": {
      const issues = validateNotes(text);
      if (issues.length) {
        validationError = issues[0]!.message;
        break;
      }
      nextDraft = applyDraftField(nextDraft, phase, text);
      break;
    }
    default:
      break;
  }

  if (validationError) {
    return unchanged(context, [validationError]);
  }

  if (context.editing?.returnTo === "AWAITING_CONFIRMATION") {
    return goToConfirmation({
      ...context,
      draft: nextDraft,
      editing: undefined,
    });
  }

  const nextPhase = nextPhaseAfterCollection(phase);
  const nextContext: ConversationContext = {
    ...context,
    draft: nextDraft,
    phase: nextPhase,
  };

  if (nextPhase === "AWAITING_CONFIRMATION") {
    return goToConfirmation(nextContext);
  }

  return {
    phase: nextPhase,
    context: nextContext,
    replies: [promptForPhase(nextPhase)],
    effects: [NO_EFFECT],
  };
}

function goToConfirmation(context: ConversationContext): ConversationTurnResult {
  const summary = formatBookingSummary(context.draft);
  return {
    phase: "AWAITING_CONFIRMATION",
    context: { ...context, phase: "AWAITING_CONFIRMATION", editing: undefined },
    replies: [summary],
    effects: [NO_EFFECT],
  };
}

function nextPhaseAfterCollection(phase: ConversationPhase): ConversationPhase {
  switch (phase) {
    case "COLLECTING_NAME":
      return "COLLECTING_LOCATION";
    case "COLLECTING_LOCATION":
      return "COLLECTING_TREE_COUNT";
    case "COLLECTING_TREE_COUNT":
      return "COLLECTING_PREFERRED_DATE";
    case "COLLECTING_PREFERRED_DATE":
      return "COLLECTING_PREFERRED_TIME";
    case "COLLECTING_PREFERRED_TIME":
      return "COLLECTING_NOTES";
    case "COLLECTING_NOTES":
      return "AWAITING_CONFIRMATION";
    default:
      return phase;
  }
}

function promptForPhase(phase: ConversationPhase): string {
  switch (phase) {
    case "COLLECTING_NAME":
      return "What is your name?";
    case "COLLECTING_LOCATION":
      return "What is your location or full address?";
    case "COLLECTING_TREE_COUNT":
      return "Approximate coconut tree count? Reply: 1=1-5, 2=6-10, 3=11-25, 4=26-50, 5=50+.";
    case "COLLECTING_PREFERRED_DATE":
      return "Preferred harvesting date (YYYY-MM-DD)?";
    case "COLLECTING_PREFERRED_TIME":
      return "Preferred time window: 1=Morning, 2=Afternoon, 3=Evening, 4=Flexible.";
    case "COLLECTING_NOTES":
      return "Optional notes (access, timing). Reply SKIP to omit.";
    default:
      return helpMessage(phase);
  }
}

function unchanged(
  context: ConversationContext,
  replies: string[],
): ConversationTurnResult {
  return {
    phase: context.phase,
    context,
    replies,
    effects: [NO_EFFECT],
  };
}

