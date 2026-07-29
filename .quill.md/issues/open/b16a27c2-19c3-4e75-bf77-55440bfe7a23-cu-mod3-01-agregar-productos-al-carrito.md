---
id: b16a27c2-19c3-4e75-bf77-55440bfe7a23
title: "CU-MOD3-01: Agregar Productos al Carrito"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
issue_type: use-case
status: open
labels:
  - ai-generated
relations:
  - type: parent
    id: a80dfdb8-a769-4a1a-8f93-ba7c29cd16a6
frecuencia: Alta
importancia: Alta
urgencia: Inmediata
integrity_hash: "sha256:bf90afddec79f6e68111e850411b83a59f00732bc045e4525fa7dbc065d4361e"
---

## Actores
<!-- [SECTION_START: Actores] -->
Comprador Mayorista.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Comprador Mayorista selecciona productos del catálogo y los añade a su carrito de compras. El sistema valida en tiempo real la disponibilidad de inventario y guarda la información temporalmente utilizando persistencia local.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 El comprador intenta agregar una cantidad superior al stock físico disponible. -> El sistema bloquea la acción y muestra una alerta: "No puedes agregar más unidades de las disponibles en inventario."
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Comprador Mayorista hace clic en el botón "Agregar" sobre un producto. -> El sistema intercepta la acción y verifica la cantidad de stock disponible en la base de datos para ese SKU.
2 -> Al confirmar disponibilidad, el sistema añade el producto y la cantidad seleccionada a la persistencia local (estado del carrito).
3 -> El sistema recalcula subtotal y actualiza dinámicamente el ícono del carrito en la barra de navegación.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
El producto se añade al estado del carrito y el contador de la interfaz de usuario se actualiza.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El catálogo de productos debe estar visible y el producto seleccionado debe tener stock mayor a cero.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
La actualización de la interfaz gráfica y la persistencia en el navegador cliente debe ocurrir en menos de 50 milisegundos (optimistic UI update).
<!-- [SECTION_END: Rendimiento] -->
