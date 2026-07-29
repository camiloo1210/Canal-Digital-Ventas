---
id: 583bd319-d3a7-4d69-a5d2-402460d03f27
title: "CU-MOD5-04: Actualizar Datos Personales"
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
integrity_hash: "sha256:5f319a0398cc2bf008d2196c6bc5e4e715a167274dc02f5d5fda2306c24cae4d"
---

## Actores
<!-- [SECTION_START: Actores] -->
Administrador,Vendedor,Comprador Mayorista.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
Cualquier usuario autenticado (Comprador, Vendedor o Administrador) accede a su área personal para modificar su información demográfica básica. El sistema aplica reglas estrictas de validación, garantizando la inmutabilidad del correo electrónico y la calidad de los textos.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 Un usuario avanzado intenta modificar su correo electrónico inyectando datos en la petición de red (API). -> El backend ignora cualquier parámetro relacionado con el email en el payload, protegiendo la regla de inmutabilidad establecida.
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Actor navega a "Mi Perfil" y modifica los campos de Nombre, Apellido, Género o Fecha de Nacimiento. -> El sistema muestra el campo de "Correo Electrónico" bloqueado
2 El Actor presiona "Guardar Cambios". -> El sistema captura la petición y ejecuta la validación de esquema (Zod): verifica que el Nombre y Apellido tengan un mínimo de 2 caracteres.
3 -> Si la validación es correcta, el sistema actualiza el registro en la base de datos.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
El perfil del usuario se actualiza en la base de datos (PostgreSQL).
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El usuario debe estar autenticado en su cuenta.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
Las validaciones del lado del cliente/servidor (Zod) deben ser instantáneas (< 50ms).
<!-- [SECTION_END: Rendimiento] -->
