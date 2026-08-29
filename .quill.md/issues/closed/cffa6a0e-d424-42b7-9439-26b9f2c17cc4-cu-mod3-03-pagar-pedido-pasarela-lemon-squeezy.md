---
id: cffa6a0e-d424-42b7-9439-26b9f2c17cc4
title: "CU-MOD3-03: Pagar Pedido (Pasarela Lemon Squeezy)"
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
urgencia: Alta
integrity_hash: "sha256:9da631a191c469dfe1a76a29c11a7703d4f799dd9ef3419c2c12a7b252d9ca61"
---

## Actores
<!-- [SECTION_START: Actores] -->
Comprador Mayorista.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Comprador procede a cancelar económicamente el pedido generado. El sistema delega la transacción a una pasarela externa y procesa asíncronamente el resultado mediante un webhook seguro, aplicando reglas de idempotencia.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 El sistema recibe un Webhook pero la firma HMAC-SHA256 es inválida. -> El sistema rechaza la petición con un error HTTP 401 Unauthorized para prevenir fraudes.
2 El sistema recibe un Webhook con un event_id que ya fue procesado. -> El sistema aplica idempotencia: responde HTTP 200 OK a la pasarela (para que deje de intentar) pero ignora la actualización del pedido.
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Comprador Mayorista presiona "Pagar en línea". -> El sistema genera una sesión de pago y redirige al usuario a la URL de Checkout de Lemon Squeezy.
2 El Comprador completa el pago con su tarjeta en la pasarela externa. -> Lemon Squeezy envía una notificación asíncrona (Webhook) al servidor del sistema indicando el pago exitoso.
3 -> El sistema intercepta el Webhook y valida la firma criptográfica (HMAC-SHA256) del payload.
4 -> El sistema verifica la regla de idempotencia (comprueba que el event_id del pago no haya sido procesado previamente).
5 -> El sistema actualiza el estado del pedido de PENDING a CONFIRMED.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
El estado del pedido cambia automáticamente a CONFIRMED en la base de datos tras la validación exitosa.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
Debe existir un pedido en estado PENDING.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
El procesamiento del webhook y la actualización en base de datos debe ejecutarse en menos de 1 segundo para evitar timeouts en la pasarela.
<!-- [SECTION_END: Rendimiento] -->
