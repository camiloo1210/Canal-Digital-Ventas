# Pull Request: V5 Storefront Architecture & Domain Hardening

## Description

This Pull Request introduces the V5 architectural hardening for the core product and category domains, alongside the implementation of the public storefront interface. All modifications strictly adhere to the project's Hexagonal Architecture, Vertical Slicing, and Clean Code principles.

### Key Architectural Changes

1. **Domain & Forms Hardening (V5)**:
   - Migrated category and product forms to strictly typed V5 architecture using Zod boundaries.
   - Enforced primitive extraction from `FormData` to prevent leaking `File` or unvalidated objects into the core domain.
   - Removed HTML `maxLength` limitations in favor of explicit UI validation feedback driven entirely by Zod.
   - Implemented real-time formatting (e.g., SKU casing, money minor units).

2. **Public Storefront Implementation**:
   - Developed the public product grid and isolated product detail view (`app/store/[tenantSlug]/products/[productId]/page.tsx`).
   - Configured pages as pure React Server Components (RSC) to minimize client-side JavaScript overhead.
   - Implemented Mercado Libre / Amazon e-commerce standards for the product detail layout.
   - Applied the "Stretched Link" CSS pattern to catalog cards to ensure robust HTML nesting (preventing `<Link>` within `<Link>` hydration errors) while maintaining full interactivity.

3. **Infrastructure & Security**:
   - Created `PublicProductDetailReadModel` to separate grid data from detail data, preserving grid query performance.
   - Deployed hardened PostgreSQL `SECURITY DEFINER` RPCs (`get_public_product_by_id`) strictly scoped by `tenantSlug`.
   - Resolved PL/pgSQL strictness errors by meticulously mapping `VARCHAR` types in the `RETURNS TABLE` definitions.

4. **Codebase Sanitation**:
   - Executed a global audit replacing all legacy relative imports (`./`, `../`) with absolute aliases (`@/...`) to comply with monorepo strict boundaries.
   - Verified the elimination of unused imports and excessive documentation comments, aligning with Clean Code practices.
   - History restructured using interactive rebase to ensure 100% compliance with `husky`, `commitlint`, and `cz` (Commitizen) standards, including extended body descriptions.

## Related Quill MD Issues

This branch involves and resolves several technical requirements defined in the `.quill.md` issue tracker:

- **Addresses [CU-MOD6-01: Crear, Editar y Eliminar Productos](/.quill.md/issues/open/4e827f18-62cf-4a56-913a-fcda56ac82e0-cu-mod6-01-crear-editar-y-eliminar-productos.md)**
  - **Fulfillment**: Partially Fulfilled.
  - **Justification**: The core CRUD boundaries, Zod validation, and UI forms have been fully hardened to V5 standards. Image persistence in Supabase Storage and `image_url` saving is implemented and strictly typed.

- **Addresses [CU-MOD6-03: Gestionar Categorías y Niveles de Stock](/.quill.md/issues/open/000e03fb-32bf-4228-920a-1ea3ae81a362-cu-mod6-03-gestionar-categorias-y-niveles-de-stock.md)**
  - **Fulfillment**: Partially Fulfilled.
  - **Justification**: Categories CRUD has been fully migrated to V5 forms, ensuring strict type inference for `safeParse` data and proper state resets. Stock management UI remains pending.

- **Addresses [CU-MOD2-01: Visualizar Catálogo y Precios Mayoristas](/.quill.md/issues/open/522238b4-2ae2-4651-af4e-d7483b816725-cu-mod2-01-visualizar-catalogo-y-precios-mayoristas.md)**
  - **Fulfillment**: Partially Fulfilled.
  - **Justification**: The storefront grid is completely operational. It renders responsively (1-4 columns), eludes static caching using Server Components for real-time reads, and correctly formats prices. Wholesale specific badging remains pending based on active user context.

## Pre-Merge Checklist

- [x] All commits adhere strictly to `cz` (Conventional Commits) format.
- [x] All commits include an extended body detailing architectural decisions.
- [x] `pnpm run commit` and `lint-staged` pre-commit hooks pass locally without errors.
- [x] Zero relative imports exist in the modified files.
- [x] Zero `any` types or implicit assumptions.
- [x] UI strings are fully localized using `next-intl` (no hardcoded text).
- [x] Clean Code verification: No excessive or dead comments left in the components.
