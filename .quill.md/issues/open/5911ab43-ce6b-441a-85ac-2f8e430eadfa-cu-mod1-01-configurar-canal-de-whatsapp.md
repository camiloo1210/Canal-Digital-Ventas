---
id: 5911ab43-ce6b-441a-85ac-2f8e430eadfa
title: "CU-MOD1-01: Configurar Canal de WhatsApp"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
issue_type: use-case
status: open
labels:
  - ai-generated
relations:
  - type: parent
    id: fa9bc998-0e3e-4ade-a972-073717068208
frecuencia: Muy baja
importancia: Vital
urgencia: Alta
integrity_hash: "sha256:0b316a454201211497ebb4547152b8c655d0fefa9733adbad38e235a8ae796d7"
---

## Actores
<!-- [SECTION_START: Actores] -->
Administrador
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Administrador configura las credenciales (tokens y Phone ID) de la API de WhatsApp Business Cloud. Este proceso utiliza un mecanismo de Upsert (Update or Insert) basado en una clave compuesta para garantizar que no existan configuraciones duplicadas para el negocio.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 El Administrador intenta guardar sin tener el permiso ROLES_MANAGE. -> El sistema intercepta la petición a nivel de Server Action y devuelve un error HTTP 403 Forbidden: "No tiene permisos para realizar esta acción".
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Administrador navega a la sección de Configuración y selecciona "Canal de WhatsApp". -> El sistema despliega el formulario solicitando: Phone Number ID, Access Token y Verify Token.
2 El Administrador ingresa los datos provistos por Meta y presiona "Guardar Configuración". -> El sistema recibe la petición y verifica el permiso ROLES_MANAGE del usuario.
3 -> El sistema ejecuta una operación de Upsert en la base de datos utilizando el identificador del tenant (Papelería Costa Azul).
4 -> El sistema notifica al Administrador: "Configuración guardada exitosamente" y actualiza el estado del canal a Activo.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
Las credenciales quedan almacenadas de forma segura en la tabla marketplace.whatsapp_accounts y el sistema queda habilitado para enviar/recibir mensajes.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El Administrador debe tener una sesión activa y poseer explícitamente el permiso ROLES_MANAGE.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
La operación de validación de permisos y Upsert en la base de datos (PostgreSQL) debe completarse en un máximo de 500 milisegundos.
<!-- [SECTION_END: Rendimiento] -->
