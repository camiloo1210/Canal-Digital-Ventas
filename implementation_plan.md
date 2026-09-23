# Implementation Plan: Storefront UI / State-of-the-Art Alignment

Este plan detalla la estrategia para actualizar visualmente la vitrina pública (Storefront) de modo que se alinee con el lenguaje de diseño "State-of-the-Art" que ya se utiliza en el Dashboard de administración. **El alcance es 100% visual y presentacional. No se alterará ninguna lógica de negocio, arquitectura, ruteo ni estructura de i18n.**

## Estado Actual vs Objetivo
Actualmente, el Storefront (`app/store/[tenantSlug]`) utiliza clases utilitarias de Tailwind rígidas (`text-gray-900`, `bg-white`, `border-gray-200`, `bg-black`). Esto rompe con el sistema de temas (Light/Dark mode) y luce distinto a los componentes pulidos del Dashboard (Shadcn UI).

El objetivo es migrar hacia **Colores Semánticos** y **Componentes de Shadcn** para que ambas áreas compartan el mismo ADN estético.

## Cambios Propuestos

### 1. Reemplazo de Colores Hardcodeados por Tokens Semánticos
En todos los componentes del Storefront, se sustituirán las paletas fijas por variables de CSS del tema:
- `text-gray-900` → `text-foreground`
- `text-gray-600` / `text-gray-500` → `text-muted-foreground`
- `bg-white` → `bg-background` o `bg-card`
- `border-gray-200` / `border-gray-300` → `border-border`
- `bg-black` / `text-white` → `bg-primary text-primary-foreground`
- `bg-gray-100` → `bg-muted` o `bg-accent`

### 2. Refactor de Componentes hacia Shadcn UI
Se reemplazarán los elementos nativos HTML crudos por las primitivas de diseño importadas de `@/components/ui/`:

- **`StoreProductGrid`**: 
  - Se sustituirá el `<div className="border rounded-lg...">` por el ecosistema `<Card>`, `<CardHeader>`, `<CardTitle>`, y `<CardContent>`.
  - El diseño visual de cada tarjeta será idéntico o muy cercano a la versión administrativa (con la imagen aspect-ratio correcta, tipografía `tracking-tight`, y badges si aplica).

- **`StoreSearchBar`**: 
  - Se cambiará el `<input type="search">` nativo por el componente `<Input>`.
  - Se cambiará el `<button>` crudo por el componente `<Button variant="default">`.
  - Mismos estados de focus (`focus-visible:ring-ring`).

- **`StoreCategorySidebar`**: 
  - Se actualizarán los enlaces de navegación de categorías. El enlace activo usará el fondo de `bg-primary text-primary-foreground` (o el estilo análogo del tema), y los enlaces inactivos usarán estilos de botón fantasma `hover:bg-accent hover:text-accent-foreground`.

- **`app/store/[tenantSlug]/page.tsx` (Layout & Tipografía)**:
  - Se alineará la tipografía del H1 y párrafos para coincidir con la jerarquía del Dashboard (ej. usando la clase `tracking-tight` para los títulos).

### 3. Preservación Estricta de Lógica
- **No se tocarán** las peticiones al repositorio, ni los parsers Zod de URL, ni el manejo del `LocaleSwitcher`, ni las props pasadas por `getTranslations()`.
- La funcionalidad del SearchBar para modificar `?q=` seguirá operando igual.

## Verificación
- Se revisará el modo Claro y Oscuro del Storefront; la interfaz debe mutar de colores de forma consistente sin contrastes rotos.
- Comparación visual del `ProductCard` público vs el administrativo para validar la unificación estética.
- Ejecución de `npm run test` y `npx tsc --noEmit` para garantizar que el refactor visual no interfirió con las interfaces de TypeScript.
