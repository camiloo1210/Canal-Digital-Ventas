---
id: d6bf2136-7619-472e-abb0-b4b3d6d1aa5f
title: "CU-MOD1-02: Enviar Notificación Automatizada"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
issue_type: use-case
status: open
labels:
  - ai-generated
relations:
  - type: parent
    id: fa9bc998-0e3e-4ade-a972-073717068208
frecuencia: Alta
importancia: Alta
urgencia: Media
integrity_hash: "sha256:f84bac8a54e6bb57ac62b222c6318c31f5b85475ddaf03d35effad861aa097fb"
---

## Actores
<!-- [SECTION_START: Actores] -->
Comprador Mayorista, Módulo de Pedidos
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El sistema envía un mensaje automatizado vía WhatsApp al Comprador Mayorista cuando su pedido cambia de estado (ej. de PENDING a CONFIRMED, o a SHIPPED).
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 La API de Meta no responde o devuelve un error (ej. número inválido). -> El sistema captura el error (Sentry), lo registra, pero no interrumpe ni revierte la transición de estado del pedido principal.
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 (Módulo de Pedidos) Transiciona el estado de un pedido y dispara el evento de notificación asíncrona. -> El sistema intercepta el evento y recupera el número de teléfono del comprador y el nuevo estado del pedido.
2 -> El sistema formatea la plantilla de texto correspondiente al estado (ej. "Su pedido #123 ha sido confirmado").
3 -> El sistema realiza una petición HTTP POST a la API v17.0 de Meta Graph con el payload del mensaje.
4 Recibe el mensaje en su aplicación de WhatsApp. -> El sistema registra silenciosamente el éxito del envío en los logs.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
El mensaje es entregado a la API de Meta. El estado del pedido principal no se ve afectado por el resultado de esta notificación
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El pedido debe haber cambiado de estado en la base de datos. El canal de WhatsApp debe estar configurado
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
El sistema aplica un Rate-limiting de salida y entrada (Upstash Redis) garantizando un máximo de 1000 solicitudes por 60 segundos por IP.
<!-- [SECTION_END: Rendimiento] -->
