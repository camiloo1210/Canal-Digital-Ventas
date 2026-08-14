<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
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
  - **Exceptions:** Throw custom domain exceptions extending `DomainException` (e.g., `InvalidCategoryStatusException`). NEVER throw generic `Error` objects.
- **Application Layer (`application/`):**
  - **Use Cases:** Expose application capabilities. Use Cases orchestrate domain entities and delegate to ports. They take DTOs as input.
  - **Ports (Out):** Define interfaces for any external I/O (e.g., `CategoryRepositoryPort`). Use Cases rely ONLY on these interfaces (Dependency Inversion).
- **Infrastructure Layer (`infrastructure/`):**
  - **Adapters:** This is the ONLY place where implementations like Supabase, HTTP clients, or DB drivers are allowed (e.g., `SupabaseCategoryRepository`).

## 3. Frontend Rules (Next.js App)

- **Zero Business Logic in UI:** The frontend is just an I/O delivery mechanism. It MUST NOT contain core business logic.
- **Integration:** The Next.js app must instantiate and consume the Use Cases from `@canaldigital/packages/core` (via Server Actions or Route Handlers).
- **Boundary Validation:** Data coming from the client MUST be validated (e.g., using Zod) at the Next.js boundary (Server Actions/API) before being mapped to DTOs and passed to the `core` Use Cases.
- **Dependency Injection:** Repositories must be instantiated at the server level and injected into Use Cases.

## 4. General Coding Standards

- **Strict TypeScript:** `any` is strictly forbidden. All variables, returns, and parameters must have strict types.
- **Tooling:** You must respect ESLint, Prettier, and TypeScript compiler rules. Do not bypass them.
- **Commits:** Follow Conventional Commits format exactly (configured via Commitlint/Husky).

**Failure to follow these rules compromises the integrity of the project.** Think step-by-step and ensure every piece of code aligns with this architecture.
