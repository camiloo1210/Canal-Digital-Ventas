---
id: "f7ca4260-85b4-4076-8468-fdb4695fd688"
title: 'CU-MOD5-02: Otorgar Permisos Discretos'
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
    id: "79c06874-d2a8-44f0-bbeb-6e1c7989c5fc"
---

<!-- [SECTION_START: description] -->

El Administrador gestiona de forma granular (micro) los permisos específicos asignados a un usuario, basándose en la arquitectura de 14 permisos definidos en el sistema. Esto permite crear perfiles híbridos o limitar acciones específicas (ej. un vendedor que puede ver pedidos pero no cancelarlos).

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. Error de conexión con la base de datos al guardar los permisos. -> El sistema revierte visualmente los checkboxes al estado anterior y notifica: "Error al actualizar los permisos. Intente nuevamente."

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

La matriz de permisos del usuario se actualiza, habilitando o bloqueando funcionalidades en la interfaz de usuario.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El Administrador debe poseer el permiso ROLES_MANAGE.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. En el detalle de un usuario, el Administrador accede a la pestaña de "Permisos Avanzados". -> El sistema despliega una matriz o lista de checkboxes con los 14 permisos del sistema.
2. El Administrador activa o desactiva permisos específicos y presiona "Guardar Permisos". -> El sistema valida la sesión y el privilegio del Administrador.
3. El sistema actualiza el vector de permisos asociados al usuario en la base de datos.
4. El sistema fuerza la actualización del token de sesión del usuario afectado para que los cambios tengan efecto inmediato (o en la siguiente recarga).

<!-- [SECTION_END: sequence] -->
