<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**IMPORTANT KNOWN CHANGES:**

- The `middleware.ts` file convention is deprecated. Use `proxy.ts` instead and export a function named `proxy`.

<!-- END:nextjs-agent-rules -->

# Canal Digital Ventas — Strict AI Coding Guidelines & Architecture Contract (V5 Production Standard)

> **Status:** MANDATORY — Production Architecture Contract  
> **Project:** Canal Digital Ventas  
> **Stack:** Next.js App Router, React 19, TypeScript Strict, Tailwind CSS, shadcn/ui, next-intl, DDD, Hexagonal Architecture, CQRS-Lite, PostgreSQL, Supabase  
> **Scope:** Entire codebase (Monorepo), including `packages/core`, `apps/web`, database schemas, migrations, Server Actions, React components, and automated tests.

---

## 1. Fundamental Architectural Principle & Monorepo Structure

**Next.js is a web delivery and presentation adapter. It is not the business application.**

The system follows **Domain-Driven Design (DDD)**, **Hexagonal Architecture (Ports & Adapters)**, **Vertical Slicing**, and **CQRS-Lite**. All authoritative business rules, domain invariants, and monetary calculations reside exclusively within `packages/core`, completely decoupled from any web framework or database driver.

### Monorepo Layout (PNPM Workspaces)

```text
t:/Camilo/Canal-Digital-Ventas/
├── apps/
│   └── web/                                # Next.js Primary / Driving Adapter
│       ├── app/                            # Thin routing layer (RSC pages, routes)
│       ├── features/                       # Vertical frontend slices (components, actions, schemas, di)
│       ├── components/ui/                  # Shared shadcn/ui visual primitives
│       ├── messages/                       # next-intl translations (es.json, en.json)
│       └── tests/                          # Frontend integration and architecture tests
│
├── packages/
│   └── core/                               # Authoritative Business Core
│       └── src/
│           ├── features/                   # Vertical slices (orders, products, categories, iam, etc.)
│           │   ├── domain/                 # Entities, Value Objects, Domain Exceptions, Invariants
│           │   ├── application/            # Use Cases, Ports (In/Out), DTOs, Read Models, Exceptions
│           │   └── infrastructure/         # Adapters (Postgres, Supabase), Transaction Managers, Mappers
│           └── index.ts                    # Public barrel export for @canaldigital/packages/core
│
└── supabase/
    └── migrations/                         # Declarative PostgreSQL migrations & RLS policies
```

### Mandatory Dependency Direction

```text
Browser (User Input / Events)
   │
   ▼
React Client Components ('use client' - Presentation state & DOM only)
   │
   ▼
Next.js Primary Adapters (Server Actions / RSC / Route Handlers)
   │
   ▼
Application Layer (Use Cases / Read Models / Inbound & Outbound Ports / Pure DTOs)
   │
   ▼
Domain Layer (Entities / Value Objects / Domain Events / Invariants)
```

```text
Application Outbound Port (Interface in Core)
       ▲
       │ implements
Infrastructure Adapter (PostgreSQL / Supabase / External Gateways)
```

**Rule:** Dependencies must ALWAYS point inward toward the Domain Core. No frontend requirement may justify reversing this dependency direction.

---

## 2. Core Business Logic (`packages/core`)

All business logic MUST reside in `packages/core`, fully decoupled from React, Next.js, and browser APIs.

### 2.1 Domain Layer (`domain/`)

- **Rich Entities:** Encapsulate state and business behavior. Anemic domain models (data bags with raw getters/setters) are strictly forbidden. State mutations must occur via explicit business methods (e.g., `order.cancel()`, `product.archive()`).
- **Invariants & Validation:** Entities guarantee validity upon creation and lifecycle transitions. Constructors are private; instantiation is enforced through static factory methods (e.g., `Order.create(...)`) or reconstitution factories (e.g., `Order.reconstitute(...)`).
- **Value Objects (VO):** Encapsulate domain primitives (e.g., `Money`, `CategorySlug`, `Address`). Validation of format, scale, and domain rules belongs inside the VO.
- **Domain Exceptions (`domain/exceptions/`):** Pure business rule or invariant violations inside Entities/VOs must extend `DomainException`. Never throw generic `Error` instances.
- **Framework Independence:** The Domain Layer must NEVER import React, Next.js, Supabase SDK, PostgreSQL drivers, HTTP clients, Zod, or browser APIs. Domain logic must be executable and testable in isolation.

