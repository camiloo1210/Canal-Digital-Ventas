---
id: "5ba580af-0025-496e-b83f-a4008171df71"
title: 'HU-15: Enviar notificación automatizada'
author: AI Agent (MCP)
creation_date: '2026-07-03'
updated_date: '2026-07-03'
issue_type: user-story
status: ready
assignee: dev-1
labels:
  - frontend
story_points: '5'
relations:
  - type: parent
    id: "a2f1393c-709e-49f6-88a1-423e61f18332"
  - type: depends_on
    id: "28155e2f-4583-41e6-af25-60edac20d85a"
---

<!-- [SECTION_START: acceptance] -->

**Dado** que un pedido cambia a SHIPPED,
**Cuando** salta el trigger,
**Entonces** se despacha un POST a la API de Meta.

<!-- [SECTION_END: acceptance] -->

<!-- [SECTION_START: user_story] -->

**Como** Sistema,
**Quiero** enviar notificación automatizada,
**Para** avisar cambios de estado.

<!-- [SECTION_END: user_story] -->
