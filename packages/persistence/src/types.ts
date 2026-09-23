import type { BookingStatus, PreferredTimeWindow, TreeCountCategory } from "@justcocon/shared-types";

export interface CustomerRow {
  id: string;
  full_name: string;
  whatsapp_number: string;
  normalized_whatsapp_number: string;
  created_at: string;
  updated_at: string;
}

export interface BookingRow {
  id: string;
  booking_reference: string;
  customer_id: string;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  tree_count_category: TreeCountCategory;
  preferred_date: string;
  preferred_time_window: PreferredTimeWindow;
  customer_notes: string | null;
  status: BookingStatus;
  source: string;
  environment: string;
  submission_idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationSessionRow {
  id: string;
  whatsapp_number: string;
  normalized_whatsapp_number: string;
  current_phase: string;
  booking_id: string | null;
  session_data: Record<string, unknown>;
  submission_idempotency_key: string | null;
  last_message_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessageRow {
  id: string;
  provider_message_id: string | null;
  whatsapp_number: string;
  normalized_whatsapp_number: string;
  direction: "incoming" | "outgoing";
  message_type: "text" | "template" | "system";
  message_text: string | null;
  conversation_session_id: string | null;
  delivery_status: string | null;
  received_at: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_type: string;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateCustomerInput {
  full_name: string;
  whatsapp_number: string;
  normalized_whatsapp_number: string;
}

export interface CreateBookingInput {
  booking_reference: string;
  customer_id: string;
  location_text: string;
  tree_count_category: TreeCountCategory;
  preferred_date: string;
  preferred_time_window: PreferredTimeWindow;
  customer_notes: string | null;
  status: BookingStatus;
  source: string;
  environment: string;
  submission_idempotency_key: string;
}

export interface CreateAuditLogInput {
  entity_type: string;
  entity_id: string;
  action: string;
  actor_type: string;
  actor_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateWhatsAppMessageInput {
  whatsapp_number: string;
  normalized_whatsapp_number: string;
  direction: "incoming" | "outgoing";
  message_type: "text" | "template" | "system";
  message_text: string | null;
  conversation_session_id?: string | null;
  provider_message_id?: string | null;
  received_at?: string | null;
  delivery_status?: string | null;
}

export interface CreateConversationSessionInput {
  whatsapp_number: string;
  normalized_whatsapp_number: string;
  current_phase: string;
  session_data: Record<string, unknown>;
  submission_idempotency_key?: string | null;
  last_message_at?: string | null;
  is_active?: boolean;
}

export interface UpdateConversationSessionStateInput {
  sessionId: string;
  current_phase: string;
  session_data: Record<string, unknown>;
  submission_idempotency_key?: string | null;
  last_message_at?: string | null;
  is_active?: boolean;
}
