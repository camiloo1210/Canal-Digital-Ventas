---
id: "4ed22245-f3d2-4130-b0f2-cb814f8a5601"
title: 'EPIC-03: Gestión de Pedidos y Pagos'
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

**Dado** que soy un Comprador Mayorista
**Cuando** finalizo mis selecciones
**Entonces** puedo consolidarlas en un carrito y concretar el pago de manera autónoma.

<!-- [SECTION_END: acceptance] -->

<!-- [SECTION_START: description] -->

Como Comprador Mayorista, Quiero consolidar mis selecciones en un carrito y concretar el pago. Para formalizar mi orden de compra de manera autónoma.

**Módulo 3: Gestión de Pedidos y Pagos**
```mermaid
flowchart LR
    C[Comprador Mayorista] --> A(Agregar Productos al Carrito)
    C --> B(Generar Pedido Comercial)
    C --> P(Pagar Pedido Lemon Squeezy)
    V[Vendedor] --> S(Cambiar Estado del Pedido)
    V --> K(Cancelar Pedido)
    C --> K
```

<!-- [SECTION_END: description] -->
