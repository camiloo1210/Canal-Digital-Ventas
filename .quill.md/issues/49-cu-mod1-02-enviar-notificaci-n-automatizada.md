---
id: "cc6e010e-a510-4cb1-836f-b301fc623069"
title: 'CU-MOD1-02: Enviar Notificación Automatizada'
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
    id: "5ba580af-0025-496e-b83f-a4008171df71"
---

<!-- [SECTION_START: description] -->

El sistema envía un mensaje automatizado vía WhatsApp al Comprador Mayorista cuando su pedido cambia de estado.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. La API de Meta no responde o devuelve un error. -> El sistema captura el error (Sentry), lo registra, pero no interrumpe ni revierte la transición de estado del pedido principal.

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El mensaje es entregado a la API de Meta. El estado del pedido principal no se ve afectado por el resultado de esta notificación.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El pedido debe haber cambiado de estado en la base de datos. El canal de WhatsApp debe estar configurado.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. (Módulo de Pedidos) Transiciona el estado de un pedido y dispara el evento de notificación asíncrona. -> El sistema intercepta el evento y recupera el número de teléfono del comprador y el nuevo estado del pedido.
2. El sistema formatea la plantilla de texto correspondiente al estado.
3. El sistema realiza una petición HTTP POST a la API v17.0 de Meta Graph con el payload del mensaje.
4. Recibe el mensaje en su aplicación de WhatsApp. -> El sistema registra silenciosamente el éxito del envío en los logs.

<!-- [SECTION_END: sequence] -->
