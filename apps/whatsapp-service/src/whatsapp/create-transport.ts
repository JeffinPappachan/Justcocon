import type { AppConfig } from "../config.js";
import type { createLogger } from "../logger.js";
import { LiveBaileysTransport } from "./baileys/live-baileys-transport.js";
import { MockFirstBaileysAdapter } from "./baileys/baileys-adapter.js";
import type { WhatsAppTransport } from "./transport-types.js";

export function createWhatsAppTransport(
  config: AppConfig,
  logger: ReturnType<typeof createLogger>,
): WhatsAppTransport {
  if (config.whatsappProvider !== "baileys") {
    throw new Error(`Unsupported WHATSAPP_PROVIDER: ${config.whatsappProvider}`);
  }

  if (config.whatsappEnableLive) {
    return new LiveBaileysTransport(config, logger);
  }

  return new MockFirstBaileysAdapter(config);
}
