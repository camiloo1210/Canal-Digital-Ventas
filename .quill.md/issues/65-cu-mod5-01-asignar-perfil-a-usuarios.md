---
id: "f367e553-17a5-4b08-bf66-2ba2144b275f"
title: 'CU-MOD5-01: Asignar Perfil a Usuarios'
author: AI Agent (MCP)
creation_date: '2026-07-03'
updated_date: '2026-07-03'
issue_type: use-case
status: ready
assignee: dev-2
labels:
  - backend
relations:
  - type: relates_to
    id: "69e0cf65-dc77-452f-8b2b-f198e6a0edad"
---

<!-- [SECTION_START: description] -->

El Administrador gestiona el rol macro (Perfil) de los usuarios registrados en el sistema, definiendo si actuarán como Compradores Mayoristas, Vendedores (operativos) o Administradores (superusuarios).

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. El Administrador intenta removerse a sí mismo el perfil de Administrador. -> El sistema bloquea la acción para evitar que la plataforma se quede sin superusuarios: "No puedes degradar tu propio perfil administrador."

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El rol macro del usuario se actualiza en la base de datos, alterando su acceso a los módulos correspondientes en su próximo inicio de sesión.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El Administrador debe tener sesión activa y poseer el permiso ROLES_MANAGE. El usuario destino debe estar previamente registrado en la base de datos (Supabase Auth).

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Administrador navega a la sección de "Gestión de Usuarios". -> El sistema despliega el listado de usuarios registrados en la plataforma.
2. El Administrador selecciona un usuario y modifica su perfil desde un menú desplegable (ej. cambia de "Comprador" a "Vendedor"). -> El sistema recibe la petición y ejecuta una validación de autorización estricta verificando que el solicitante tenga el permiso ROLES_MANAGE.
3. El sistema actualiza el registro del rol asociado al ID del usuario en la base de datos.
4. El sistema retorna un mensaje de éxito: "Perfil actualizado correctamente."

<!-- [SECTION_END: sequence] -->
