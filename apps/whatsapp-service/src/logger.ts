export type LogLevel = "debug" | "info" | "warn" | "error";

export function createLogger(scope: string, level: LogLevel = "info") {
  return {
    debug: (message: string, meta?: Record<string, unknown>) =>
      log("debug", scope, message, meta),
    info: (message: string, meta?: Record<string, unknown>) =>
      log("info", scope, message, meta),
    warn: (message: string, meta?: Record<string, unknown>) =>
      log("warn", scope, message, meta),
    error: (message: string, meta?: Record<string, unknown>) =>
      log("error", scope, message, meta),
  };
}

function log(
  level: LogLevel,
  scope: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  const payload = {
    level,
    scope,
    message,
    ...(meta ? { meta } : {}),
  };

  const serialized = JSON.stringify(payload);
  console.log(serialized);
}
