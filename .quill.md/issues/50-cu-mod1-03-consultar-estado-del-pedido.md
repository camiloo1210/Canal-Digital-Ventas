---
id: "c53a018d-aa71-4804-9e49-ed4d61c06f81"
title: 'CU-MOD1-03: Consultar Estado del Pedido'
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
    id: "45e88fbd-8758-4786-8452-7c73787361ab"
---

<!-- [SECTION_START: description] -->

El Comprador Mayorista interactúa con el sistema enviando el comando !pedido a través de WhatsApp. El sistema procesa el webhook entrante, valida la firma de seguridad y responde con el estado de su último pedido activo.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. Meta envía un Webhook pero la firma HMAC-SHA256 no coincide (intento de suplantación). -> El sistema detiene el proceso mediante una comparación de tiempo constante y devuelve un error HTTP 401 Unauthorized, descartando el payload.
2. El comprador envía una imagen o nota de voz con el texto !pedido como comentario. -> El sistema detecta que el tipo de mensaje no es texto puro y lo descarta silenciosamente.
3. El comprador no tiene pedidos registrados en el sistema. -> El sistema responde vía WhatsApp: "Actualmente no tienes pedidos registrados en la Papelería Costa Azul."

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El comprador recibe la información actualizada de su pedido en WhatsApp.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El comprador debe enviar el mensaje desde el número de teléfono registrado en su perfil del sistema.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Comprador Mayorista envía el texto !pedido al número de WhatsApp de la papelería. -> Meta envía un Webhook al sistema. El sistema recibe el payload y ejecuta la validación de la firma HMAC-SHA256.
2. El sistema verifica que el mensaje sea de tipo text.
3. El sistema extrae el número de teléfono remitente, busca al usuario en la base de datos y consulta su último pedido (ordenado por fecha de creación descendente).
4. El sistema envía una petición a la API de Meta respondiendo: "El estado de su último pedido (#ID) es: [ESTADO]".

<!-- [SECTION_END: sequence] -->