### 2.2 Application Layer (`application/`)

- **Mutation Use Cases:** Orchestrate domain entities and delegate to outbound ports. Use Cases accept pure, framework-independent DTOs and return serializable results or void.
- **Outbound Ports (`application/ports/out/`):** Abstract interfaces for external I/O (e.g., `OrderRepositoryPort`, `ProductRepositoryPort`, `EventBusPort`). Use Cases interact ONLY with these abstractions (Dependency Inversion).
- **Application Exceptions (`application/exceptions/`):** Errors arising from Use Case orchestration or external port interactions extend `ApplicationException`.
- **Infrastructure Exception Hierarchy:** `InfrastructureException` extends `ApplicationException` and is placed in `shared/application/exceptions/`. Specific repository or gateway exceptions (e.g., `OrderRepositoryException`) extend `InfrastructureException`. Adapters translate vendor-specific errors into these typed exceptions.
- **Dedicated Read Models:** Projections optimized for query scenarios under CQRS-Lite (e.g., `BuyerOrderReadModel`), containing flat serializable data.

### 2.3 Infrastructure Layer (`infrastructure/`)

- **Adapters:** The ONLY place where implementations like Supabase, HTTP clients, or PostgreSQL drivers are allowed (e.g., `PostgresOrderRepository`, `PostgresProductRepository`).
- **Exception Translation:** Adapters catch technology-specific errors (like `PostgresError` or `SupabaseError`) and translate them into typed `InfrastructureException` / `ApplicationException` before bubbling to Use Cases.

### 2.4 Database Atomic Transaction Boundaries (STATE OF THE ART)

We strictly enforce **Option A (TransactionManager controlled by Node.js Transactor)** over monolithic Postgres RPCs for complex aggregates.

- Mutation Use Cases wrap multi-repository operations in a physical `BEGIN / COMMIT` block via `TransactionManagerPort.runInTransaction(async (tx) => { ... }, { userId })`.
- **No monolithic "One-RPC-fixes-all" functions** for bounded contexts (e.g., `create_product_transaction`). Domain behavior belongs in TypeScript, not buried in SQL.
- Scoped connection pool transactors (`tx.executeNative(...)`) enforce connection reuse and propagate the transaction context across all repository operations.
- Security-definer RPCs in the DB are reserved strictly for narrow security/fencing steps (e.g., acquiring idempotent leases, appending outbox logs).

---

## 3. Web Presentation Layer (`apps/web` — Primary Adapter)

`apps/web` acts EXCLUSIVELY as the **Primary / Driving Adapter** in our Hexagonal Architecture. It is essentially a delivery mechanism. **ZERO business logic, domain rules, authoritative pricing, or database mutations are allowed in the Next.js layer.**

### 3.1 Zero Tolerance Rules (STRICTLY MANDATORY)

1. **Zero `any` or implicit types:** Absolute typing is guaranteed across all components, actions, and utilities.
2. **Zero relative imports (`./` or `../`):** Strictly use configured absolute aliases (`@/...`).
3. **Primary Adapter (Mechanical Delivery):** The frontend ONLY orchestrates `FormData (primitives) -> Zod -> Pure DTOs -> Use Cases`.
4. **No Direct Infrastructure Instantiation:** Components and Server Actions must NEVER instantiate repositories or Use Cases with `new`. All server dependencies are resolved via the feature DI container.

### 3.2 Monorepo Boundaries & Dependency Injection (DI)

- **Centralized DI Containers:** Located in `features/[feature]/di/[feature].di.ts`.
- **Server-Only DI:** Every DI container file MUST start with `import 'server-only';` at the top to prevent leakage to client bundles.
- **Strict Imports:** Never use relative paths to access Core (e.g., `../../packages/core`). Always use `@canaldigital/packages/core`.

