# E2E suite (HU-27)

Playwright + Chromium suite that drives the real Next.js app against a **local** Supabase. All data is
created through the UI with names derived from a per-run `runId`, so the suite can run repeatedly on the
same database.

## Requirements

- Docker running and local Supabase started: `pnpm supabase start` (`pnpm supabase db reset` for a clean DB).
- Browser: `pnpm --filter @canaldigital/web exec playwright install chromium`.
- No `.env` file to create: the config reads the local Supabase URL, keys and database from
  `pnpm supabase status -o env` by itself.

## Safety

`playwright.config.ts` reads the local Supabase values from the CLI and passes an explicit `env` to the web server for
every key in `apps/web/.env.example`, so `apps/web/.env.local` is never used. It refuses to run if
`NEXT_PUBLIC_SUPABASE_URL`, `DATABASE_URL` or the payment database URLs do not point to
`127.0.0.1`/`localhost`. Rate limiting, payments checkout UI, Kivi and Gemini are off.

## Running

```bash
pnpm test:e2e                       # whole suite (starts `next dev` on :3100)
pnpm test:e2e --project=public      # anonymous smoke tests only
pnpm --filter @canaldigital/web test:e2e:ui   # Playwright UI mode
pnpm --filter @canaldigital/web exec playwright show-report   # last HTML report
```

The app runs with `next dev` (not `next start`): in production mode the app ignores `RATE_LIMIT_ENABLED=false`
(requests to `/login` return 503) and sets Secure cookies that are dropped over plain http.

Projects chain as `setup -> admin -> buyer -> lifecycle`; `public` has no dependencies. Set `E2E_BASE_URL`
to reuse an already running server.

## Conventions

- Test files end in `.e2e.ts` (never `.spec.ts`/`.test.ts`); protected by `apps/web/tests/e2e-harness.test.ts`.
- No imports from `@canaldigital/packages/core`; use `@/e2e/...` imports and explicit return types.
- Selectors: `getByRole`/`getByLabel`/`getByText` with copy from `apps/web/messages/es.json`.

## HU-27 traceability

| HU-27 criterion                                   | Project     | File                                   |
| ------------------------------------------------- | ----------- | -------------------------------------- |
| Sessions for seller and buyer (UI signup)         | `setup`     | `e2e/setup/auth.setup.e2e.ts`          |
| Anonymous smoke and route guards                  | `public`    | `e2e/public/public.e2e.ts`             |
| Administrator flow (catalog) and dashboard access | `admin`     | `e2e/admin/catalog.e2e.ts`             |
| Buyer flow (store, cart, checkout, purchases)     | `buyer`     | `e2e/buyer/purchase.e2e.ts`            |
| Buyer and administrator on the same order         | `lifecycle` | `e2e/lifecycle/order-lifecycle.e2e.ts` |

## Payments are NOT tested (Lemon Squeezy)

The payment path is **simulated, not verified**. The suite does not exercise the Lemon Squeezy
checkout, the webhook, RabbitMQ, or the payment workers. In
`lifecycle/order-lifecycle.e2e.ts`, `support/simulated-payment.ts` marks the confirmed order as paid and
inserts a completed payment (gateway `bank_transfer`) directly in the **local** database (it refuses any
non-local `E2E_DATABASE_URL`). This only exists so the fulfillment steps (processing, shipped,
delivered) can be tested through the UI. Do not read a passing suite as proof that payments work.

## Known behavior

- The first run after `supabase start` / `db reset` can fail while the dev server compiles routes and
  the auth service warms up. Re-run it; subsequent runs are stable.
- Tests use the Spanish copy and, for the signup forms, hardcoded English labels that are not yet
  localized in the app. They will need updating when those forms are translated.
