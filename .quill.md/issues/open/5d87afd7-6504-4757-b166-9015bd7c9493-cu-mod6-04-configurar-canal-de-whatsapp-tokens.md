---
id: 5d87afd7-6504-4757-b166-9015bd7c9493
title: "CU-MOD6-04: Configurar Canal de WhatsApp (Tokens)"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
issue_type: use-case
status: open
labels:
  - ai-generated
relations:
  - type: parent
    id: 85ec2bcf-6220-4ffc-b64e-87346d3346be
frecuencia: Muy Baja
importancia: Alta
urgencia: Alta
integrity_hash: "sha256:5eed9ef1d4275f174ca08f16dc91aecb969f6115bca9db167e58520e274ee68f"
---

## Actores
<!-- [SECTION_START: Actores] -->
Administrador.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Administrador configura los parámetros de integración (Phone Number ID, Access Token) necesarios para que la plataforma se comunique con Meta (WhatsApp Business Cloud API). El sistema utiliza una lógica de Upsert seguro.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 Un Administrador intenta guardar tokens malformados (ej. caracteres insuficientes). -> La validación preventiva del lado del cliente (Zod) rechaza el guardado y marca los campos en rojo.
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Administrador navega a "Configuración de Integraciones" y pega los tokens de WhatsApp. -> El sistema valida que los campos no estén vacíos y verifica el permiso de superusuario.
2 El Administrador presiona "Guardar Credenciales". -> El sistema ejecuta una operación de Upsert (Update or Insert) utilizando una clave compuesta que identifica a la Papelería Costa Azul.
3 -> Si el negocio no tenía configuración, el sistema la inserta. Si ya tenía (ej. renovación de token vencido), el sistema actualiza el registro existente en lugar de duplicarlo.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
El sistema queda autorizado y habilitado para enviar notificaciones asíncronas y responder comandos de los compradores.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El Administrador debe tener sesión activa, permiso ROLES_MANAGE y disponer de los tokens provistos por Meta for Developers.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
Operación de base de datos < 300ms.
<!-- [SECTION_END: Rendimiento] -->
