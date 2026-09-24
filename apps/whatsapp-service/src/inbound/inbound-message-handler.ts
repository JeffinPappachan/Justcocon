import type { DateValidationClock } from "@justcocon/validation";
import {
  isUniqueViolation,
  normalizeWhatsAppPhone,
  type PersistenceRepositories,
} from "@justcocon/persistence";
import { planWhatsAppOutboundInteractiveMessages } from "../whatsapp/interactive-outbound-planner.js";
import type { WhatsAppOutboundMessage } from "../whatsapp/outbound-types.js";
import type { BookingOrchestrator } from "../booking-orchestrator.js";
import { ConversationSessionService } from "../conversation/session-service.js";
import { maskPhone } from "../log-safety.js";
import type { createLogger } from "../logger.js";
import type { WhatsAppTransport } from "../whatsapp/transport-types.js";
import { withPhoneMutex } from "./phone-mutex.js";
import { isDirectUserChatJid } from "../whatsapp/baileys/chat-jid.js";
import type { InboundWhatsAppMessage } from "../whatsapp/transport-types.js";

export interface InboundMessageHandlerDeps {
  repos: PersistenceRepositories;
  orchestrator: BookingOrchestrator;
  transport: WhatsAppTransport;
  logger: ReturnType<typeof createLogger>;
  whatsappInteractiveUi: boolean;
  whatsappUseNativeButtons: boolean;
  clock: DateValidationClock;
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

    const outboundMessages = planWhatsAppOutboundInteractiveMessages(result, {
      interactiveEnabled: this.deps.whatsappInteractiveUi,
      useNativeButtons: this.deps.whatsappUseNativeButtons,
      clock: this.deps.clock,
    });
    const outboundRecipient =
      message.replyWhatsAppJid?.trim() || phone.normalized;
    if (
      outboundRecipient.includes("@") &&
      !isDirectUserChatJid(outboundRecipient)
    ) {
      this.deps.logger.warn("Refusing outbound reply to non-direct chat JID", {
        sessionId: session.id,
        phone: maskPhone(phone.normalized),
        providerMessageId: message.providerMessageId,
      });
      return;
    }

    for (const outbound of outboundMessages) {
      const sendResult = await this.deps.transport.sendOutbound(
        outboundRecipient,
        outbound,
      );
      const storedText = serializeOutboundForStorage(outbound);

      await this.deps.repos.whatsappMessages.insert({
        whatsapp_number: phone.display,
        normalized_whatsapp_number: phone.normalized,
        direction: "outgoing",
        message_type: "text",
        message_text: storedText,
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
      } else {
        this.deps.logger.info("Outbound WhatsApp reply sent", {
          sessionId: session.id,
          phone: maskPhone(phone.normalized),
          kind: outbound.kind,
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

function serializeOutboundForStorage(message: WhatsAppOutboundMessage): string {
  if (message.kind === "text") {
    return message.body;
  }
  if (message.kind === "buttons" || message.kind === "native_flow") {
    const labels = message.buttons.map((b) => b.displayText).join(", ");
    return `${message.body}\n[Buttons: ${labels}]`;
  }
  const rowSummary = message.rows.map((r) => r.title).join(", ");
  return `${message.title}\n${message.description}\n[${message.buttonText}: ${rowSummary}]`;
}
