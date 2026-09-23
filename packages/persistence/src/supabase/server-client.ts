import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PersistenceConfigError } from "../errors.js";

export interface SupabaseServerConfig {
  url: string;
  serviceRoleKey: string;
}

/** Server-only Supabase client (service role). Never import from frontend apps. */
export function loadSupabaseServerConfigFromEnv(
  raw: Record<string, string | undefined> = process.env,
): SupabaseServerConfig {
  const url = raw.SUPABASE_URL?.trim();
  const serviceRoleKey = raw.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    throw new PersistenceConfigError("SUPABASE_URL is required for persistence.");
  }
  if (!serviceRoleKey) {
    throw new PersistenceConfigError(
      "SUPABASE_SERVICE_ROLE_KEY is required for persistence.",
    );
  }
  if (serviceRoleKey.startsWith("sbp_")) {
    throw new PersistenceConfigError(
      "SUPABASE_SERVICE_ROLE_KEY must be the project service_role JWT, not an account PAT (sbp_).",
    );
  }

  return { url, serviceRoleKey };
}

export function createServerSupabaseClient(
  config: SupabaseServerConfig,
): SupabaseClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
