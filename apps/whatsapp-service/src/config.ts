import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(here, "../../../.env") });

export interface AppConfig {
  appEnv: string;
  logLevel: string;
  whatsappProvider: string;
  whatsappAuthDirectory?: string;
  whatsappEnableLive: boolean;
  bookingMode: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
}

export function loadConfig(): AppConfig {
  const appEnv = process.env.APP_ENV ?? "staging";

  return {
    appEnv,
    logLevel: process.env.LOG_LEVEL ?? "info",
    whatsappProvider: process.env.WHATSAPP_PROVIDER ?? "baileys",
    whatsappAuthDirectory: process.env.WHATSAPP_AUTH_DIRECTORY,
    whatsappEnableLive: process.env.WHATSAPP_ENABLE_LIVE === "true",
    bookingMode: process.env.BOOKING_MODE ?? "demo",
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function validateConfig(config: AppConfig): void {
  const required = ["appEnv", "logLevel", "whatsappProvider", "bookingMode"];
  for (const key of required) {
    if (!config[key as keyof AppConfig]) {
      throw new Error(`Missing required config value: ${key}`);
    }
  }

  if (config.bookingMode === "persistence") {
    if (!config.supabaseUrl?.trim() || !config.supabaseServiceRoleKey?.trim()) {
      throw new Error(
        "BOOKING_MODE=persistence requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env",
      );
    }
  }
}
