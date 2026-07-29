---
id: "761d9a59-adcc-4503-b115-c8b4f414a195"
title: 'CU-MOD2-02: Ver Disponibilidad de Stock'
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
    id: "0c36e894-86cd-4ffe-a558-6c9f892f3a95"
---

<!-- [SECTION_START: description] -->

El usuario consulta el inventario físico disponible de un producto de manera visual. El sistema procesa la cantidad numérica exacta y la traduce a etiquetas de negocio para facilitar la lectura y toma de decisiones.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. El sistema detecta una inconsistencia en la base de datos (stock negativo o nulo). -> El sistema oculta el botón de compra y muestra una etiqueta gris: "Consultar disponibilidad."

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El estado de inventario se muestra claramente en cada tarjeta de producto.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El catálogo de productos debe estar cargado en pantalla.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Actor visualiza la tarjeta de un producto específico en la grilla. -> El sistema lee el valor numérico del stock actual en la base de datos para ese SKU.
2. El sistema aplica la lógica de negocio: Si el stock es mayor a 20, asigna el estado "Disponible".
3. Si el stock está entre 1 y 20, asigna el estado "Pocas unidades".
4. Si el stock es 0, asigna el estado "Agotado".
5. El sistema renderiza el badge de color correspondiente (ej. verde, amarillo o rojo) sobre la imagen del producto.

<!-- [SECTION_END: sequence] -->
