---
id: "962f258a-2c20-41f2-be1f-53d8a2fcba7e"
title: 'CU-MOD3-04: Cambiar Estado del Pedido'
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
    id: "600c18bf-ca5a-4693-b455-434cf1683f62"
---

<!-- [SECTION_START: description] -->

El Vendedor gestiona el ciclo de vida logístico del pedido una vez que ha sido confirmado. Utiliza la interfaz operativa interna para transicionar la orden a los estados SHIPPED (Enviado) y DELIVERED (Entregado).

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. Un usuario sin permisos operativos intenta acceder al endpoint de actualización de estado. -> El sistema bloquea la acción mediante Middleware devolviendo un error 403 Forbidden.

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El estado de la orden se actualiza en la base de datos (lo que dispara el Módulo de Notificaciones al cliente).

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El usuario debe estar autenticado con un perfil operativo válido. El pedido debe estar en estado CONFIRMED o superior.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Vendedor accede a la bandeja de gestión de pedidos en el panel de control. -> El sistema despliega la lista de pedidos activos.
2. El Vendedor selecciona un pedido confirmado y hace clic en "Marcar como Enviado". -> El sistema valida la autorización del vendedor.
3. El sistema actualiza el registro en la base de datos, cambiando el estado a SHIPPED.

<!-- [SECTION_END: sequence] -->
