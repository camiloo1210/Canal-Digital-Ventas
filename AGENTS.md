<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**IMPORTANT KNOWN CHANGES:**

- The `middleware.ts` file convention is deprecated. Use `proxy.ts` instead and export a function named `proxy`.

<!-- END:nextjs-agent-rules -->

# Canal Digital Ventas - Strict AI Coding Guidelines

**CRITICAL:** This project is destined for production and follows extremely strict software engineering practices. AI agents MUST abide by these rules 100% of the time. Shortcuts, hacks, or "quick fixes" are strictly forbidden.

## 1. Architecture & Repository Structure

- **Monorepo (PNPM Workspaces):**
  - `app/` (or `apps/`): Contains the Next.js frontend application.
  - `packages/core/`: Contains the pure business logic.
- **Pattern:** Strict Domain-Driven Design (DDD) + Hexagonal Architecture (Ports and Adapters) + Vertical Slicing.

## 2. Core Logic Rules (`packages/core`)

All business logic MUST reside here, fully decoupled from any framework (React/Next.js) or specific database (unless inside an infrastructure adapter).

- **Vertical Slicing:** Code is organized by feature, not by technical concern. (e.g., `features/categories`, `features/products`).
- **Domain Layer (`domain/`):**
  - **Rich Entities:** Entities must encapsulate all state and logic. No anemic domain models (data bags with getters/setters). State mutation must happen via explicit business actions (e.g., `entity.archive()`, `entity.updateStatus()`).
  - **Invariants:** Entities MUST guarantee their validity upon creation. Use private constructors and static factory methods (e.g., `Category.create(...)`).
  - **Value Objects (VO):** Use VOs for domain primitives (e.g., `CategoryName`, `Money`). Validation of format/rules belongs inside the VO.
  - **Exceptions (Domain vs Application):** NEVER throw generic `Error` objects.
    - **Domain Exceptions (`domain/exceptions/`):** Use for pure business rule or invariant violations inside Entities/VOs (e.g., `InvalidCategoryStatusException`). Must extend `DomainException`.
    - **Application Exceptions (`application/exceptions/`):** Use for errors arising from Use Case orchestration or interactions with external ports (e.g., `ProductRepositoryException`, `TenantNotConfiguredException`). Must extend `ApplicationException`.
    - **Infrastructure Exception Hierarchy:** `InfrastructureException` extends `ApplicationException` and MUST be defined in `shared/application/exceptions/`, NOT in any `infrastructure/` folder. Repository and gateway exceptions extend `InfrastructureException` and are placed in `feature/application/exceptions/`. Adapters translate vendor-specific errors into these typed exceptions.
- **Application Layer (`application/`):**
  - **Use Cases:** Expose application capabilities. Use Cases orchestrate domain entities and delegate to ports. They take DTOs as input.
  - **Ports (Out):** Define interfaces for any external I/O (e.g., `CategoryRepositoryPort`). Use Cases rely ONLY on these interfaces (Dependency Inversion).
- **Infrastructure Layer (`infrastructure/`):**
  - **Adapters:** This is the ONLY place where implementations like Supabase, HTTP clients, or DB drivers are allowed (e.g., `SupabaseCategoryRepository`).
  - **Exception Translation (Adapter Pattern):** Adapters MUST catch technology-specific errors (like `SupabaseError` or `PostgresError`) and translate them into `ApplicationException` (e.g. `ProductRepositoryException`) before throwing them back to the Use Case. Never leak infrastructure errors or use raw `Error` objects.

## 2.1 Database Atomic Transaction Boundaries (STATE OF THE ART)

We strictly dictate **"Option A" (TransactionManager controlled by Node.js Adapter)** over monolithic Postgres RPCs for complex aggregates.

- All database mutation Use Cases MUST rely on a `TransactionManagerPort` to wrap multiple repository executions in a single physical `BEGIN/COMMIT` Postgres block.
- **Do not** write massive "One-RPC-fixes-all" Postgres functions to wrap bounded contexts (e.g. `create_product_transaction`). This abstracts the Domain away from TypeScript into SQL, destroying Hexagonal cleanlyness.
- Use explicit, narrow `SECURITY DEFINER` RPCs in DB exclusively for individual security/fencing steps (like acquiring idempotent leases or appending outbox logs), which are all fired synchronously using the scoped Node.js connection pool transactor (`sqlTx`).

## 🖥️ FRONTEND ARCHITECTURE RULES (NEXT.JS PRIMARY ADAPTER)

The Next.js application (`apps/web`) acts EXCLUSIVELY as the **Primary/Driving Adapter** in our Hexagonal Architecture. It is essentially a "dumb" delivery mechanism. **ZERO business logic, domain rules, or state validations are allowed in the Next.js layer.**

If you are generating or modifying code in `apps/web`, you MUST strictly adhere to the following rules:

### 0. Zero Tolerance Rules (STRICTLY MANDATORY)

