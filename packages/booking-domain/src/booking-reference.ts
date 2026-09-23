/** Generates a human-readable booking reference (pure, no I/O). */
export function generateBookingReference(
  now: Date = new Date(),
  suffix = "0001",
): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `JC-${y}${m}${d}-${suffix}`;
}
