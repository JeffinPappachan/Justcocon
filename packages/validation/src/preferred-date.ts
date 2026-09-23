import type { ValidationIssue } from "./index.js";
import type { DateValidationClock } from "./clock.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validatePreferredDateWithClock(
  value: string,
  clock: DateValidationClock,
  maxDaysAhead = 90,
): ValidationIssue[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [{ field: "preferredDate", message: "Preferred date is required." }];
  }
  if (!ISO_DATE.test(trimmed)) {
    return [
      {
        field: "preferredDate",
        message: "Preferred date must be YYYY-MM-DD.",
      },
    ];
  }
  const today = clock.todayIsoDate();
  if (trimmed < today) {
    return [
      { field: "preferredDate", message: "Preferred date cannot be in the past." },
    ];
  }
  const maxDate = addDays(today, maxDaysAhead);
  if (trimmed > maxDate) {
    return [
      {
        field: "preferredDate",
        message: `Preferred date must be within ${maxDaysAhead} days.`,
      },
    ];
  }
  return [];
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
