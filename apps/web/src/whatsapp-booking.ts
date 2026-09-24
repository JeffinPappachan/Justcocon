export const SERVICE_AREA = "Kozhikode (Calicut) & surrounding areas";

export const TREE_OPTIONS = [
  "1–5 trees",
  "6–10 trees",
  "11–25 trees",
  "26–50 trees",
  "More than 50 trees",
] as const;

export function digitsOnlyPhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function buildWebsiteBookingPrefill(input: {
  location: string;
  trees: string;
}): string {
  return [
    "BOOK",
    `Location: ${input.location.trim()}`,
    `Trees: ${input.trees.trim()}`,
  ].join("\n");
}

export function buildWhatsAppBookingUrl(input: {
  phone: string;
  location: string;
  trees: string;
}): string | null {
  const digits = digitsOnlyPhone(input.phone);
  if (digits.length < 10) {
    return null;
  }
  const text = encodeURIComponent(
    buildWebsiteBookingPrefill({
      location: input.location,
      trees: input.trees,
    }),
  );
  return `https://wa.me/${digits}?text=${text}`;
}
