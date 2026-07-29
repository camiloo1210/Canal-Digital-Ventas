---
id: "3c0710ef-4a87-4365-aeee-c0396307b7ee"
title: 'CU-MOD1-04: Solicitar Factura o Ayuda'
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
    id: "f9535740-5e29-404b-a0b9-5dabd28fca24"
---

<!-- [SECTION_START: description] -->

El Comprador Mayorista envía los comandos !factura o !ayuda. El sistema responde con textos predefinidos, explicando la normativa del régimen RIMPE (para facturas) o un menú de opciones (para ayuda).

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. El comprador envía un texto que no es un comando reconocido (ej. "Hola", "Buenas tardes"). -> El sistema no responde automáticamente (para no interrumpir si el vendedor humano está atendiendo el chat).

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El comprador recibe la información solicitada.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

Ninguna específica más allá de tener acceso a WhatsApp.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Comprador Mayorista envía el comando !factura. -> El sistema recibe, valida el webhook (HMAC-SHA256) y procesa el comando.
2. El sistema responde explicando: "Somos Papelería Costa Azul, operamos bajo el régimen RIMPE Negocios Populares. Emitimos notas de venta físicas. Si requiere Factura Electrónica, por favor indíquelo adjuntando su RUC."
3. El Comprador envía el comando !ayuda. -> El sistema recibe, valida y procesa el comando.
4. El sistema responde con un menú: "Bienvenido al canal mayorista. Comandos disponibles: !pedido, !factura, !ayuda. Para atención humana espere unos minutos."

<!-- [SECTION_END: sequence] -->
