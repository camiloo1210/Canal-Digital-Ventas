---
id: "36d81ce4-7d13-4dca-a11f-dcf9fa6d764d"
title: 'Módulo Principal: Canal de Ventas Mayorista B2B'
author: AI Agent (MCP)
creation_date: '2026-07-03'
updated_date: '2026-07-03'
issue_type: module
status: in_progress
assignee: pm-1
labels: []
relations:
  - type: child
    id: "4aea97bd-f4ac-48f5-97e8-ca2fec0fa50b"
  - type: child
    id: "816b151d-3d0f-41c8-8909-38ba40068342"
  - type: child
    id: "f703d9bf-3416-4582-a1a4-e283e8f9707c"
  - type: child
    id: "164e3b8c-5e98-4a4f-88c6-0a890886c29f"
  - type: child
    id: "92a59cc4-8688-4e83-a9d8-96e37dde1445"
  - type: child
    id: "dac0c88d-02bf-4d59-b571-10c0097dd7ef"
---

<!-- [SECTION_START: description] -->

Módulo de Alto Nivel que engloba toda la arquitectura del Canal de Ventas Mayorista B2B.

```mermaid
flowchart TD
    %% Nodo Principal
    P[Módulo Principal: Sistema de Gestión B2B]

    %% Módulos Secundarios
    M1(Módulo 1: Canal de WhatsApp)
    M2(Módulo 2: Catálogo y Visualización)
    M3(Módulo 3: Pedidos y Transacciones)
    M4(Módulo 4: Dashboard y Métricas)
    M5(Módulo 5: Usuarios y Seguridad)
    M6(Módulo 6: Gestión de Catálogo y Configuración)
    
    %% Relaciones
    P --> M1
    P --> M2
    P --> M3
    P --> M4
    P --> M5
    P --> M6

    %% Actores
    A([Administrador])
    C([Comprador Mayorista])
    V([Vendedor])

    A --> P
    C --> P
    V --> P
```

<!-- [SECTION_END: description] -->
