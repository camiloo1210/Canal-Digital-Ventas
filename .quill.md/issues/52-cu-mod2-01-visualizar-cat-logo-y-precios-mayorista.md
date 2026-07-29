---
id: "bf7ea305-df3a-49d3-90bc-82bc87837783"
title: 'CU-MOD2-01: Visualizar Catálogo y Precios Mayoristas'
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
    id: "ecc57b96-147f-4b34-b06f-cf90d6a8a3e3"
---

<!-- [SECTION_START: description] -->

El usuario accede al canal web para explorar el inventario de la Papelería Costa Azul. El sistema despliega la grilla de productos solicitando las imágenes de forma segura y calculando la visualización del precio Mayorista.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. No hay productos activos registrados en el sistema. -> El sistema muestra una alerta visual: "Actualmente no hay productos disponibles en el catálogo."

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

La interfaz renderiza la grilla de productos de forma responsiva (1 a 4 columnas) con la información comercial actualizada.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El usuario debe tener conexión a internet. Los productos deben estar registrados en estado activo en la base de datos (Supabase).

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Actor ingresa a la URL principal del canal de ventas digital. -> El sistema (mediante Server Components) consulta la base de datos eludiendo la caché para asegurar datos en tiempo real.
2. El sistema solicita a la API de Storage la generación de URLs firmadas con caducidad de 1 hora para las imágenes de los productos.
3. El sistema evalúa el campo wholesale_price. Si es mayor a cero, activa el renderizado de la etiqueta "Mayorista" junto al precio.
4. El sistema despliega la información estructurada (nombre, descripción, imagen y precio) en el dispositivo del actor.

<!-- [SECTION_END: sequence] -->
