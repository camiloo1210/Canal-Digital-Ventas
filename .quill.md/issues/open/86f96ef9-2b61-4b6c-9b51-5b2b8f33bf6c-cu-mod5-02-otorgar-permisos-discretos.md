---
id: 86f96ef9-2b61-4b6c-9b51-5b2b8f33bf6c
title: "CU-MOD5-02: Otorgar Permisos Discretos"
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
integrity_hash: "sha256:a4052114ea98a550b40028a4630ab772979a0c7da1b67bc25fec20ccc28f6664"
---

## Actores
<!-- [SECTION_START: Actores] -->
Administrador.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Administrador gestiona de forma granular (micro) los permisos específicos asignados a un usuario, basándose en la arquitectura de 14 permisos definidos en el sistema. Esto permite crear perfiles híbridos o limitar acciones específicas (ej. un vendedor que puede ver pedidos pero no cancelarlos).
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 Error de conexión con la base de datos al guardar los permisos. -> El sistema revierte visualmente los checkboxes al estado anterior y notifica: "Error al actualizar los permisos. Intente nuevamente."
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 En el detalle de un usuario, el Administrador accede a la pestaña de "Permisos Avanzados". -> El sistema despliega una matriz o lista de checkboxes con los 14 permisos del sistema.
2 El Administrador activa o desactiva permisos específicos y presiona "Guardar Permisos". -> El sistema valida la sesión y el privilegio del Administrador.
3 -> El sistema actualiza el vector de permisos asociados al usuario en la base de datos.
4 -> El sistema fuerza la actualización del token de sesión del usuario afectado para que los cambios tengan efecto inmediato (o en la siguiente recarga).
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
La matriz de permisos del usuario se actualiza, habilitando o bloqueando funcionalidades en la interfaz de usuario.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El Administrador debe poseer el permiso ROLES_MANAGE.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
Operación debe completarse en < 500ms.
<!-- [SECTION_END: Rendimiento] -->
