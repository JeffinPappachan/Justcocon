import type {
  PreferredTimeWindow,
  TreeCountCategory,
} from "@justcocon/shared-types";
import type { ValidationIssue } from "./fields.js";
import type { DateValidationClock } from "./clock.js";
import {
  validateCustomerName,
  validateLocation,
  validateNotes,
} from "./fields.js";
import { validatePreferredDateWithClock } from "./preferred-date.js";
import { parsePreferredTimeWindow } from "./time-window.js";
import { parseTreeCountCategory } from "./tree-count-input.js";

export interface BookingDraftFields {
  customerName?: string;
  locationText?: string;
  treeCountCategory?: TreeCountCategory;
  preferredDate?: string;
  preferredTimeWindow?: PreferredTimeWindow;
  notes?: string | null;
}

export interface CompleteBookingDraft {
  customerName: string;
  locationText: string;
  treeCountCategory: TreeCountCategory;
  preferredDate: string;
  preferredTimeWindow: PreferredTimeWindow;
  notes: string | null;
}

export function isCompleteBookingDraft(
  draft: BookingDraftFields,
): draft is CompleteBookingDraft {
  return (
    typeof draft.customerName === "string" &&
    typeof draft.locationText === "string" &&
    typeof draft.treeCountCategory === "string" &&
    typeof draft.preferredDate === "string" &&
    typeof draft.preferredTimeWindow === "string"
  );
}

export function validateBookingDraftComplete(
  draft: BookingDraftFields,
  clock: DateValidationClock,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (draft.customerName !== undefined) {
    issues.push(...validateCustomerName(draft.customerName));
  } else {
    issues.push({ field: "customerName", message: "Customer name is required." });
  }
  if (draft.locationText !== undefined) {
    issues.push(...validateLocation(draft.locationText));
  } else {
    issues.push({ field: "location", message: "Location is required." });
  }
  if (!draft.treeCountCategory) {
    issues.push({
      field: "treeCountCategory",
      message: "Tree count category is required.",
    });
  } else if (!parseTreeCountCategory(draft.treeCountCategory)) {
    issues.push({
      field: "treeCountCategory",
      message: "Tree count category is invalid.",
    });
  }
  if (draft.preferredDate !== undefined) {
    issues.push(...validatePreferredDateWithClock(draft.preferredDate, clock));
  } else {
    issues.push({
      field: "preferredDate",
      message: "Preferred date is required.",
    });
  }
  if (!draft.preferredTimeWindow) {
    issues.push({
      field: "preferredTimeWindow",
      message: "Preferred time window is required.",
    });
  } else if (!parsePreferredTimeWindow(draft.preferredTimeWindow)) {
    issues.push({
      field: "preferredTimeWindow",
      message: "Preferred time window is invalid.",
    });
  }
  issues.push(...validateNotes(draft.notes ?? undefined));
  return issues;
}
