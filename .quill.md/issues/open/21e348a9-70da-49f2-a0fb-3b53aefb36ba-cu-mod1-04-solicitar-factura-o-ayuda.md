---
id: 21e348a9-70da-49f2-a0fb-3b53aefb36ba
title: "CU-MOD1-04: Solicitar Factura o Ayuda"
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
frecuencia: Media
importancia: Media
urgencia: Media
integrity_hash: "sha256:f177d1ed31a15b6819c61e0368271d9526b0ae1c46d078117d1566cb0a75fb78"
---

## Actores
<!-- [SECTION_START: Actores] -->
Comprador Mayorista
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Comprador Mayorista envía los comandos !factura o !ayuda. El sistema responde con textos predefinidos, explicando la normativa del régimen RIMPE (para facturas) o un menú de opciones (para ayuda).
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 El comprador envía un texto que no es un comando reconocido (ej. "Hola", "Buenas tardes"). -> El sistema no responde automáticamente (para no interrumpir si el vendedor humano está atendiendo el chat).
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Comprador Mayorista envía el comando !factura. -> El sistema recibe, valida el webhook (HMAC-SHA256) y procesa el comando.
2 -> El sistema responde explicando: "Somos Papelería Costa Azul, operamos bajo el régimen RIMPE Negocios Populares. Emitimos notas de venta físicas. Si requiere Factura Electrónica, por favor indíquelo adjuntando su RUC."
3 El Comprador envía el comando !ayuda. -> El sistema recibe, valida y procesa el comando.
4 -> El sistema responde con un menú: "Bienvenido al canal mayorista. Comandos disponibles: !pedido, !factura, !ayuda. Para atención humana espere unos minutos."
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
El comprador recibe la información solicitada.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
Ninguna específica más allá de tener acceso a WhatsApp.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
La respuesta automatizada se procesa y envía a la API de Meta en menos de 2 segundos. Sujeto al rate-limit de IP configurado en Redis.
<!-- [SECTION_END: Rendimiento] -->
