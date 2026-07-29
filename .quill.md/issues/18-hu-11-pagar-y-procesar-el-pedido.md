---
id: "06a9905c-db80-4ea5-bc15-e15943de9aca"
title: 'HU-11: Pagar y procesar el pedido'
author: AI Agent (MCP)
creation_date: '2026-07-03'
updated_date: '2026-07-03'
issue_type: user-story
status: ready
assignee: dev-1
labels:
  - frontend
story_points: '8'
relations:
  - type: parent
    id: "4ed22245-f3d2-4130-b0f2-cb814f8a5601"
  - type: depends_on
    id: "a4ab1229-db97-44c6-a7b2-ad250d87bd8d"
---

<!-- [SECTION_START: acceptance] -->

**Dado** que se paga la orden,
**Cuando** el Webhook valida la firma HMAC,
**Entonces** el estado cambia a CONFIRMED.

<!-- [SECTION_END: acceptance] -->

<!-- [SECTION_START: user_story] -->

**Como** Sistema,
**Quiero** pagar y procesar el pedido,
**Para** registrar pagos vía Lemon Squeezy.

<!-- [SECTION_END: user_story] -->
