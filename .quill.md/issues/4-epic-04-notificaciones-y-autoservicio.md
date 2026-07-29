---
id: "a2f1393c-709e-49f6-88a1-423e61f18332"
title: 'EPIC-04: Notificaciones y Autoservicio'
author: AI Agent (MCP)
creation_date: '2026-07-03'
updated_date: '2026-07-03'
issue_type: epic
status: in_progress
assignee: pm-1
labels: []
relations: []
---

<!-- [SECTION_START: acceptance] -->

**Dado** que soy el Administrador
**Cuando** un pedido cambia de estado
**Entonces** el sistema comunica automáticamente el estado a través del canal de autoservicio.

<!-- [SECTION_END: acceptance] -->

<!-- [SECTION_START: description] -->

Como Administrador, Quiero que el sistema comunique automáticamente los estados de las órdenes. Para reducir la carga operativa de atención al cliente.

**Módulo 1: Notificaciones (WhatsApp)**
```mermaid
flowchart LR
    A[Administrador] --> B(Configurar Canal de WhatsApp)
    S[Módulo de Pedidos] --> C(Enviar Notificación Automatizada)
    C --> U[Comprador Mayorista]
    U --> D(Consultar Estado del Pedido)
    U --> E(Solicitar Factura o Ayuda)
```

<!-- [SECTION_END: description] -->
