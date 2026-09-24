import type {
  ConversationContext,
  ConversationTurnResult,
} from "@justcocon/booking-domain";
import { planWhatsAppOutboundMessages } from "@justcocon/booking-domain";
import type { DateValidationClock } from "@justcocon/validation";
import type { WhatsAppListRow, WhatsAppOutboundMessage } from "./outbound-types.js";

type ConversationPhase = ConversationContext["phase"];

function textMessages(replies: readonly string[]): WhatsAppOutboundMessage[] {
  return planWhatsAppOutboundMessages(replies).map((body) => ({
    kind: "text",
    body,
  }));
}

function addDaysIso(clock: DateValidationClock, offsetDays: number): string {
  const base = new Date(`${clock.todayIsoDate()}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

function entryNativeCardBody(phase: ConversationPhase): string {
  if (phase === "AWAITING_START") {
    return "Tap Start to continue.";
  }
  if (phase === "AWAITING_MENU") {
    return "Schedule a harvest or return to welcome.";
  }
  return "Choose an option.";
}

function entryNativeFlowForPhase(
  phase: ConversationPhase,
): Extract<WhatsAppOutboundMessage, { kind: "native_flow" }> | null {
  if (phase === "AWAITING_START") {
    return {
      kind: "native_flow",
      title: "JustCocon",
      body: entryNativeCardBody(phase),
      footer: "JustCocon",
      buttons: [{ buttonId: "btn_start", displayText: "Start" }],
    };
  }
  if (phase === "AWAITING_MENU") {
    return {
      kind: "native_flow",
      title: "JustCocon",
      body: entryNativeCardBody(phase),
      footer: "JustCocon",
      buttons: [
        { buttonId: "btn_book", displayText: "Book" },
        { buttonId: "btn_close", displayText: "Close" },
      ],
    };
  }
  return null;
}

function nativeFlowFromList(
  list: Extract<WhatsAppOutboundMessage, { kind: "list" }>,
): WhatsAppOutboundMessage | null {
  if (list.rows.length === 0 || list.rows.length > 3) {
    return null;
  }
  return {
    kind: "native_flow",
    title: list.title,
    body: list.description,
    footer: "JustCocon",
    buttons: list.rows.map((row) => ({
      buttonId: row.rowId,
      displayText: row.title,
    })),
  };
}

function listForPhase(
  phase: ConversationPhase,
  clock: DateValidationClock,
): Extract<WhatsAppOutboundMessage, { kind: "list" }> | null {
  switch (phase) {
    case "COLLECTING_TREE_COUNT":
      return {
        kind: "list",
        title: "Tree count",
        description: "Select your approximate coconut tree count.",
        buttonText: "Select range",
        rows: [
          { rowId: "trees_1", title: "1–5 trees", description: "Small plot" },
          { rowId: "trees_2", title: "6–10 trees", description: "Medium plot" },
          { rowId: "trees_3", title: "11–25 trees", description: "Large plot" },
          { rowId: "trees_4", title: "26–50 trees", description: "Very large plot" },
          { rowId: "trees_5", title: "50+ trees", description: "Plantation scale" },
        ],
      };
    case "COLLECTING_PREFERRED_DATE": {
      const rows: WhatsAppListRow[] = [];
      for (let i = 1; i <= 12; i++) {
        const iso = addDaysIso(clock, i);
        rows.push({
          rowId: `date_${iso}`,
          title: iso,
          description: i === 1 ? "Tomorrow" : `In ${i} days`,
        });
      }
      return {
        kind: "list",
        title: "Preferred date",
        description: "Choose a harvesting date.",
        buttonText: "Pick date",
        rows,
      };
    }
    case "COLLECTING_PREFERRED_TIME":
      return {
        kind: "list",
        title: "Preferred time",
        description: "When should the crew visit?",
        buttonText: "Select time",
        rows: [
          { rowId: "time_1", title: "Morning", description: "Before noon" },
          { rowId: "time_2", title: "Afternoon", description: "12pm – 5pm" },
          { rowId: "time_3", title: "Evening", description: "After 5pm" },
          { rowId: "time_4", title: "Flexible", description: "Any time works" },
        ],
      };
    case "COLLECTING_NOTES":
      return {
        kind: "list",
        title: "Access notes",
        description: "Optional: gate, path, or call-on-arrival details.",
        buttonText: "Options",
        rows: [
          {
            rowId: "row_skip_notes",
            title: "Skip notes",
            description: "No extra access instructions",
          },
        ],
      };
    case "AWAITING_CONFIRMATION":
      return {
        kind: "list",
        title: "Submit booking",
        description: "Review the summary above, then choose an action.",
        buttonText: "Actions",
        rows: [
          {
            rowId: "row_confirm",
            title: "Confirm booking",
            description: "Submit for staff review",
          },
          {
            rowId: "row_edit",
            title: "Edit a field",
            description: "Change name, location, date, etc.",
          },
        ],
      };
    default:
      return null;
  }
}

export function planWhatsAppOutboundInteractiveMessages(
  turn: ConversationTurnResult,
  options: {
    interactiveEnabled: boolean;
    clock: DateValidationClock;
    useNativeButtons?: boolean;
  },
): WhatsAppOutboundMessage[] {
  const textParts = textMessages(turn.replies);
  if (!options.interactiveEnabled) {
    return textParts;
  }

  const entryNative = entryNativeFlowForPhase(turn.phase);
  if (entryNative) {
    // Plain text first: personal WhatsApp often drops interactive-only messages on mobile.
    return [...textParts, entryNative];
  }

  const list = listForPhase(turn.phase, options.clock);
  if (!list) {
    return textParts;
  }

  const promptLike = turn.replies.some((r) =>
    /What is your|How many coconut|Preferred harvesting date|Preferred time:|Optional access notes|Please review your booking|Choose an option|Tap Start|Tap Book/i.test(
      r,
    ),
  );

  if (!promptLike) {
    return textParts;
  }

  const nativeFromList = nativeFlowFromList(list);
  if (nativeFromList) {
    return [...textParts, nativeFromList];
  }

  return [...textParts, list];
}
