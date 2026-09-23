# Development setup

## Local environment

- Node.js 18+
- npm 10+
- pnpm 9+
- Git
- Python 3.13+

## Install dependencies

```bash
pnpm install
```

## Local app commands

```bash
pnpm --dir apps/web dev
pnpm --dir apps/oms dev
pnpm --dir apps/whatsapp-service dev
```

## Type checking and tests

```bash
pnpm typecheck
pnpm test
```

## Notes

- Use safe environment examples instead of real `.env` files.
- Keep all application surfaces in staging/demo mode for this phase.
- Do not expose service-role keys to frontend applications.

## Staging WhatsApp (live Baileys)

Use a **dedicated staging number** (not production customer lines). In root `.env`:

```env
WHATSAPP_ENABLE_LIVE=true
WHATSAPP_AUTH_DIRECTORY=.baileys-auth
BOOKING_MODE=persistence
APP_ENV=staging
```

Start the service:

```bash
pnpm --dir apps/whatsapp-service dev
```

On first run, scan the **QR code printed in the terminal** with WhatsApp → Linked devices. Session files stay in `WHATSAPP_AUTH_DIRECTORY` (gitignored). Set `WHATSAPP_ENABLE_LIVE=false` to return to mock transport for tests and local dry-runs.
