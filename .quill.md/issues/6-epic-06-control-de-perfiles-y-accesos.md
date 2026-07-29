---
id: "65e85cd3-d837-495e-9917-c7f5c7924ea0"
title: 'EPIC-06: Control de Perfiles y Accesos'
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
**Cuando** accedo a la gestión de usuarios
**Entonces** puedo configurar los roles y permisos para asegurar el acceso correcto a la información.

<!-- [SECTION_END: acceptance] -->

<!-- [SECTION_START: description] -->

Como Administrador, Quiero gestionar los roles y privilegios de los usuarios. Para asegurar que cada persona acceda únicamente a la información que le corresponde.

**Módulo 5: Control de Perfiles y Accesos**
```mermaid
flowchart LR
    A[Administrador] --> B(Asignar Perfil a Usuarios)
    A --> C(Otorgar Permisos Discretos)
    A --> D(Consultar Datos de Usuarios)
    E(Actualizar Datos Personales) <--> F[Vendedor / Dependiente]
    E <--> G[Comprador Mayorista]
```

<!-- [SECTION_END: description] -->
