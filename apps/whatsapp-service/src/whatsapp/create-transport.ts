import type { AppConfig } from "../config.js";
import { MockFirstBaileysAdapter } from "./baileys/baileys-adapter.js";
import type { WhatsAppTransport } from "./transport-types.js";

/**
 * Returns a mockable Baileys adapter. Live socket stays off while
 * WHATSAPP_ENABLE_LIVE is not true (and live mode is not implemented yet).
 */
export function createWhatsAppTransport(config: AppConfig): WhatsAppTransport {
  if (config.whatsappProvider !== "baileys") {
    throw new Error(`Unsupported WHATSAPP_PROVIDER: ${config.whatsappProvider}`);
  }
  return new MockFirstBaileysAdapter(config);
}
