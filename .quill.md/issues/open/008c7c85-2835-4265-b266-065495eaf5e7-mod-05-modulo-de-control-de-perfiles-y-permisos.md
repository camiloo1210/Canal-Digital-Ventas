---
id: 008c7c85-2835-4265-b266-065495eaf5e7
title: "MOD-05: Módulo de Control de Perfiles y Permisos"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-08-02"
issue_type: module
status: open
labels:
  - ai-generated
relations:
  - type: parent
    id: e651f3ed-4102-4e1b-9a94-9f5a179dd2b1
integrity_hash: "sha256:4f8293ca00dac098e7cdec625bd107851a9f99ffe2cd3696385f3ff8719ba95e"
---

## Descripción del Módulo
<!-- [SECTION_START: Descripción del Módulo] -->
Actúa como el cimiento de seguridad e identidad de la plataforma, garantizando que cada actor interactúe únicamente con las funcionalidades que le corresponden. Separa la autogestión de la administración centralizada: los Vendedores y Compradores Mayoristas mantienen actualizada su información personal (nombres, género, fecha de nacimiento), mientras el Administrador ejerce el control total sobre la gobernanza de la plataforma (asigna perfiles y 14 permisos discretos). Incluye aplicación automatizada de reglas de integridad de datos y validación estricta de roles.
<!-- [SECTION_END: Descripción del Módulo] -->

## Diagrama (Mermaid)
<!-- [SECTION_START: Diagrama (Mermaid)] -->
```mermaid
flowchart LR
    Admin([Administrador])
    Vendedor([Vendedor / Dependiente])
    Comprador([Comprador Mayorista])
    
    CU1((Asignar Perfil a Usuarios))
    CU2((Otorgar Permisos Discretos))
    CU3((Consultar Datos de Usuarios))
    CU4((Actualizar Datos Personales))
    
    Admin --> CU1
    Admin --> CU2
    Admin --> CU3
    Admin --> CU4
    
    Vendedor --> CU4
    Comprador --> CU4
```
<!-- [SECTION_END: Diagrama (Mermaid)] -->
