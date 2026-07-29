---
id: "dbc74baa-79cf-4077-b634-fdb389d9f446"
title: 'CU-MOD3-01: Agregar Productos al Carrito'
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
    id: "970b26d7-d852-4fca-afda-5ba00313030b"
---

<!-- [SECTION_START: description] -->

El Comprador Mayorista selecciona productos del catálogo y los añade a su carrito de compras. El sistema valida en tiempo real la disponibilidad de inventario y guarda la información temporalmente utilizando persistencia local.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. El comprador intenta agregar una cantidad superior al stock físico disponible. -> El sistema bloquea la acción y muestra una alerta: "No puedes agregar más unidades de las disponibles en inventario."

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El producto se añade al estado del carrito y el contador de la interfaz de usuario se actualiza.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El catálogo de productos debe estar visible y el producto seleccionado debe tener stock mayor a cero.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Comprador Mayorista hace clic en el botón "Agregar" sobre un producto. -> El sistema intercepta la acción y verifica la cantidad de stock disponible en la base de datos para ese SKU.
2. Al confirmar disponibilidad, el sistema añade el producto y la cantidad seleccionada a la persistencia local (estado del carrito).
3. El sistema recalcula subtotal y actualiza dinámicamente el ícono del carrito en la barra de navegación.

<!-- [SECTION_END: sequence] -->
