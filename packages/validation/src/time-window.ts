import type { PreferredTimeWindow } from "@justcocon/shared-types";
import type { ValidationIssue } from "./fields.js";

const VALID: PreferredTimeWindow[] = [
  "MORNING",
  "AFTERNOON",
  "EVENING",
  "FLEXIBLE",
];

const LABEL_MAP: Record<string, PreferredTimeWindow> = {
  "1": "MORNING",
  morning: "MORNING",
  "2": "AFTERNOON",
  afternoon: "AFTERNOON",
  "3": "EVENING",
  evening: "EVENING",
  "4": "FLEXIBLE",
  flexible: "FLEXIBLE",
  anytime: "FLEXIBLE",
};

export function parsePreferredTimeWindow(
  value: string,
): PreferredTimeWindow | null {
  const key = value.trim().toLowerCase();
  if (!key) return null;
  const upper = value.trim().toUpperCase();
  if (VALID.includes(upper as PreferredTimeWindow)) {
    return upper as PreferredTimeWindow;
  }
  return LABEL_MAP[key] ?? null;
}

export function validatePreferredTimeWindow(value: string): ValidationIssue[] {
  if (!parsePreferredTimeWindow(value)) {
    return [
      {
        field: "preferredTimeWindow",
        message:
          "Preferred time is invalid. Reply 1 Morning, 2 Afternoon, 3 Evening, or 4 Flexible.",
      },
    ];
  }
  return [];
}
