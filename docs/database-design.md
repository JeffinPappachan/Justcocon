# JustCocon database design proposal

This document is a design proposal only and does not change the current database.

## Scope

The proposed design supports a staging-only booking flow for JustCocon with a customer-facing booking experience, staff review, WhatsApp conversation tracking, and audit logging. It is independent from the current production database and should be implemented only in a separate staging project if the connected project is production.

## Proposed entities

### customers

Purpose:

- store customer identity information for bookings and staff review
- keep a normalized WhatsApp reference for messaging and deduplication

Suggested fields:

- id: uuid primary key
- full_name: text, not null
- whatsapp_number: text, not null
- normalized_whatsapp_number: text, not null
- created_at: timestamptz not null default now()
- updated_at: timestamptz not null default now()

Notes:

- keep phone numbers normalized and never store raw secrets
- ensure a unique normalized WhatsApp number to reduce duplicate customer records

### bookings

Purpose:

- represent a customer harvest request from initial submission through scheduling and completion

Suggested fields:

- id: uuid primary key
- booking_reference: text unique not null
- customer_id: uuid not null references customers(id)
- location_text: text not null
- latitude: double precision nullable
- longitude: double precision nullable
- tree_count_category: text not null
- preferred_date: date nullable
- preferred_period: text nullable
- customer_notes: text nullable
- status: text not null default 'PENDING_STAFF_REVIEW'
- source: text not null default 'whatsapp'
- environment: text not null default 'staging'
- created_at: timestamptz not null default now()
- updated_at: timestamptz not null default now()

Notes:

- status should follow the same domain semantics as the TypeScript booking status model
- customer confirmation must not imply staff approval
- source and environment fields support staging and production separation

### conversation_sessions

Purpose:

- track the current WhatsApp conversation state for a customer phone number

Suggested fields:

- id: uuid primary key
- whatsapp_number: text not null
- current_state: text not null
- booking_id: uuid nullable references bookings(id)
- session_data: jsonb not null default '{}'
- last_message_at: timestamptz nullable
- expires_at: timestamptz nullable
- created_at: timestamptz not null default now()
- updated_at: timestamptz not null default now()

Notes:

- keep conversation state in a session table instead of embedding it into the booking row
- use TTL or expiration logic for stale sessions

### whatsapp_messages

Purpose:

- record all inbound and outbound WhatsApp messages for traceability and debugging

Suggested fields:

- id: uuid primary key
- provider_message_id: text nullable
- whatsapp_number: text not null
- direction: text not null
- message_type: text not null
- message_text: text nullable
- conversation_session_id: uuid nullable references conversation_sessions(id)
- delivery_status: text nullable
- received_at: timestamptz nullable
- created_at: timestamptz not null default now()

Notes:

- provider_message_id should be unique where available to prevent duplicate processing
- message bodies may require retention controls for privacy reasons

### audit_logs

Purpose:

- preserve staff and system actions for suspicion review, internal auditing, and debugging

Suggested fields:

- id: uuid primary key
- entity_type: text not null
- entity_id: uuid not null
- action: text not null
- actor_type: text not null
- actor_id: uuid nullable
- metadata: jsonb not null default '{}'
- created_at: timestamptz not null default now()

Notes:

- audit logs should be append-only
- metadata should avoid raw secret values and customer-sensitive content

## Relationships

- one customer has many bookings
- one booking belongs to one customer
- one booking may have many conversation sessions, though a practical implementation may use one active session per booking
- one conversation session may have many WhatsApp messages
- one booking may have many audit entries
- one customer may have many audit entries by association with booking or customer entity ids

## Key design choices

### Primary keys

Use UUIDs for all core business entities and audit records. UUIDs are suitable for distributed systems and simplify integration with external messaging providers.

### Foreign keys

- bookings.customer_id -> customers.id
- conversation_sessions.booking_id -> bookings.id
- whatsapp_messages.conversation_session_id -> conversation_sessions.id

### Indexes

Recommended indexes:

- customers(normalized_whatsapp_number) unique
- bookings(customer_id, created_at desc)
- bookings(status, created_at desc)
- conversation_sessions(whatsapp_number, expires_at)
- conversation_sessions(booking_id)
- whatsapp_messages(whatsapp_number, created_at desc)
- whatsapp_messages(provider_message_id)
- whatsapp_messages(conversation_session_id)
- audit_logs(entity_type, entity_id, created_at desc)

### Unique constraints

- customers: normalized_whatsapp_number unique
- bookings: booking_reference unique
- whatsapp_messages: provider_message_id unique where not null

### Status constraints

Use checked constraints or application validation to restrict allowed booking statuses to the same set used by the TypeScript domain model. The initial customer-submitted status should be PENDING_STAFF_REVIEW.

### Timestamp strategy

- created_at: record creation time
- updated_at: last state mutation time
- use timestamptz everywhere to avoid timezone ambiguity

### Idempotency strategy

For incoming WhatsApp messages:

- use provider_message_id when available
- persist a deduplication key or unique constraint on provider_message_id and whatsapp_number
- reject duplicate message processing before it reaches booking logic

### Audit logging strategy

- append-only audit records
- store actor_type and optional actor_id without exposing raw secrets
- keep metadata concise and structured
- never store full message bodies in audit logs unless explicitly required and privacy-reviewed

### Data retention

- keep phone numbers only as long as necessary
- consider retention policies for WhatsApp message history and audit logs
- enforce secure deletion or anonymization where regulatory expectations require it

### Row Level Security

Recommended RLS approach:

- staff role can view and update only booking and review data relevant to their scope
- customer-facing access should be restricted to their own booking records
- service-role key should be used only in secure backend contexts, never in frontend code
- public access should be disabled for sensitive or customer-owned tables

### Staff access

Use authenticated staff roles with explicit permissions instead of broad access. Keep OMS as a staging-only environment with role-based access if the project later reaches production readiness.

## Security considerations

- never expose service-role keys to frontend code
- normalize phone numbers before storage
- consider privacy impact of retaining message text and customer notes
- use staging-only environment variables and separate projects for production and staging
- avoid broad tables for operational data in production without a clear privacy review

## Recommendation

If the current Supabase project is production, do not create these tables in-place. Instead, use a separate staging project and the same domain model to prepare migration scripts for review. Until that environment exists, keep the design proposal as documentation only.