```typescript
// apps/web/features/orders/di/orders.di.ts
import 'server-only';
import { sql } from '@/lib/postgres/server';
import {
  CancelOrderUseCase,
  PostgresOrderRepository,
  PostgresProductRepository,
  PostgresStoreCustomerRepository,
  PostgresEventBusAdapter,
  PostgresTransactionManagerAdapter,
  PostgresBuyerOrderReadRepository,
  BuyerOrderReadRepositoryPort,
} from '@canaldigital/packages/core';

class OrdersDIContainer {
  public resolveCancelOrderUseCase(): CancelOrderUseCase {
    const txManager = new PostgresTransactionManagerAdapter(sql);
    const eventBus = new PostgresEventBusAdapter();
    const orderRepo = new PostgresOrderRepository(eventBus, sql);
    const productRepo = new PostgresProductRepository(sql);
    const customerRepo = new PostgresStoreCustomerRepository();
    return new CancelOrderUseCase(orderRepo, productRepo, customerRepo, eventBus, txManager);
  }

  public resolveBuyerOrderReadRepository(): BuyerOrderReadRepositoryPort {
    return new PostgresBuyerOrderReadRepository(sql);
  }
}

export const ordersDi = new OrdersDIContainer();
```

---

## 4. CQRS-Lite & Data Access Patterns

### 4.1 React Server Components (RSC) — Read Path

**React Server Components are the default rendering mechanism.**

```text
Next.js Page (RSC)
        │
        ▼
Server-Only DI Container (ordersDi.resolveBuyerOrderReadRepository())
        │
        ▼
Application Read Port (BuyerOrderReadRepositoryPort)
        │
        ▼
Infrastructure Read Adapter (PostgresBuyerOrderReadRepository)
        │
        ▼
PostgreSQL / Scoped SQL Query
        │
        ▼
Serializable Read Model (BuyerOrderReadModel[])
        │
        ▼
Presentational Components (<BuyerOrdersList orders={orders} />)
```

- **No Read Use Cases:** Read-only pages (`page.tsx`) DO NOT instantiate Use Cases that merely proxy to repositories. They resolve the read repository port directly from DI.
- **No Direct SQL in Pages:** Pages never execute SQL or access DB connection pools directly.
- **Serializable Props Only:** Only pass plain JSON-serializable primitives (strings, numbers, booleans, arrays of plain objects) to Client Components. Never pass Domain Entities, Value Objects, or DB connection handles.

### 4.2 Server Actions — Mutation Boundary

Server Actions (`.actions.ts`) are HTTP Controllers that accept web requests and drive Use Cases:

```text
Client Form
    │
    ▼
Server Action
    ├── Resolve authenticated session (supabase.auth.getUser())
    ├── Extract allowed FormData fields
    ├── Validate syntax & primitives with Zod
    ├── Build primitive Application DTO
    ├── Resolve Use Case via DI container
    ├── Execute Use Case within try / catch (error: unknown)
    ├── Map Domain/Application exceptions to localized ActionState
    └── Revalidate cache (revalidatePath) & return serializable state
```

#### Mandatory Server Action Rules:

1. **Parse, Don't Validate Business Invariants:** Use **Zod** in `features/[feature]/schemas/` to parse and validate input syntax, types, and required fields. Business rules belong in Core.
2. **Primitive DTOs Only:** Pass flat primitives (`string`, `number`, `boolean`) to Use Cases. Never pass `FormData`, `File`, or Zod objects into Core.
3. **Security & Actor Injection:** Never trust client-submitted actor IDs or tenant IDs. Extract the authenticated `userId` server-side from `supabase.auth.getUser()` and pass it explicitly.
4. **Typed Error Mapping:** Catch `unknown`. Translate typed Domain and Application exceptions (`OrderNotFoundException`, `OptimisticConcurrencyException`) into safe, localized messages. Mask generic errors to prevent leaking internal stack traces.
5. **Safe Redirects:** `redirect('/path')` throws a `NEXT_REDIRECT` error under the hood and MUST ALWAYS be placed **OUTSIDE** the `try/catch` block.

