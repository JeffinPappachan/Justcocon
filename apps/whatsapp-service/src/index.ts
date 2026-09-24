import { createLogger } from "./logger.js";
import { loadConfig, validateConfig } from "./config.js";
import {
  createInMemoryBookingOrchestratorBundle,
  createSupabaseBookingOrchestratorBundle,
} from "./booking-orchestrator.js";
import { createInboundMessageHandler } from "./inbound/inbound-message-handler.js";
import { createWhatsAppTransport } from "./whatsapp/create-transport.js";
import type { WhatsAppTransport } from "./whatsapp/transport-types.js";

const logger = createLogger("whatsapp-service");

const config = loadConfig();
validateConfig(config);

const validationClock = {
  todayIsoDate: () => new Date().toISOString().slice(0, 10),
};

const bookingBundle =
  config.bookingMode === "persistence"
    ? createSupabaseBookingOrchestratorBundle(validationClock)
    : createInMemoryBookingOrchestratorBundle(validationClock);

const transport: WhatsAppTransport = createWhatsAppTransport(
  config,
  createLogger("baileys"),
);

const inboundHandler = createInboundMessageHandler({
  repos: bookingBundle.repos,
  orchestrator: bookingBundle.orchestrator,
  transport,
  logger,
  whatsappInteractiveUi: config.whatsappInteractiveUi,
  whatsappUseNativeButtons: config.whatsappUseNativeButtons,
  clock: validationClock,
});

async function start() {
  logger.info("Starting JustCocon WhatsApp staging service", {
    appEnv: config.appEnv,
    provider: config.whatsappProvider,
    mode: config.bookingMode,
    whatsappLive: config.whatsappEnableLive,
    persistence:
      config.bookingMode === "persistence" ? "supabase-service-role" : "in-memory",
  });

  await transport.start((message) => inboundHandler.handleInbound(message));

  const status = await transport.getConnectionStatus();
  logger.info("WhatsApp transport ready", {
    status: status.status,
    provider: status.provider,
    connected: status.connected,
  });
}

export const bookingOrchestrator = bookingBundle.orchestrator;

const shutdown = async (signal: string) => {
  logger.info("Shutting down cleanly", { signal });
  try {
    await transport.stop();
  } catch (error) {
    const message = error instanceof Error ? error.message : "stop failed";
    logger.error("Transport stop error", { message });
  }
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

start().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown startup error";
  logger.error("Startup failed", { message });
  process.exit(1);
});
