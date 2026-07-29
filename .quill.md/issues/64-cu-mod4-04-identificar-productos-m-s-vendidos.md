---
id: "dbb283ff-d032-4439-98cb-b766c19eb74a"
title: 'CU-MOD4-04: Identificar Productos Más Vendidos'
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
    id: "419807e0-c9c6-476f-9040-4e001e6dac99"
---

<!-- [SECTION_START: description] -->

El Administrador visualiza un ranking (Top) de los productos (SKUs) con mayor salida en el canal mayorista. Esta información es el insumo principal para que el dueño ajuste los precios mayoristas (wholesale_price) y planifique el abastecimiento físico de la papelería.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. Aún no se han registrado ventas en el canal digital (Día 1 de lanzamiento). -> El sistema despliega el mensaje: "Aún no hay suficientes datos para generar el ranking de productos."

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El sistema despliega una tabla ordenada de mayor a menor según el volumen de unidades vendidas.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El Administrador debe estar dentro del Dashboard.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Administrador hace clic en la pestaña "Top Productos". -> El sistema ejecuta una consulta relacional (JOIN) entre la tabla de Pedidos, Detalles_Pedido y Productos.
2. El sistema suma las cantidades vendidas por cada ID de producto, filtrando solo pedidos no cancelados, y ordena el resultado de forma descendente.
3. El sistema renderiza una tabla mostrando: Nombre del Producto, Categoría, Unidades Vendidas y Total Ingresado.
4. El Administrador puede usar un botón de acceso directo desde esta tabla para editar el precio del producto.

<!-- [SECTION_END: sequence] -->
