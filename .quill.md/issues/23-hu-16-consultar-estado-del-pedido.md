---
id: "45e88fbd-8758-4786-8452-7c73787361ab"
title: 'HU-16: Consultar estado del pedido'
author: AI Agent (MCP)
creation_date: '2026-07-03'
updated_date: '2026-07-03'
issue_type: user-story
status: ready
assignee: dev-1
labels:
  - frontend
story_points: '3'
relations:
  - type: parent
    id: "a2f1393c-709e-49f6-88a1-423e61f18332"
  - type: depends_on
    id: "5ba580af-0025-496e-b83f-a4008171df71"
---

<!-- [SECTION_START: acceptance] -->

**Dado** que envío "!pedido",
**Cuando** el webhook lee el comando,
**Entonces** responde con el estado de mi última compra.

<!-- [SECTION_END: acceptance] -->

<!-- [SECTION_START: user_story] -->

**Como** Comprador,
**Quiero** consultar estado del pedido,
**Para** saber cómo va mi orden vía bot.

<!-- [SECTION_END: user_story] -->
