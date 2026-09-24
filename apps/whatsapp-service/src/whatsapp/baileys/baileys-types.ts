/**
 * Minimal Baileys-shaped message types (no @whiskeysockets/baileys dependency).
 * Used by the inbound mapper and future live adapter.
 */

export interface BaileysMessageKey {
  id?: string;
  fromMe?: boolean;
  remoteJid?: string;
  participant?: string;
}

export interface BaileysLikeInboundMessage {
  key: BaileysMessageKey;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    buttonsResponseMessage?: {
      selectedButtonId?: string;
      selectedDisplayText?: string;
    };
    listResponseMessage?: {
      title?: string;
      singleSelectReply?: {
        selectedRowId?: string;
        selectedTitle?: string;
      };
    };
    templateButtonReplyMessage?: {
      selectedId?: string;
      selectedDisplayText?: string;
    };
    interactiveResponseMessage?: {
      nativeFlowResponseMessage?: {
        paramsJson?: string;
      };
    };
  };
  messageTimestamp?: number | { toNumber?: () => number };
}
