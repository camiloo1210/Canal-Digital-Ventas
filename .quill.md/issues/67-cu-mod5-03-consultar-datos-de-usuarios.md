---
id: "3b4782c8-1f24-434e-ba42-df79c48ab143"
title: 'CU-MOD5-03: Consultar Datos de Usuarios'
author: AI Agent (MCP)
creation_date: '2026-07-03'
updated_date: '2026-07-03'
issue_type: use-case
status: ready
assignee: dev-1
labels:
  - frontend
relations:
  - type: relates_to
    id: "b6bc3ddd-0926-49d0-9f50-c7513cffbef5"
---

<!-- [SECTION_START: description] -->

El Administrador visualiza el directorio de usuarios registrados en el sistema, lo cual le permite auditar quién tiene acceso a la plataforma, revisar los datos demográficos de sus compradores mayoristas y localizar cuentas para soporte.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. El sistema no encuentra usuarios. -> El sistema muestra la tabla vacía.

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El sistema muestra una tabla de datos paginada con la información de los usuarios.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El Administrador debe poseer el permiso ROLES_MANAGE.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Administrador accede a la sección de "Gestión de Usuarios". -> El sistema verifica los permisos.
2. El sistema consulta a la base de datos recuperando la información pública de los perfiles (ID, Nombre, Rol, Fecha de Registro).
3. El sistema renderiza la tabla, permitiendo al Administrador ordenar o buscar usuarios específicos.

<!-- [SECTION_END: sequence] -->
