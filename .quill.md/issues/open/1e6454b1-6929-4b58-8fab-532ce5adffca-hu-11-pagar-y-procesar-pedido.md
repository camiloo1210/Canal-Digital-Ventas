---
id: 1e6454b1-6929-4b58-8fab-532ce5adffca
title: "HU-11: Pagar y Procesar Pedido"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
issue_type: user-story
status: open
labels:
  - ai-generated
relations:
  - type: relates_to
    id: ffba52b9-fb70-4c04-b274-a0f34f41361f
  - type: relates_to
    id: a80dfdb8-a769-4a1a-8f93-ba7c29cd16a6
  - type: relates_to
    id: cffa6a0e-d424-42b7-9439-26b9f2c17cc4
priority: Must
story_points: "8"
integrity_hash: "sha256:7dd350c043cdd1958852a789cf87243b3862381689f1a467ca568537284cee01"
---

## Criterios de Aceptación
<!-- [SECTION_START: Criterios de Aceptación] -->
Dado que se paga la orden, Cuando el Webhook valida la firma HMAC, Entonces el estado cambia a CONFIRMED.
<!-- [SECTION_END: Criterios de Aceptación] -->

## User story
<!-- [SECTION_START: User story] -->
Como Sistema, Quiero pagar y procesar el pedido, Para registrar pagos vía Lemon Squeezy.
<!-- [SECTION_END: User story] -->