```typescript
// apps/web/features/orders/actions/cancel-order.actions.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { ordersDi } from '@/features/orders/di/orders.di';

export type CancelOrderErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_INPUT'
  | 'ORDER_NOT_FOUND'
  | 'INVALID_ORDER_STATE'
  | 'CONCURRENCY_ERROR'
  | 'UNEXPECTED';

export interface CancelOrderActionState {
  success: boolean;
  errorCode: CancelOrderErrorCode | null;
  message?: string;
}

const CancelOrderSchema = z.object({
  orderId: z.string().uuid(),
});

export async function cancelOrderAction(
  _prevState: CancelOrderActionState,
  formData: FormData,
): Promise<CancelOrderActionState> {
  const t = await getTranslations('Orders.actions');

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, errorCode: 'UNAUTHORIZED', message: t('unauthorized') };
    }

    const parsed = CancelOrderSchema.safeParse({ orderId: formData.get('orderId') });
    if (!parsed.success) {
      return { success: false, errorCode: 'INVALID_INPUT', message: t('invalidInput') };
    }

    const useCase = ordersDi.resolveCancelOrderUseCase();
    await useCase.execute({
      orderId: parsed.data.orderId,
      authenticatedBuyerId: user.id,
    });

    revalidatePath('/');
    return { success: true, errorCode: null, message: t('cancelSuccess') };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'OrderNotFoundException') {
        return { success: false, errorCode: 'ORDER_NOT_FOUND', message: t('orderNotFound') };
      }
      if (error.name === 'InvalidOrderStateException') {
        return {
          success: false,
          errorCode: 'INVALID_ORDER_STATE',
          message: t('invalidOrderState'),
        };
      }
      if (error.name === 'OptimisticConcurrencyException') {
        return { success: false, errorCode: 'CONCURRENCY_ERROR', message: t('concurrencyError') };
      }
    }
    return { success: false, errorCode: 'UNEXPECTED', message: t('unexpectedError') };
  }
}
```

---

## 5. Client Components & UX Patterns (React 19+)

Use `'use client'` only when browser interactivity is strictly required (event handling, interactive dialogs, local form state).

### 5.1 V5 Form Principles

- **Progressive Enhancement:** Forms use React 19 `useActionState(action, initialState)`. Submit buttons observe `pending` state via `useFormStatus()` or the `isPending` tuple member from `useActionState`.
- **Dumb UI:** React components render HTML/Tailwind and emit form events. They NEVER enforce business authority or commercial calculations.
- **Form Persistence (Data Retention):** Forms must never lose user data upon server rejection. Enforce `state.values ?? initialValues` in input fields.
- **Real-Time UX without Mutating Payloads:**
  - Do NOT use aggressive `onKeyDown` blockers or silent data mutations (e.g., transforming `"12abc"` to `"12"`).
  - Use `onBlur` for visual conveniences (e.g., decimal auto-formatting `"40"` -> `"40.00"`).
  - Use `onChange` to clear stale local/server errors instantly.
  - Zod in the Server Action remains the security boundary.

### 5.2 Storage & File Uploads

- **Storage Infrastructure:** We use Supabase Storage. Storage buckets are secured via declarative RLS policies on `storage.objects` bound to `tenant_memberships`, guaranteeing tenant isolation.
- **No Direct Client Uploading to Business Aggregates:** Files are uploaded server-side inside the Server Action (or via secure signed upload sessions) using `crypto.randomUUID()` and prefixed by `tenantId` (`${tenantId}/${uuid}.jpg`).
- **Object Keys & Security:** Never trust client-provided filenames. Map validated MIME types to known extensions.
- **Separation of Concerns:** `File` objects never enter the Core Domain. The Server Action uploads the file, retrieves the string storage path/URL, and passes strictly primitive strings to the Use Case.

### 5.3 Monetary Values and Numeric Inputs

- **Integer Minor Units:** All monetary values are persisted and manipulated in minor units (e.g., Colombian Pesos / Cents as integers).
- **No Floating Point Calculations:** Never calculate authoritative pricing or totals using JavaScript `float` arithmetic.
- **Deterministic Presentation Formatting:** Presentation components format minor units using `Intl.NumberFormat`. Forms collect decimal strings, which are deterministically converted into minor units at the Primary Adapter boundary.

---

## 6. Identity & Access Management (IAM)

