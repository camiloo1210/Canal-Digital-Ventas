---
id: "419985b7-95ab-4e56-832b-50648759b023"
title: 'CU-MOD6-04: Configurar Canal de WhatsApp (Tokens)'
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
    id: "36652b21-0ba4-4ca0-86ea-b87e68b4bfee"
---

<!-- [SECTION_START: description] -->

El Administrador configura los parámetros de integración (Phone Number ID, Access Token) necesarios para que la plataforma se comunique con Meta (WhatsApp Business Cloud API). El sistema utiliza una lógica de Upsert seguro.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. Un Administrador intenta guardar tokens malformados (ej. caracteres insuficientes). -> La validación preventiva del lado del cliente (Zod) rechaza el guardado y marca los campos en rojo.

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El sistema queda autorizado y habilitado para enviar notificaciones asíncronas y responder comandos de los compradores.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El Administrador debe tener sesión activa, permiso ROLES_MANAGE y disponer de los tokens provistos por Meta for Developers.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Administrador navega a "Configuración de Integraciones" y pega los tokens de WhatsApp. -> El sistema valida que los campos no estén vacíos y verifica el permiso de superusuario.
2. El Administrador presiona "Guardar Credenciales". -> El sistema ejecuta una operación de Upsert (Update or Insert) utilizando una clave compuesta que identifica a la Papelería Costa Azul.
3. Si el negocio no tenía configuración, el sistema la inserta. Si ya tenía (ej. renovación de token vencido), el sistema actualiza el registro existente en lugar de duplicarlo.

<!-- [SECTION_END: sequence] -->
