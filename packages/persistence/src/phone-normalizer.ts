import { PersistenceValidationError } from "./errors.js";

export interface NormalizeWhatsAppPhoneResult {
  normalized: string;
  display: string;
}

const DEFAULT_COUNTRY_CALLING_CODE = "91";

/** Normalize provider/user phone identity to E.164 (MVP: India +91 default). */
export function normalizeWhatsAppPhone(
  input: string,
  options: { defaultCountryCallingCode?: string } = {},
): NormalizeWhatsAppPhoneResult {
  const defaultCc = options.defaultCountryCallingCode ?? DEFAULT_COUNTRY_CALLING_CODE;
  const trimmed = input.trim();
  if (!trimmed) {
    throw new PersistenceValidationError("WhatsApp phone number is required.");
  }

  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  }
  digits = digits.replace(/\D/g, "");

  if (!digits) {
    throw new PersistenceValidationError("WhatsApp phone number has no digits.");
  }

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.length === 10 && defaultCc === "91") {
    digits = `${defaultCc}${digits}`;
  } else if (
    digits.length === 11 &&
    digits.startsWith("0") &&
    defaultCc === "91"
  ) {
    digits = `${defaultCc}${digits.slice(1)}`;
  }

  if (digits.length < 11 || digits.length > 15) {
    throw new PersistenceValidationError(
      "WhatsApp phone number length is invalid after normalization.",
    );
  }

  const normalized = `+${digits}`;
  return { normalized, display: normalized };
}
