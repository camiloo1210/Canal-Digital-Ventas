---
id: 7578823e-3d83-4583-9d92-f1746f3b08db
title: "CU-MOD2-02: Ver Disponibilidad de Stock"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
issue_type: use-case
status: open
labels:
  - ai-generated
relations:
  - type: parent
    id: b8072b66-d3b9-401c-85fa-622de372ea1c
frecuencia: Muy alta
importancia: Alta
urgencia: Alta
integrity_hash: "sha256:0444dafa147362e019063bf66c7f5156288debca80b029c691134763092fb0ff"
---

## Actores
<!-- [SECTION_START: Actores] -->
Comprador Mayorista,Vendedor
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El usuario consulta el inventario físico disponible de un producto de manera visual. El sistema procesa la cantidad numérica exacta y la traduce a etiquetas de negocio para facilitar la lectura y toma de decisiones.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 El sistema detecta una inconsistencia en la base de datos (stock negativo o nulo). -> El sistema oculta el botón de compra y muestra una etiqueta gris: "Consultar disponibilidad."
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Actor visualiza la tarjeta de un producto específico en la grilla. -> El sistema lee el valor numérico del stock actual en la base de datos para ese SKU.
2 -> El sistema aplica la lógica de negocio: Si el stock es mayor a 20, asigna el estado "Disponible".
3 -> Si el stock está entre 1 y 20, asigna el estado "Pocas unidades".
4 -> Si el stock es 0, asigna el estado "Agotado".
5 -> El sistema renderiza el badge de color correspondiente (ej. verde, amarillo o rojo) sobre la imagen del producto.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
El estado de inventario se muestra claramente en cada tarjeta de producto.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El catálogo de productos debe estar cargado en pantalla.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
El cálculo lógico de disponibilidad se ejecuta del lado del servidor durante la carga inicial, sin impacto perceptible en el cliente (< 50ms).
<!-- [SECTION_END: Rendimiento] -->
