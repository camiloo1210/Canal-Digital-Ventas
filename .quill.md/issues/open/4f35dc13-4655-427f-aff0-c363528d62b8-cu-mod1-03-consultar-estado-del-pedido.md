---
id: 4f35dc13-4655-427f-aff0-c363528d62b8
title: "CU-MOD1-03: Consultar Estado del Pedido"
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
integrity_hash: "sha256:1a009264d579e5250c2feeee9a4b79ccdc3dbae514ddd7d702645fadeeb977fe"
---

## Actores
<!-- [SECTION_START: Actores] -->
Comprador Mayorista
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Comprador Mayorista interactúa con el sistema enviando el comando !pedido a través de WhatsApp. El sistema procesa el webhook entrante, valida la firma de seguridad y responde con el estado de su último pedido activo
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 Meta envía un Webhook pero la firma HMAC-SHA256 no coincide (intento de suplantación). -> El sistema detiene el proceso mediante una comparación de tiempo constante y devuelve un error HTTP 401 Unauthorized, descartando el payload.
2 El comprador envía una imagen o nota de voz con el texto !pedido como comentario. -> El sistema detecta que el tipo de mensaje no es texto puro y lo descarta silenciosamente.
3 El comprador no tiene pedidos registrados en el sistema. -> El sistema responde vía WhatsApp: "Actualmente no tienes pedidos registrados en la Papelería Costa Azul."
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Comprador Mayorista envía el texto !pedido al número de WhatsApp de la papelería. -> Meta envía un Webhook al sistema. El sistema recibe el payload y ejecuta la validación de la firma HMAC-SHA256 (RNF-01).
2 -> El sistema verifica que el mensaje sea de tipo text.
3 -> El sistema extrae el número de teléfono remitente, busca al usuario en la base de datos y consulta su último pedido (ordenado por fecha de creación descendente).
4 -> El sistema envía una petición a la API de Meta respondiendo: "El estado de su último pedido (#ID) es: [ESTADO]".
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
El comprador recibe la información actualizada de su pedido en WhatsApp.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El comprador debe enviar el mensaje desde el número de teléfono registrado en su perfil del sistema.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
La validación HMAC-SHA256 utiliza comparación de tiempo constante para evitar ataques de timing. Todo el ciclo de respuesta debe ser menor a 2 segundos.
<!-- [SECTION_END: Rendimiento] -->
