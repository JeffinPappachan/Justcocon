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
