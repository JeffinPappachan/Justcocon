export type ValidationIssue = {
  field: string;
  message: string;
};

export function validateCustomerName(value: string): ValidationIssue[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [{ field: "customerName", message: "Customer name is required." }];
  }
  if (trimmed.length < 2) {
    return [
      {
        field: "customerName",
        message: "Customer name must be at least 2 characters.",
      },
    ];
  }
  return [];
}

export function validateLocation(value: string): ValidationIssue[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [{ field: "location", message: "Location is required." }];
  }
  return [];
}

export function validateTreeCountCategory(value: string): ValidationIssue[] {
  const valid = ["1-5", "6-10", "11-25", "26-50", "50+"];
  if (!valid.includes(value)) {
    return [
      {
        field: "treeCountCategory",
        message: "Tree count category is invalid.",
      },
    ];
  }
  return [];
}

export function validatePreferredDate(value: string): ValidationIssue[] {
  if (!value) {
    return [{ field: "preferredDate", message: "Preferred date is required." }];
  }
  return [];
}

export function validateNotes(value?: string): ValidationIssue[] {
  if (!value) return [];
  if (value.length > 500) {
    return [
      { field: "notes", message: "Notes must be 500 characters or fewer." },
    ];
  }
  return [];
}
