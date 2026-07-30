---
id: 85ec2bcf-6220-4ffc-b64e-87346d3346be
title: "MOD-06: Administración del Catálogo y Precios"
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
integrity_hash: "sha256:a52941cc5c8cd41f6a76da0558b8dd7135307eeac91ec0baf994865b6fd3f313"
---

## Descripción del Módulo
<!-- [SECTION_START: Descripción del Módulo] -->
Actúa como el motor operativo y de control central del canal de mayoristas. Concentra sus operaciones en un único actor con privilegios elevados: el Administrador. Él es el encargado exclusivo de estructurar el inventario digital mediante el alta, edición y baja de productos, así como de organizar la jerarquía mediante categorías. Fija estratégicamente los precios al por mayor y controla manualmente la disponibilidad de stock y credenciales de comunicación. Actúa como un escudo automatizado que verifica criptográficamente el permiso ROLES_MANAGE antes de mutar la base de datos maestra.
<!-- [SECTION_END: Descripción del Módulo] -->

## Diagrama (Mermaid)
<!-- [SECTION_START: Diagrama (Mermaid)] -->
```mermaid
flowchart LR
    Admin([Administrador])
    
    CU1((Crear, Editar y Eliminar Productos))
    CU2((Configurar Precios al Por Mayor))
    CU3((Gestionar Categorías y Niveles de Stock))
    CU4((Configurar Canal de WhatsApp - Tokens))
    
    Admin --> CU1
    Admin --> CU2
    Admin --> CU3
    Admin --> CU4
```
<!-- [SECTION_END: Diagrama (Mermaid)] -->
