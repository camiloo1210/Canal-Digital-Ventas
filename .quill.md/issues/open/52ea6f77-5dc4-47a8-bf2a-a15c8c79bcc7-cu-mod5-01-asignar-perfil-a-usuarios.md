---
id: 52ea6f77-5dc4-47a8-bf2a-a15c8c79bcc7
title: "CU-MOD5-01: Asignar Perfil a Usuarios"
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
integrity_hash: "sha256:16af6299a93e1e5bdd760e933fd2d81c7a1209b29f81569c80ef8d4b3ad5f6b1"
---

## Actores
<!-- [SECTION_START: Actores] -->
Administrador.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Administrador gestiona el rol macro (Perfil) de los usuarios registrados en el sistema, definiendo si actuarán como Compradores Mayoristas, Vendedores (operativos) o Administradores (superusuarios).
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 El Administrador intenta removerse a sí mismo el perfil de Administrador. -> El sistema bloquea la acción para evitar que la plataforma se quede sin superusuarios: "No puedes degradar tu propio perfil administrador."
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Administrador navega a la sección de "Gestión de Usuarios". -> El sistema despliega el listado de usuarios registrados en la plataforma.
2 El Administrador selecciona un usuario y modifica su perfil desde un menú desplegable (ej. cambia de "Comprador" a "Vendedor"). -> El sistema recibe la petición y ejecuta una validación de autorización estricta verificando que el solicitante tenga el permiso ROLES_MANAGE.
3 -> El sistema actualiza el registro del rol asociado al ID del usuario en la base de datos.
4 -> El sistema retorna un mensaje de éxito: "Perfil actualizado correctamente."
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
El rol macro del usuario se actualiza en la base de datos, alterando su acceso a los módulos correspondientes en su próximo inicio de sesión.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El Administrador debe tener sesión activa y poseer el permiso ROLES_MANAGE. El usuario destino debe estar previamente registrado en la base de datos (Supabase Auth).
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
Operación crítica que debe completarse en < 500ms.
<!-- [SECTION_END: Rendimiento] -->
