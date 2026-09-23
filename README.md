# JustCocon

JustCocon is a staging-only foundation for a coconut harvesting booking platform in Kerala, India.

## Current status

This repository is intentionally initialized as a development foundation for Phase 1. It includes a staging-oriented monorepo structure for:

- Customer booking website
- Operations management system
- WhatsApp staging service
- Shared types and business domain logic
- Shared validation and configuration packages
- Supabase migration preparation documentation

## Important safety notes

- Do not use production credentials.
- Do not apply database migrations to the existing production Supabase project.
- Do not connect a production WhatsApp number.
- Do not commit real secrets or Baileys auth state.
- All app entry points are staged/demo-only in this phase.

## Project structure

```text
apps/
  web/
  oms/
  whatsapp-service/
packages/
  shared-types/
  booking-domain/
  config/
  validation/
supabase/
  migrations/
  seed/
docs/
```

## Development notes

Use the workspace package manager and keep environment values in safe example files, not real `.env` files.
