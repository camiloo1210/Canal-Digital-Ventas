---
id: "7bef8b29-79a1-4972-97ac-21bee02fd5ff"
title: 'CU-MOD3-05: Cancelar Pedido'
author: AI Agent (MCP)
creation_date: '2026-07-03'
updated_date: '2026-07-03'
issue_type: use-case
status: ready
assignee: dev-1
labels:
  - frontend
relations:
  - type: relates_to
    id: "6b256a70-93b4-47cc-bdf3-4115e0a89f72"
---

<!-- [SECTION_START: description] -->

Anula una orden comercial existente. Puede ser ejecutado por el Comprador (solo si el pedido aún no ha sido pagado) o por el Vendedor (por motivos administrativos o de falta de stock físico).

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. El Comprador Mayorista intenta cancelar un pedido que ya está en estado CONFIRMED o SHIPPED. -> El sistema oculta el botón de cancelación en la UI. Si se intenta forzar por API, rechaza con un error de lógica de negocio.

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El estado del pedido se actualiza a CANCELLED y se cierra su ciclo de vida.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El pedido debe existir en el sistema. Para que el comprador pueda cancelarlo, el estado debe ser estrictamente PENDING.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Actor (Comprador o Vendedor) visualiza el detalle del pedido y hace clic en "Cancelar Pedido". -> El sistema recibe la petición y verifica el rol del usuario contra el estado actual del pedido.
2. Si es el Comprador y el estado es PENDING, el sistema autoriza la operación. Si es el Vendedor, autoriza la operación por defecto.
3. El sistema actualiza el registro en la base de datos a CANCELLED.

<!-- [SECTION_END: sequence] -->
