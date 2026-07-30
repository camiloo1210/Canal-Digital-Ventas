---
id: a80dfdb8-a769-4a1a-8f93-ba7c29cd16a6
title: "MOD-03: Módulo de Gestión de Pedidos y Pagos"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-30"
issue_type: module
status: open
labels:
  - ai-generated
relations:
  - type: parent
    id: e651f3ed-4102-4e1b-9a94-9f5a179dd2b1
integrity_hash: "sha256:1cfbddd7e43a84bca88f60236314a81b6c243a843584e3f5c8ceb36dbd248f3e"
---

## Descripción del Módulo
<!-- [SECTION_START: Descripción del Módulo] -->
Actúa como el motor transaccional del sistema, materializando la intención de compra del cliente en órdenes comerciales estructuradas. Separa claramente la experiencia de compra de la gestión operativa: mientras el Comprador Mayorista se encarga de la consolidación de su carrito, validación de totales y pago en línea, el Vendedor interviene en la etapa posterior para gestionar manualmente el avance físico logístico. Esto incluye un flujo seguro de validación continua (stock y auth) antes de la generación del pedido, y la orquestación automatizada del pago mediante webhooks verificados criptográficamente (Lemon Squeezy) con reglas de idempotencia.
<!-- [SECTION_END: Descripción del Módulo] -->

## Diagrama (Mermaid)
<!-- [SECTION_START: Diagrama (Mermaid)] -->
```mermaid
flowchart LR
    Comprador([Comprador Mayorista])
    Vendedor([Vendedor / Dependiente])
    
    CU1((Agregar Productos al Carrito))
    CU2((Generar Pedido Comercial))
    CU3((Pagar Pedido - Lemon Squeezy))
    CU4((Cambiar Estado del Pedido))
    CU5((Cancelar Pedido))
    
    Comprador --> CU1
    Comprador --> CU2
    Comprador --> CU3
    Comprador --> CU5
    
    Vendedor --> CU4
    Vendedor --> CU5
```
<!-- [SECTION_END: Diagrama (Mermaid)] -->
