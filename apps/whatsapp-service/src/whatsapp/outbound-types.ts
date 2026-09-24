export type WhatsAppListRow = {

  rowId: string;

  title: string;

  description?: string;

};



export type WhatsAppButton = {

  buttonId: string;

  displayText: string;

};



export type WhatsAppOutboundMessage =
  | { kind: "text"; body: string }
  | {
      kind: "buttons";
      body: string;
      footer?: string;
      buttons: WhatsAppButton[];
    }
  | {
      /** Modern quick-reply buttons (renders on mobile + Web when relay nodes are attached). */
      kind: "native_flow";
      body: string;
      title?: string;
      footer?: string;
      buttons: WhatsAppButton[];
    }
  | {
      kind: "list";
      title: string;
      description: string;
      buttonText: string;
      rows: WhatsAppListRow[];
    };

