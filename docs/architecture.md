# JustCocon architecture

## Project purpose

JustCocon is a staging-only foundation for a coconut harvesting booking platform focused on Kerala, India. The goal of this phase is to create a modular project structure that separates the customer booking experience, internal operations workflows, and WhatsApp service boundaries without connecting to live systems.

## Application responsibilities

### Web app

The web app acts as the customer-facing booking page. It provides a simple mobile-first interface for collecting a location, estimated tree count, preferred date, and notes. The UI is intentionally demo-only and does not submit live booking data.

### OMS app

The operations dashboard is a staging shell for tracking booking requests and staff review activity. It does not connect to production data or private customer records.

### WhatsApp service

The WhatsApp service provides a provider-independent foundation for future interaction flows. It includes a staging provider abstraction and safe startup logging. It does not pair with a real WhatsApp account or production phone number.

## Shared package responsibilities

### Shared types

Contains platform-neutral TypeScript domain types, including booking status, tree categories, and messaging enums.

### Booking domain

Contains booking state transitions and business rules that are independent of frontend frameworks and messaging providers.

### Configuration

Reads environment data and helps validate safe staging versus production configuration. It must never expose service-role secrets to frontend code.

### Validation

Provides shared validation helpers for booking-related form and request inputs.

## Initial architecture

- Customer web app
- OMS dashboard app
- WhatsApp service app
- Shared domain packages
- Supabase preparation directory
- Documentation folder

## WhatsApp provider abstraction

The service uses a provider interface so future implementations can support Baileys staging and, if later approved, a production WhatsApp Cloud API provider.

## Staging versus production

This phase is intentionally staging-focused. No production database, credentials, or messaging endpoints are used. Applications are marked as staging or demo-only.

## Current limitations

- No live Supabase connection
- No live WhatsApp pairing
- No autonomous conversation flow
- No real booking updates
- No production authentication
- No production data access

## Database safety requirements

- No production database changes are allowed.
- No migration execution is allowed.
- Separate staging infrastructure is recommended before any SQL migration is run.

## Baileys authentication risks

Baileys session files and authentication state should never be committed. They must remain excluded from source control to avoid leaking local pairing state.

## Future Supabase integration

Supabase integration will be added later in a controlled, read-only audit flow when the project moves beyond Phase 1.
