import type { WebsiteHint } from "./conversation-context.js";

/** Parses optional website prefill; never treated as validated booking data. */
export function parseWebsiteHintFromMessage(text: string): WebsiteHint | undefined {
  const raw = text.trim();
  if (!raw) return undefined;

  const hint: WebsiteHint = { rawPrefill: raw };
  const locationMatch = raw.match(/location:\s*(.+)/i);
  const treesMatch = raw.match(/trees:\s*(.+)/i);
  if (locationMatch?.[1]) {
    hint.suggestedLocation = locationMatch[1].trim();
  }
  if (treesMatch?.[1]) {
    hint.suggestedTreeLabel = treesMatch[1].trim();
  }
  if (!hint.suggestedLocation && !hint.suggestedTreeLabel) {
    return undefined;
  }
  return hint;
}

export function applyWebsiteHintToDraft(
  hint: WebsiteHint | undefined,
  draft: import("@justcocon/validation").BookingDraftFields,
): import("@justcocon/validation").BookingDraftFields {
  if (!hint) return draft;
  const next = { ...draft };
  if (hint.suggestedLocation && !next.locationText) {
    next.locationText = hint.suggestedLocation;
  }
  return next;
}
