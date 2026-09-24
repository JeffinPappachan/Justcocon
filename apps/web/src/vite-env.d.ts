/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WHATSAPP_BOOKING_NUMBER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