- **Zero `any` or implicit types.** Absolute typing is guaranteed.
- **Zero relative imports (`./` or `../`).** Strictly use absolute aliases (`@/...`).
- **Primary Adapter (Mechanical Delivery):** The frontend ONLY orchestrates FormData (primitives) -> Zod -> Pure DTOs into Use Cases.

### 1. Monorepo Boundaries & Dependency Injection (DI)

- **Strict Imports:** Never use relative paths to access the core package (e.g., `../../../packages/core`). Always use the designated package import (e.g., `import { SignInUseCase } from '@canaldigital/core/iam';`).
- **Centralized DI Container:** Server Actions and Server Components MUST NOT instantiate Use Cases or Infrastructure Adapters (like `SupabaseRepository`) inline. You must resolve all dependencies through a specific DI file (e.g., `features/[feature]/di/[feature].di.ts`).
- **Server-Only DI:** DI files must always include `import 'server-only';` at the top.

### 2. Thin Controllers (Server Actions)

Server Actions (`.actions.ts`) are our mutation boundaries. They must act strictly as HTTP Controllers:

- **Parse, Don't Validate:** You MUST use **Zod** to safely parse `FormData` into flat, primitive objects before interacting with the Core.
- **Primitive DTOs Only:** Pass only primitive types (`string`, `number`, `boolean`) to the Core Use Cases. Do NOT pass Domain Entities, Branded Types, or Web API objects (like `File` or `FormData`) into the core.
- **Security / Context Injection:** Never trust hidden form inputs for critical identifiers (like `userId`). Always extract the `userId` securely from the server session (e.g., `supabase.auth.getUser()`) inside the Server Action and pass it explicitly to the Use Case.
- **Graceful Error Handling:** Wrap Use Case executions in a `try/catch (error: unknown)`. Catch `DomainException` to return safe, user-friendly UI errors. Mask generic/database errors to prevent leaking stack traces.
- **Safe Redirects:** `redirect('/path')` throws a `NEXT_REDIRECT` error under the hood. It MUST ALWAYS be placed **OUTSIDE** the `try/catch` block.

### 3. CQRS-Lite (React Server Components)

- **No Read Use Cases:** For pages (`page.tsx`) that display data, DO NOT route the request through a Use Case.
- **Direct Repository Reads:** Inject the Infrastructure Repository directly via the DI container and perform direct server-side reads. This is the official App Router CQRS-lite pattern for maximum performance and SEO.

### 4. Client Components & UI (React 19+)

- **Progressive Enhancement:** Forms must use `'use client'`, `useActionState` (or `useFormState`), and a separate submit button using `useFormStatus()`. Do not use `onSubmit` with `preventDefault()` unless strictly required by a complex client-side interaction.
- **Dumb UI:** React components only render HTML/Tailwind and emit forms. State machines or business rules must not pollute the DOM layer.
- **UI Library (shadcn/ui + Tailwind CSS):** We use `shadcn/ui` and Tailwind CSS exclusively. DO NOT use runtime CSS-in-JS libraries (e.g., MUI, Chakra UI, Ant Design) as they degrade React Server Components (RSC) performance.
- **File Uploads (Infrastructure):** If a file upload is required, the Server Action handles the upload to the Storage Bucket, receives the string URL/Path, and passes ONLY the primitive string to the Core Use Case.

### 5. Internationalization (i18n)

- We use `next-intl` via **Cookies** (`NEXT_LOCALE`), NOT sub-routing (`/[locale]/...`).
- In Server Components, fetch translations using `await getTranslations('Namespace')` from `next-intl/server`.
- For Client Components, pass strictly needed translations via `NextIntlClientProvider` to avoid bundle bloat.

## 4. Identity & Access Management (IAM)

- **Unified Identity (AuthN):** A single user entity (`auth.users` in Supabase) must be used for authentication across the entire platform. Buyers and sellers/admins are the same physical person and must share the same credentials to reduce friction and centralize security (e.g., 2FA).
- **Context Segregation (AuthZ):** Authorization must be strictly decoupled from authentication.
  - **B2C Context (Buyers):** Rendered in the main application flow.
  - **B2B/Admin Context (Sellers):** Must be handled in physically isolated UI routes (e.g., `/seller-dashboard` or a separate subdomain) with distinct navigation.
- **Middleware Protection:** The entry point to any admin/seller context must be protected by middleware (or a centralized guard) that verifies the user possesses the appropriate Role/Tenant permissions before rendering the UI.

## 5. General Coding Standards

- **Strict TypeScript:** `any` is strictly forbidden. All variables, returns, and parameters must have strict types.
- **Tooling:** You must respect ESLint, Prettier, and TypeScript compiler rules. Do not bypass them.
- **Commits:** Follow Conventional Commits format exactly (configured via Commitlint/Husky).

**Failure to follow these rules compromises the integrity of the project.** Think step-by-step and ensure every piece of code aligns with this architecture.
