/** Injectable calendar for date validation (avoids hard-coded system clock in tests). */
export interface DateValidationClock {
  /** Today's date in YYYY-MM-DD (business timezone). */
  todayIsoDate(): string;
}

export function createSystemClock(timeZone = "Asia/Kolkata"): DateValidationClock {
  return {
    todayIsoDate() {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    },
  };
}
