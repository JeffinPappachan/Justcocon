import { planWhatsAppOutboundMessages } from "@justcocon/booking-domain";
import {
  isUniqueViolation,
  normalizeWhatsAppPhone,
  type PersistenceRepositories,
} from "@justcocon/persistence";
import type { BookingOrchestrator } from "../booking-orchestrator.js";
import { ConversationSessionService } from "../conversation/session-service.js";
import { maskPhone } from "../log-safety.js";
import type { createLogger } from "../logger.js";
import type { WhatsAppTransport } from "../whatsapp/transport-types.js";
import { withPhoneMutex } from "./phone-mutex.js";
import type { InboundWhatsAppMessage } from "../whatsapp/transport-types.js";

export interface InboundMessageHandlerDeps {
  repos: PersistenceRepositories;
  orchestrator: BookingOrchestrator;
  transport: WhatsAppTransport;
  logger: ReturnType<typeof createLogger>;
}

export class InboundMessageHandler {
  private readonly sessions: ConversationSessionService;

  constructor(private readonly deps: InboundMessageHandlerDeps) {
    this.sessions = new ConversationSessionService(deps.repos);
  }

  async handleInbound(message: InboundWhatsAppMessage): Promise<void> {
    if (message.fromMe) {
      this.deps.logger.debug("Ignoring self-sent message", {
        providerMessageId: message.providerMessageId,
      });
      return;
    }

    if (message.kind !== "text" || !message.text?.trim()) {
      this.deps.logger.debug("Ignoring unsupported inbound message", {
        kind: message.kind,
        providerMessageId: message.providerMessageId,
      });
      return;
    }

    const existing = await this.deps.repos.whatsappMessages.findByProviderMessageId(
      message.providerMessageId,
    );
    if (existing) {
      this.deps.logger.info("Duplicate inbound provider message skipped", {
        providerMessageId: message.providerMessageId,
      });
      return;
    }

    let phone: ReturnType<typeof normalizeWhatsAppPhone>;
    try {
      phone = normalizeWhatsAppPhone(message.senderWhatsAppId);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "invalid phone number";
      this.deps.logger.warn("Invalid sender phone on inbound message", {
        providerMessageId: message.providerMessageId,
        reason,
      });
      return;
    }

    try {
      await withPhoneMutex(phone.normalized, async () => {
        await this.processUnderMutex(message, phone);
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "unknown processing error";
      this.deps.logger.error("Inbound message processing failed", {
        providerMessageId: message.providerMessageId,
        phone: maskPhone(phone.normalized),
        reason,
      });
    }
  }

  private async processUnderMutex(
    message: InboundWhatsAppMessage,
    phone: { normalized: string; display: string },
  ): Promise<void> {
    const duplicateAgain =
      await this.deps.repos.whatsappMessages.findByProviderMessageId(
        message.providerMessageId,
      );
    if (duplicateAgain) {
      return;
    }

    const { session, context } = await this.sessions.resolveForPhone(phone);
    const receivedAt = message.timestamp;

    try {
      await this.deps.repos.whatsappMessages.insert({
        whatsapp_number: phone.display,
        normalized_whatsapp_number: phone.normalized,
        direction: "incoming",
        message_type: "text",
        message_text: message.text!.trim(),
        conversation_session_id: session.id,
        provider_message_id: message.providerMessageId,
        received_at: receivedAt,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        this.deps.logger.info("Inbound message insert race treated as duplicate", {
          providerMessageId: message.providerMessageId,
        });
        return;
      }
      throw error;
    }

    this.deps.logger.info("Processing inbound WhatsApp turn", {
      sessionId: session.id,
      phone: maskPhone(phone.normalized),
      providerMessageId: message.providerMessageId,
    });

    const result = await this.deps.orchestrator.processTurn(
      context,
      { kind: "user_message", text: message.text!.trim() },
      { conversationSessionId: session.id },
    );

    await this.sessions.persistAfterTurn(
      session.id,
      result.context,
      receivedAt,
    );

    const outboundMessages = planWhatsAppOutboundMessages(result.replies);

    for (const reply of outboundMessages) {
      const sendResult = await this.deps.transport.sendTextMessage(
        phone.normalized,
        reply,
      );

      await this.deps.repos.whatsappMessages.insert({
        whatsapp_number: phone.display,
        normalized_whatsapp_number: phone.normalized,
        direction: "outgoing",
        message_type: "text",
        message_text: reply,
        conversation_session_id: session.id,
        provider_message_id: sendResult.messageId ?? null,
        delivery_status: sendResult.ok ? "sent" : "failed",
      });

      if (!sendResult.ok) {
        this.deps.logger.warn("Outbound WhatsApp send failed", {
          sessionId: session.id,
          phone: maskPhone(phone.normalized),
          error: sendResult.error ?? "unknown",
        });
      }
    }
  }
}

export function createInboundMessageHandler(
  deps: InboundMessageHandlerDeps,
): InboundMessageHandler {
  return new InboundMessageHandler(deps);
}
