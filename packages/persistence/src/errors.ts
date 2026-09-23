export class PersistenceConfigError extends Error {
  readonly code = "PERSISTENCE_CONFIG";

  constructor(message: string) {
    super(message);
    this.name = "PersistenceConfigError";
  }
}

export class PersistenceValidationError extends Error {
  readonly code = "PERSISTENCE_VALIDATION";

  constructor(message: string) {
    super(message);
    this.name = "PersistenceValidationError";
  }
}

export class PersistenceRepositoryError extends Error {
  readonly code = "PERSISTENCE_REPOSITORY";
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PersistenceRepositoryError";
    this.cause = cause;
  }
}

export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: string }).code;
  return code === "23505";
}
