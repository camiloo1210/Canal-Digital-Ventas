# Testing conventions for packages/core

## Rules

- AGENTS.md applies to tests: no `any`, no relative imports (use `@/<feature>/...` aliases from the root `vitest.config.ts`), explicit return types on every function and callback, `pnpm lint` with 0 warnings.
- Unit tests are co-located as `<file>.test.ts`; integration tests as `<file>.integration.test.ts`.
- Structure: `describe('<Unit>')` then `it('<observable behavior>')`. Use `it.each` for state machines and boundaries. One reason to fail per test.
- Determinism: no real clock, no `Math.random`. Use `vi.useFakeTimers()` and `vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'))` whenever a date is stored or compared. Use fixed ids, never `randomUUID()`.
- New use-case tests use shared fakes, not hand-rolled `vi.fn()` ports.
- Integration tests: real PostgreSQL only, every write inside a rolled-back transaction, each test creates its own tenant, no dependence on `seed.sql`.
- A test that fails against current code is a finding: decide with a human whether code or test is wrong. Never weaken an assertion to make it pass.
- Versions pinned exactly (no `^`).

## Coverage gate

Run `pnpm test:coverage` (exits non-zero when a threshold is missed). Reports go to `coverage/` (`lcov.info`, `coverage-summary.json`). Scope is `packages/core/src/**/*.ts`, excluding tests, `index.ts`, `*.dto.ts`, `*.port.ts`, `*.fixture.ts`, `*.d.ts` and `packages/core/src/testing/**`.

Measured with `pnpm test:coverage` (2026-11-08, after the unit and Supabase read-adapter tests):

| Scope          | Statements | Branches | Functions | Lines |
| -------------- | ---------- | -------- | --------- | ----- |
| Global         | 76.24      | 70.94    | 78.72     | 77.19 |
| domain         | 94.68      | 88.58    | 97.42     | 95.24 |
| application    | 93.11      | 87.70    | 91.65     | 93.89 |
| infrastructure | 51.38      | 55.05    | 50.15     | 51.93 |

Thresholds in `vitest.config.ts` are floor(measured) - 1, never below the plan targets: global 75/70/77/76 (statements/branches/functions/lines), `features/*/domain/**` 93/87/96/94, `features/*/application/**` 92/86/90/92, `features/*/infrastructure/**` 50/54/49/50. All plan targets (domain lines 90 and branches 85, application lines 85 and branches 80, global statements 75, lines 75, branches 70, functions 75) are met. The global branches threshold sits at the target (70) with 0.94 points of headroom, because floor(measured) - 1 would be 69. Raise thresholds as coverage grows; never lower them.

Infrastructure is the weak layer (adapters need a real database; their coverage comes from `*.integration.test.ts`, which is excluded from the unit coverage run). Largest remaining uncovered adapters: `supabase-order.repository`, `postgres-order.repository`, `postgres-product.repository`, `supabase-payment.repository`, `postgres-payment-checkout.repository`, `payment-order-worker`, `payment-evidence-server`, `payment-refund-workers`, `kivi-sync-worker`, `supabase-user.repository`, `supabase-cart.repository`, `supabase-outbox.adapter`, `supabase-product-read.repository`, `supabase-category-read.repository`, `postgres-merchant-notification.adapter`. `FakeSupabase` (`@/testing/fakes/fake-supabase-client`) is a chainable PostgREST double for unit-testing the Supabase adapters.

## CI

`.github/workflows/ci.yml` is **disabled for now**: its `push` and `pull_request` triggers are commented out, so it only runs if started by hand (`workflow_dispatch`). When enabled, it runs on every push and pull request. Job `unit`: `pnpm install --frozen-lockfile`, `pnpm lint`, `tsc --noEmit` for `packages/core`, `apps/web` and `apps/worker` (same as `.husky/pre-commit`), `pnpm test:coverage` (the threshold gate) and uploads `coverage/lcov.info`. Job `integration`: starts local Supabase with `pnpm supabase start -x ...`, `pnpm supabase db reset`, `pnpm test:integration`. Actions are pinned by full commit SHA with the version in a trailing comment; to bump one, resolve the tag with `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` (dereference annotated tags). `package.json` has no `packageManager` field, so the pnpm version is set in the workflow env (`PNPM_VERSION`).

