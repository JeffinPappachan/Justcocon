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

The website **Book on WhatsApp** button opens `wa.me` for the paired staging number. Set `VITE_WHATSAPP_BOOKING_NUMBER` in the root `.env` (country code + number, no spaces), then restart `apps/web`. The prefilled first message is `BOOK` plus the selected location and tree count; send it in WhatsApp to start the bot.
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

### Text-first staging chat (recommended)

Baileys linked-device staging should use **plain text commands**—interactive buttons and lists are unreliable on many phones.

```env
WHATSAPP_INTERACTIVE_UI=false
```

**Staging flow:** send `Hi` or `START` → `BOOK` (or `CLOSE`) → name and address as text → tree count `1`–`5` → date `YYYY-MM-DD` → time `1`–`4` → notes or `SKIP` → review summary → `CONFIRM`. Use `HELP`, `CANCEL`, or `RESTART` anytime unless the bot says otherwise.

**Note:** Reliable on-device buttons, templates, and native pickers require the **WhatsApp Business Cloud API**, not Baileys alone.
