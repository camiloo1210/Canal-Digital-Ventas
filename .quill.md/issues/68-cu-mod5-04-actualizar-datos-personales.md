---
id: "c2716843-886e-48a9-ad2f-b9383d48aa4f"
title: 'CU-MOD5-04: Actualizar Datos Personales'
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
    id: "486f4cac-3082-4d37-88f6-4fa570eacc36"
---

<!-- [SECTION_START: description] -->

Cualquier usuario autenticado (Comprador, Vendedor o Administrador) accede a su área personal para modificar su información demográfica básica. El sistema aplica reglas estrictas de validación, garantizando la inmutabilidad del correo electrónico y la calidad de los textos.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. Un usuario avanzado intenta modificar su correo electrónico inyectando datos en la petición de red (API). -> El backend ignora cualquier parámetro relacionado con el email en el payload, protegiendo la regla de inmutabilidad establecida.

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El perfil del usuario se actualiza en la base de datos (PostgreSQL).

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El usuario debe estar autenticado en su cuenta.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Actor navega a "Mi Perfil" y modifica los campos de Nombre, Apellido, Género o Fecha de Nacimiento. -> El sistema muestra el campo de "Correo Electrónico" bloqueado.
2. El Actor presiona "Guardar Cambios". -> El sistema captura la petición y ejecuta la validación de esquema (Zod): verifica que el Nombre y Apellido tengan un mínimo de 2 caracteres.
3. Si la validación es correcta, el sistema actualiza el registro en la base de datos.

<!-- [SECTION_END: sequence] -->
