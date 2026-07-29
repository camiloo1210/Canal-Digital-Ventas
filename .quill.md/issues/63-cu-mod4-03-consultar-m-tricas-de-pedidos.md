---
id: "6642e8c9-fa9f-4df4-989c-1fd25dcd89da"
title: 'CU-MOD4-03: Consultar Métricas de Pedidos'
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
    id: "47029f46-a11f-4e1b-8ca0-13db0df95d90"
---

<!-- [SECTION_START: description] -->

El Administrador audita la eficiencia operativa del canal revisando el volumen de pedidos agrupados por su estado actual (Pendientes, Confirmados, Cancelados), lo que permite identificar cuellos de botella en el despacho.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. El sistema experimenta un error de conexión con la base de datos de Supabase. -> El componente muestra un mensaje de error encapsulado ("Error al cargar las métricas operativas") sin hacer colapsar el resto del Dashboard.

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El sistema muestra un desglose visual de los estados de los pedidos.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El Administrador debe estar dentro del Dashboard.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Administrador navega a la sección de Métricas Operativas. -> El sistema consulta el total de pedidos históricos en la base de datos.
2. El sistema agrupa los registros por la columna status y calcula los porcentajes correspondientes de cada fase.
3. El sistema renderiza el componente visual segmentando los pedidos cancelados vs. los completados.

<!-- [SECTION_END: sequence] -->
