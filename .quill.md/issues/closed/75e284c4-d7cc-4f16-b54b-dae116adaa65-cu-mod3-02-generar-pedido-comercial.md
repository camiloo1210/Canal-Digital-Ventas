---
id: 75e284c4-d7cc-4f16-b54b-dae116adaa65
title: "CU-MOD3-02: Generar Pedido Comercial"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-08-29"
issue_type: use-case
status: done
labels:
  - ai-generated
relations:
  - type: parent
    id: a80dfdb8-a769-4a1a-8f93-ba7c29cd16a6
frecuencia: Alta
importancia: Vital
urgencia: Inmediata
integrity_hash: "sha256:d805c53b987957edbe95be7dbdeacb1b14b18d57e9c7dc13829b418aaaf9378b"
---

## Actores
<!-- [SECTION_START: Actores] -->
Comprador Mayorista.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Comprador Mayorista finaliza la selección de su carrito y confirma la orden. El sistema valida la sesión del usuario, calcula los totales definitivos y registra el pedido en la base de datos con el estado inicial PENDING.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 El usuario no está autenticado al presionar "Confirmar". -> El sistema detiene el flujo y redirige al usuario a la pantalla de Login/Registro.
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Comprador Mayorista navega a la vista de "Checkout" y presiona "Confirmar Pedido". -> El sistema verifica el estado de autenticación (sesión activa) del usuario.
2 -> El sistema realiza una validación final de stock de todos los ítems del carrito contra la base de datos (Server Action).
3 -> El sistema calcula el total a pagar y genera un nuevo registro de pedido con estado PENDING.
4 -> El sistema limpia la persistencia local del carrito y redirige al usuario a la pantalla de resumen / pago.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
Se crea un registro transaccional en la tabla de pedidos, se vacía el carrito local y el flujo queda habilitado para el pago.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El carrito de compras no debe estar vacío. El usuario debe estar autenticado en el sistema.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
La creación transaccional del pedido en Supabase (PostgreSQL) debe completarse en un máximo de 800 milisegundos.
<!-- [SECTION_END: Rendimiento] -->
