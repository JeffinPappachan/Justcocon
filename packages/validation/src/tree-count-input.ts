import type { TreeCountCategory } from "@justcocon/shared-types";

const LABEL_MAP: Record<string, TreeCountCategory> = {
  "1": "1-5",
  "1-5": "1-5",
  "1–5": "1-5",
  "1-5 trees": "1-5",
  "1–5 trees": "1-5",
  "2": "6-10",
  "6-10": "6-10",
  "6–10": "6-10",
  "6-10 trees": "6-10",
  "3": "11-25",
  "11-25": "11-25",
  "11–25": "11-25",
  "11-25 trees": "11-25",
  "4": "26-50",
  "26-50": "26-50",
  "26–50": "26-50",
  "26-50 trees": "26-50",
  "5": "50+",
  "50+": "50+",
  "more than 50 trees": "50+",
  "50+ trees": "50+",
};

export function parseTreeCountCategory(
  value: string,
): TreeCountCategory | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (LABEL_MAP[lower]) return LABEL_MAP[lower];
  if (LABEL_MAP[trimmed]) return LABEL_MAP[trimmed];
  const valid: TreeCountCategory[] = ["1-5", "6-10", "11-25", "26-50", "50+"];
  if (valid.includes(trimmed as TreeCountCategory)) {
    return trimmed as TreeCountCategory;
  }
  return null;
}