## Integration tests

One command: `pnpm test:integration` (script `scripts/test-integration.mjs`). It fails fast with a clear message when Docker or the `supabase` CLI is unavailable, starts the local Supabase stack if it is not running, waits for PostgreSQL on `127.0.0.1:54322`, sets `DATABASE_URL` to the LOCAL database only, and runs every `*.integration.test.ts` with the verbose reporter. If Docker uses a user socket, export `DOCKER_HOST` first (for example `unix:///home/<you>/.docker/desktop/docker.sock`).

Self-contained tests use `withRolledBackTenant(sql, async ({ tenantId, sql }) => ...)` from `@/testing/integration/with-rolled-back-tenant`: it opens a transaction, inserts a fresh tenant, runs the callback and always rolls back, so nothing depends on `seed.sql` or leaks between tests. `savepointSql(tx)` gives adapters that call `sql.begin` (the transaction manager) a nested SAVEPOINT scope, `toTransactionContext(tx)` wraps a transaction as a `TransactionContext`, and `insertTestCategory` creates a category for product foreign keys.

Skipped locally (listed as skipped by name in the runner output): suites that need dedicated worker logins, a disposable audit cluster, pre-existing data or a broker. They keep their own gate variable and are not enabled by the runner: `outbox-worker-migrations` and `postgres-relay-outbox` (`OUTBOX_TEST_DATABASE_URL`), `notification-order-projection` (`NOTIFICATION_TEST_DATABASE_URL`), `kivi-sync-fencing` (`KIVI_TEST_DATABASE_URL`), `security-remediation` (`SECURITY_TEST_DATABASE_URL`), `postgres-admin-catalog`, `postgres-business-intelligence` and `postgres-tenant-branding` (need existing store data), `rabbitmq-event-publisher` (`RABBITMQ_TEST_URL`).

Known finding pinned with `it.fails`: `PostgresProductRepository.decreaseStock` leaves an `active` product at stock 0 instead of `out_of_stock` (`postgres-product.decrease-stock.integration.test.ts`). Concurrency of two decreases is exercised on one transaction connection (rolled-back data is invisible to other connections); the guard is a single conditional UPDATE.

## Mutation testing (on demand, not in CI)

`pnpm test:mutation` runs Stryker (`@stryker-mutator/core` and `@stryker-mutator/vitest-runner`, both pinned to 10.1.1, published 2026-10-23) over `packages/core/src/features/*/domain/**/*.ts`. It works with Vitest 4.1.12. The runner uses `stryker.vitest.config.mjs`, which extends the root Vitest config and runs only core unit tests (no integration, property or `apps/` tests). The HTML report goes to `reports/mutation/mutation.html`; `reports/` and `.stryker-tmp/` are gitignored and ESLint-ignored. Thresholds: high 85, low 70, break 60.

Scope one run with `pnpm test:mutation -- --mutate 'packages/core/src/features/orders/domain/**/*.ts'`. The full orders plus products run takes about 3.5 minutes with concurrency 4. Do not leave a `.stryker-tmp` directory behind after a crashed run: Vitest would collect the sandbox copy of the tests. Delete it.

Baseline (2026-11-08), mutation score (total, counting no-coverage mutants):

| Feature  | Before | After new tests |
| -------- | ------ | --------------- |
| orders   | 64.43  | 81.13           |
| products | 71.35  | 76.41           |
| combined | 68.07  | 78.64           |

Added `order.entity.mutation.test.ts` and `product.entity.mutation.test.ts` (blank identity guards, draft item merge/remove/currency, stock boundary and status transitions, wholesale pairing, pricing/details events). Remaining survivors are mostly exception message strings, branded id helper types, `Order` creation guards on id/orderNumber messages, and the unreachable code below.

Observations:

- `Order.validateStatus`, `validatePaymentGatewayId` and `validateTimestamps` are never called (no coverage): dead validation, so `reconstitute` accepts `createdAt > updatedAt` and a blank gateway id.
- `Order.validateTenantId` is effectively unreachable with a real `TenantId` (the branded constructor throws first) and throws `InvalidTenantIdException`, not `InvalidOrderAttributeException`.
- Product `validateId`, `validateCategoryId`, `validateTenantId` and `validateStock` call sites survive removal because the id factories already reject blank values.
