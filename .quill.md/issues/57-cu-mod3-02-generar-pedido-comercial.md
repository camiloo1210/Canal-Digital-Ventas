---
id: "a1b0edb0-b58d-45bd-8da8-a0309882a25f"
title: 'CU-MOD3-02: Generar Pedido Comercial'
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
    id: "a4ab1229-db97-44c6-a7b2-ad250d87bd8d"
---

<!-- [SECTION_START: description] -->

El Comprador Mayorista finaliza la selección de su carrito y confirma la orden. El sistema valida la sesión del usuario, calcula los totales definitivos y registra el pedido en la base de datos con el estado inicial PENDING.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. El usuario no está autenticado al presionar "Confirmar". -> El sistema detiene el flujo y redirige al usuario a la pantalla de Login/Registro.

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

Se crea un registro transaccional en la tabla de pedidos, se vacía el carrito local y el flujo queda habilitado para el pago.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El carrito de compras no debe estar vacío. El usuario debe estar autenticado en el sistema.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Comprador Mayorista navega a la vista de "Checkout" y presiona "Confirmar Pedido". -> El sistema verifica el estado de autenticación (sesión activa) del usuario.
2. El sistema realiza una validación final de stock de todos los ítems del carrito contra la base de datos (Server Action).
3. El sistema calcula el total a pagar y genera un nuevo registro de pedido con estado PENDING.
4. El sistema limpia la persistencia local del carrito y redirige al usuario a la pantalla de resumen / pago.

<!-- [SECTION_END: sequence] -->
