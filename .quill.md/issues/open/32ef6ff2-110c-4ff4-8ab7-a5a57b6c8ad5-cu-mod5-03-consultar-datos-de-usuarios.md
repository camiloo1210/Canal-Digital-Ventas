---
id: 32ef6ff2-110c-4ff4-8ab7-a5a57b6c8ad5
title: "CU-MOD5-03: Consultar Datos de Usuarios"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
issue_type: use-case
status: open
labels:
  - ai-generated
relations:
  - type: parent
    id: 008c7c85-2835-4265-b266-065495eaf5e7
integrity_hash: "sha256:e85818028b3f2102f38f7da3e01fb4a97e9f101e1294768d82a1fa3452f76d2d"
---

## Actores
<!-- [SECTION_START: Actores] -->
Administrador.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Administrador visualiza el directorio de usuarios registrados en el sistema, lo cual le permite auditar quién tiene acceso a la plataforma, revisar los datos demográficos de sus compradores mayoristas y localizar cuentas para soporte.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 El sistema no encuentra usuarios . -> El sistema muestra la tabla vacía.
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Administrador accede a la sección de "Gestión de Usuarios". -> El sistema verifica los permisos.
2 -> El sistema consulta a la base de datos recuperando la información pública de los perfiles (ID, Nombre, Rol, Fecha de Registro).
3 -> El sistema renderiza la tabla, permitiendo al Administrador ordenar o buscar usuarios específicos.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
El sistema muestra una tabla de datos paginada con la información de los usuarios.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El Administrador debe poseer el permiso ROLES_MANAGE.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
Paginación rápida, < 800ms por página.
<!-- [SECTION_END: Rendimiento] -->
