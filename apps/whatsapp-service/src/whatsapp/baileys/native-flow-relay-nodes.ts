import { isJidGroup } from "@whiskeysockets/baileys";

/** Binary nodes WhatsApp expects so interactive buttons render on mobile (not only Web). */
export type RelayBinaryNode = {
  tag: string;
  attrs: Record<string, string>;
  content?: RelayBinaryNode[];
};

export function nativeFlowRelayAdditionalNodes(
  recipientJid: string,
): RelayBinaryNode[] {
  const bizContent: RelayBinaryNode[] = [
    {
      tag: "interactive",
      attrs: { type: "native_flow", v: "1" },
      content: [
        {
          tag: "native_flow",
          attrs: { v: "9", name: "mixed" },
        },
      ],
    },
  ];
  if (!isJidGroup(recipientJid)) {
    bizContent.push({ tag: "bot", attrs: { biz_bot: "1" } });
  }
  return [{ tag: "biz", attrs: {}, content: bizContent }];
}
