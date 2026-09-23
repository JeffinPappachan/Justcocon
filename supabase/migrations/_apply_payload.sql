BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.justcocon_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.justcocon_set_updated_at() IS
  'JustCocon: maintain updated_at on row update.';

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  whatsapp_number text NOT NULL,
  normalized_whatsapp_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_full_name_not_blank CHECK (char_length(trim(full_name)) >= 2),
  CONSTRAINT customers_normalized_whatsapp_not_blank CHECK (char_length(trim(normalized_whatsapp_number)) > 0)
);

COMMENT ON TABLE public.customers IS
  'JustCocon customers; dedupe by normalized_whatsapp_number (E.164 from provider identity).';

COMMENT ON COLUMN public.customers.normalized_whatsapp_number IS
  'Canonical E.164 phone (e.g. +919876543210). Set by backend normalizer from provider JID/phone, not message text.';

CREATE UNIQUE INDEX IF NOT EXISTS customers_normalized_whatsapp_number_key
  ON public.customers (normalized_whatsapp_number);

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference text NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  location_text text NOT NULL,
  latitude double precision NULL,
  longitude double precision NULL,
  tree_count_category text NOT NULL,
  preferred_date date NOT NULL,
  preferred_time_window text NOT NULL,
  customer_notes text NULL,
  status text NOT NULL DEFAULT 'PENDING_STAFF_REVIEW',
  source text NOT NULL DEFAULT 'whatsapp',
  environment text NOT NULL DEFAULT 'staging',
  submission_idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_booking_reference_key UNIQUE (booking_reference),
  CONSTRAINT bookings_submission_idempotency_key_key UNIQUE (submission_idempotency_key),
  CONSTRAINT bookings_tree_count_category_check CHECK (
    tree_count_category IN ('1-5', '6-10', '11-25', '26-50', '50+')
  ),
  CONSTRAINT bookings_preferred_time_window_check CHECK (
    preferred_time_window IN ('MORNING', 'AFTERNOON', 'EVENING', 'FLEXIBLE')
  ),
  CONSTRAINT bookings_status_check CHECK (
    status IN (
      'NEW',
      'PENDING_STAFF_REVIEW',
      'CONFIRMED_BY_STAFF',
      'RESCHEDULE_REQUESTED',
      'CANCEL_REQUESTED',
      'SCHEDULED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'NEEDS_HUMAN_REVIEW'
    )
  ),
  CONSTRAINT bookings_location_not_blank CHECK (char_length(trim(location_text)) > 0)
);

COMMENT ON TABLE public.bookings IS
  'JustCocon booking requests. Created only after customer CONFIRM (orchestrator), default PENDING_STAFF_REVIEW.';

COMMENT ON COLUMN public.bookings.submission_idempotency_key IS
  'Engine idempotency key for confirm/retry; UNIQUE enforces one booking row per submission attempt chain.';

CREATE INDEX IF NOT EXISTS bookings_customer_id_created_at_idx
  ON public.bookings (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS bookings_status_created_at_idx
  ON public.bookings (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number text NOT NULL,
  normalized_whatsapp_number text NOT NULL,
  current_phase text NOT NULL DEFAULT 'IDLE',
  booking_id uuid NULL REFERENCES public.bookings (id) ON DELETE SET NULL,
  session_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  submission_idempotency_key text NULL,
  last_message_at timestamptz NULL,
  expires_at timestamptz NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversation_sessions_phase_check CHECK (
    current_phase IN (
      'IDLE',
      'COLLECTING_NAME',
      'COLLECTING_LOCATION',
      'COLLECTING_TREE_COUNT',
      'COLLECTING_PREFERRED_DATE',
      'COLLECTING_PREFERRED_TIME',
      'COLLECTING_NOTES',
      'AWAITING_CONFIRMATION',
      'EDITING',
      'PERSISTING',
      'COMPLETED',
      'CANCELLED',
      'ERROR'
    )
  )
);

COMMENT ON TABLE public.conversation_sessions IS
  'WhatsApp FSM session state. booking_id set after successful booking persistence.';

CREATE INDEX IF NOT EXISTS conversation_sessions_whatsapp_expires_idx
  ON public.conversation_sessions (normalized_whatsapp_number, expires_at);

CREATE INDEX IF NOT EXISTS conversation_sessions_booking_id_idx
  ON public.conversation_sessions (booking_id);

CREATE UNIQUE INDEX IF NOT EXISTS conversation_sessions_one_active_per_phone_idx
  ON public.conversation_sessions (normalized_whatsapp_number)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_message_id text NULL,
  whatsapp_number text NOT NULL,
  normalized_whatsapp_number text NOT NULL,
  direction text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  message_text text NULL,
  conversation_session_id uuid NULL REFERENCES public.conversation_sessions (id) ON DELETE SET NULL,
  delivery_status text NULL,
  received_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_messages_direction_check CHECK (direction IN ('incoming', 'outgoing')),
  CONSTRAINT whatsapp_messages_type_check CHECK (message_type IN ('text', 'template', 'system'))
);

COMMENT ON COLUMN public.whatsapp_messages.provider_message_id IS
  'Baileys/Cloud provider message id; partial UNIQUE prevents duplicate inbound event processing.';

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_provider_message_id_key
  ON public.whatsapp_messages (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_messages_session_created_at_idx
  ON public.whatsapp_messages (conversation_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_messages_phone_created_at_idx
  ON public.whatsapp_messages (normalized_whatsapp_number, created_at DESC);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_entity_created_at_idx
  ON public.audit_logs (entity_type, entity_id, created_at DESC);

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.justcocon_set_updated_at();

CREATE TRIGGER bookings_set_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.justcocon_set_updated_at();

CREATE TRIGGER conversation_sessions_set_updated_at
  BEFORE UPDATE ON public.conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.justcocon_set_updated_at();

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

COMMIT;
