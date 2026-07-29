---
id: "3e3d8c51-eb52-4e21-ba64-9cd7e5fc7391"
title: 'CU-MOD1-01: Configurar Canal de WhatsApp'
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
    id: "28155e2f-4583-41e6-af25-60edac20d85a"
---

<!-- [SECTION_START: description] -->

El Administrador configura las credenciales (tokens y Phone ID) de la API de WhatsApp Business Cloud. Este proceso utiliza un mecanismo de Upsert (Update or Insert) basado en una clave compuesta para garantizar que no existan configuraciones duplicadas para el negocio.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. El Administrador intenta guardar sin tener el permiso ROLES_MANAGE. -> El sistema intercepta la petición a nivel de Server Action y devuelve un error HTTP 403 Forbidden: "No tiene permisos para realizar esta acción".

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

Las credenciales quedan almacenadas de forma segura en la tabla marketplace.whatsapp_accounts y el sistema queda habilitado para enviar/recibir mensajes.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El Administrador debe tener una sesión activa y poseer explícitamente el permiso ROLES_MANAGE.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Administrador navega a la sección de Configuración y selecciona "Canal de WhatsApp". -> El sistema despliega el formulario solicitando: Phone Number ID, Access Token y Verify Token.
2. El Administrador ingresa los datos provistos por Meta y presiona "Guardar Configuración". -> El sistema recibe la petición y verifica el permiso ROLES_MANAGE del usuario.
3. El sistema ejecuta una operación de Upsert en la base de datos utilizando el identificador del tenant.
4. El sistema notifica al Administrador: "Configuración guardada exitosamente" y actualiza el estado del canal a Activo.

<!-- [SECTION_END: sequence] -->
