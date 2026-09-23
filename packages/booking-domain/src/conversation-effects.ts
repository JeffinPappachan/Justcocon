import type { CompleteBookingDraft } from "@justcocon/validation";

export type ConversationEffect =
  | { type: "none" }
  | {
      type: "submit_booking";
      draft: CompleteBookingDraft;
      idempotencyKey: string;
    };

export const NO_EFFECT: ConversationEffect = { type: "none" };
