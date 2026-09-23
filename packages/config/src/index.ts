export type EnvironmentName = "development" | "staging" | "production";

export interface AppConfig {
  APP_ENV: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  DATABASE_URL?: string;
  WHATSAPP_PROVIDER: string;
  WHATSAPP_AUTH_DIRECTORY?: string;
  BOOKING_MODE: string;
  LOG_LEVEL: string;
}

export function getEnvironmentName(value?: string): EnvironmentName {
  const current = (value ?? process.env.APP_ENV ?? "staging").toLowerCase();

  if (current === "production") return "production";
  if (current === "development") return "development";
  return "staging";
}

export function getSafeConfig(
  raw: Record<string, string | undefined> = process.env,
): AppConfig {
  const config: AppConfig = {
    APP_ENV: raw.APP_ENV ?? "staging",
    SUPABASE_URL: raw.SUPABASE_URL,
    SUPABASE_ANON_KEY: raw.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: raw.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: raw.DATABASE_URL,
    WHATSAPP_PROVIDER: raw.WHATSAPP_PROVIDER ?? "baileys",
    WHATSAPP_AUTH_DIRECTORY: raw.WHATSAPP_AUTH_DIRECTORY,
    BOOKING_MODE: raw.BOOKING_MODE ?? "demo",
    LOG_LEVEL: raw.LOG_LEVEL ?? "info",
  };

  return config;
}

export function validateRequiredConfig(
  raw: Record<string, string | undefined> = process.env,
): string[] {
  const missing: string[] = [];

  const requiredKeys = [
    "APP_ENV",
    "WHATSAPP_PROVIDER",
    "BOOKING_MODE",
    "LOG_LEVEL",
  ];

  for (const key of requiredKeys) {
    if (!raw[key]) {
      missing.push(key);
    }
  }

  return missing;
}

export function redactSecrets(value?: string): string {
  if (!value) return "not-set";
  if (value.length <= 6) return "***";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function shouldExposeToFrontend(key: string): boolean {
  return !["SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL"].includes(key);
}