- **Unified Identity (AuthN):** A single user entity (`auth.users` in Supabase) is used for authentication across the entire platform. Buyers, sellers, and platform administrators share credentials to centralize security (2FA, sessions).
- **Context Segregation (AuthZ):** Authorization is strictly decoupled from authentication:
  - **B2C Context (Buyers):** Rendered in the main application flow (`/`, `/store/[tenantSlug]`).
  - **B2B / Admin Context (Sellers):** Must be handled in physically isolated UI routes (`/dashboard`, `/seller-dashboard`) with distinct layouts and navigation.
- **Server Guard & Middleware Protection:** Protected routes verify that the user possesses valid tenant membership and permissions before rendering UI or executing Server Actions.

---

## 7. Internationalization (i18n)

- We use `next-intl` via **Cookies** (`NEXT_LOCALE`), NOT sub-routing (`/[locale]/...`).
- **Server Components:** Fetch translations using `await getTranslations('Namespace')` from `next-intl/server`.
- **Client Components:** Use `const t = useTranslations('Namespace')`.
- **No Hardcoded Strings:** All user-facing labels, errors, empty states, and accessibility text must reside in `apps/web/messages/es.json` and `apps/web/messages/en.json`.

---

## 8. General Coding Standards & TypeScript Discipline

- **Strict TypeScript:** `any` is strictly forbidden.
- **Explicit Return Types:** Every function, React Component, Server Action, arrow callback in `.map()`, and DI factory MUST have an explicit return type (e.g., `React.JSX.Element`, `Promise<ActionState>`, `void`). Do not rely on compiler inference.
- **No Empty Objects:** Never use `{}` for generic types (e.g., `postgres.Sql<{}>`). Always use `Record<string, unknown>`.
- **Interface Implementations:** If a class implements an interface but does not use all parameters, omit the unused parameters completely from the method signature rather than prefixing them with `_`.
- **React Side Effects:** Never mutate refs or trigger side effects during the render phase. When setting state upon action completion, avoid synchronous state setting inside effects that trigger cascading renders (`react-hooks/set-state-in-effect`).
- **UI Library:** `shadcn/ui` and Tailwind CSS exclusively. No runtime CSS-in-JS libraries.
- **Commits:** Conventional Commits format (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).

---

## 9. Automated Testing & Architecture Verification

All changes must pass our three-tier testing harness:

1. **Architecture Enforcement (`apps/web/tests/architecture.test.ts`):**
   - Automatically inspects all web files to ensure no component or action instantiates infrastructure directly.
   - Verifies that all DI files contain `import 'server-only';`.
   - Confirms UI components never import Domain Entities or infrastructure adapters directly.
2. **Unit Tests (Core Domain & Use Cases):**
   - Co-located with business logic (e.g., `cancel-order.use-case.test.ts`).
   - Validate domain state machines, entity factory invariants, and Use Case orchestration using mocked ports.
3. **Integration Tests (PostgreSQL & RLS):**
   - Run against real PostgreSQL instances to prove atomic inventory increment/decrement, rollback on failure, optimistic locking (`RETURNING id`), and RLS multi-tenant security.

---

## 10. Mandatory Agent PR Checklist

Before completing any task or pull request, verify:

- [ ] Next.js acts strictly as a Primary Adapter; zero business logic in `apps/web`.
- [ ] Domain Entities guarantee invariants and encapsulate state transitions.
- [ ] Multi-tenant isolation and anti-IDOR checks enforced server-side.
- [ ] Mutation operations execute within atomic PostgreSQL transactions (`TransactionManagerPort`).
- [ ] Read operations follow CQRS-Lite via DI read ports.
- [ ] Zod parses FormData; only flat primitives pass into Core DTOs.
- [ ] Server-only DI is used (`import 'server-only';`).
- [ ] All arrow functions, methods, and components have explicit return types.
- [ ] Zero `any`, zero relative imports (`@/...` used everywhere).
- [ ] User-facing strings localized in `es.json` and `en.json`.
- [ ] `pnpm test` passes 100%.
- [ ] `pnpm lint` (`eslint . --max-warnings=0`) passes with 0 errors and 0 warnings.
