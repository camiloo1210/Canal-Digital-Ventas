---
id: "596c9c59-1a2c-4fed-9acf-ecd63f99ca97"
title: 'CU-MOD4-02: Consultar Métricas de Ventas'
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
    id: "85c97f95-b42e-42a2-b864-0c4e5e8fb27f"
---

<!-- [SECTION_START: description] -->

El Administrador analiza gráficamente el comportamiento de los ingresos del canal digital a lo largo del tiempo, permitiéndole comparar el volumen de ventas en meses normales vs. la temporada escolar.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. No existen ventas registradas en el rango de fechas seleccionado. -> El sistema renderiza un gráfico vacío (Empty State) con la leyenda: "No hay datos de ventas para este período."

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El sistema renderiza gráficos de series de tiempo representando el flujo de ingresos.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El Administrador debe estar dentro del Dashboard.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Administrador selecciona un rango de fechas en el filtro de la sección de Ventas. -> El sistema captura los parámetros de fecha de inicio y fin.
2. El sistema ejecuta una consulta en la tabla de pedidos, filtrando únicamente aquellos con estado CONFIRMED, SHIPPED o DELIVERED, y agrupándolos por fecha (día/mes).
3. El sistema retorna el conjunto de datos estructurado y actualiza el gráfico en pantalla.

<!-- [SECTION_END: sequence] -->
