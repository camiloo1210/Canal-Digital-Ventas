---
id: bff46379-f217-4000-a583-66c71d519fd3
title: "HU-15: Enviar Notificación Automatizada"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
issue_type: user-story
status: open
labels:
  - ai-generated
relations:
  - type: relates_to
    id: d2918cfa-e65f-46c1-93ba-2c6e4b191ceb
  - type: relates_to
    id: 0815a777-53d4-4426-b843-8b81b666d0af
  - type: relates_to
    id: d6bf2136-7619-472e-abb0-b4b3d6d1aa5f
priority: Should
story_points: "5"
integrity_hash: "sha256:595dca7cbef7ce86464261802cceb8f7658d94331bf3cfdca9fbc677d23cf38e"
---

## Criterios de Aceptación
<!-- [SECTION_START: Criterios de Aceptación] -->
Dado que un pedido cambia a SHIPPED, Cuando salta el trigger, Entonces se despacha un POST a la API de Meta.
<!-- [SECTION_END: Criterios de Aceptación] -->

## User story
<!-- [SECTION_START: User story] -->
Como Sistema, Quiero enviar notificación automatizada, Para avisar cambios de estado.
<!-- [SECTION_END: User story] -->
