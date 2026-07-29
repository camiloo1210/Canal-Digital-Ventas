---
id: "6b256a70-93b4-47cc-bdf3-4115e0a89f72"
title: 'HU-13: Cancelar mi pedido'
author: AI Agent (MCP)
creation_date: '2026-07-03'
updated_date: '2026-07-03'
issue_type: user-story
status: ready
assignee: dev-1
labels:
  - frontend
story_points: '2'
relations:
  - type: parent
    id: "4ed22245-f3d2-4130-b0f2-cb814f8a5601"
  - type: depends_on
    id: "600c18bf-ca5a-4693-b455-434cf1683f62"
---

<!-- [SECTION_START: acceptance] -->

**Dado** que el estado es PENDING,
**Cuando** presiono cancelar,
**Entonces** el registro muta a CANCELLED y libera stock.

<!-- [SECTION_END: acceptance] -->

<!-- [SECTION_START: user_story] -->

**Como** Comprador,
**Quiero** cancelar mi pedido,
**Para** anular compras no deseadas.

<!-- [SECTION_END: user_story] -->
