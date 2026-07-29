---
id: "b5cfe5a2-f510-4fb4-8b6a-bc267c85375f"
title: 'CU-MOD3-03: Pagar Pedido (Pasarela Lemon Squeezy)'
author: AI Agent (MCP)
creation_date: '2026-07-03'
updated_date: '2026-07-03'
issue_type: use-case
status: ready
assignee: dev-2
labels:
  - backend
relations:
  - type: relates_to
    id: "06a9905c-db80-4ea5-bc15-e15943de9aca"
---

<!-- [SECTION_START: description] -->

El Comprador procede a cancelar económicamente el pedido generado. El sistema delega la transacción a una pasarela externa y procesa asíncronamente el resultado mediante un webhook seguro, aplicando reglas de idempotencia.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. El sistema recibe un Webhook pero la firma HMAC-SHA256 es inválida. -> El sistema rechaza la petición con un error HTTP 401 Unauthorized para prevenir fraudes.
2. El sistema recibe un Webhook con un event_id que ya fue procesado. -> El sistema aplica idempotencia: responde HTTP 200 OK a la pasarela pero ignora la actualización.

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El estado del pedido cambia automáticamente a CONFIRMED en la base de datos tras la validación exitosa.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

Debe existir un pedido en estado PENDING.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Comprador Mayorista presiona "Pagar en línea". -> El sistema genera una sesión de pago y redirige al usuario a la URL de Checkout de Lemon Squeezy.
2. El Comprador completa el pago con su tarjeta en la pasarela externa. -> Lemon Squeezy envía una notificación asíncrona (Webhook) al servidor.
3. El sistema intercepta el Webhook y valida la firma criptográfica (HMAC-SHA256) del payload.
4. El sistema verifica la regla de idempotencia.
5. El sistema actualiza el estado del pedido de PENDING a CONFIRMED.

<!-- [SECTION_END: sequence] -->
