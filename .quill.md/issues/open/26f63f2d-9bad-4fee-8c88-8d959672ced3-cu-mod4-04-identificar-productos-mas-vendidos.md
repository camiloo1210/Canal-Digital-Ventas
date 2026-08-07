---
id: 26f63f2d-9bad-4fee-8c88-8d959672ced3
title: "CU-MOD4-04: Identificar Productos Más Vendidos"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
issue_type: use-case
status: open
labels:
  - ai-generated
relations:
  - type: parent
    id: d8174760-fde6-41ca-9d33-30567f9a1ca6
integrity_hash: "sha256:5d98268ff5219e273cd62c3b49539c2bf469745fbcc640d2ddfbcf2622107b27"
---

## Actores
<!-- [SECTION_START: Actores] -->
Administrador.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Administrador visualiza un ranking (Top) de los productos (SKUs) con mayor salida en el canal mayorista. Esta información es el insumo principal para que el dueño ajuste los precios mayoristas (wholesale_price) y planifique el abastecimiento físico de la papelería.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 Aún no se han registrado ventas en el canal digital (Día 1 de lanzamiento). -> El sistema despliega el mensaje: "Aún no hay suficientes datos para generar el ranking de productos."
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Administrador hace clic en la pestaña "Top Productos". -> El sistema ejecuta una consulta relacional (JOIN) entre la tabla de Pedidos, Detalles_Pedido y Productos.
2 -> El sistema suma las cantidades vendidas por cada ID de producto, filtrando solo pedidos no cancelados, y ordena el resultado de forma descendente.
3 -> El sistema renderiza una tabla mostrando: Nombre del Producto, Categoría, Unidades Vendidas y Total Ingresado.
4 El Administrador puede usar un botón de acceso directo desde esta tabla para editar el precio del producto. ->
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
El sistema despliega una tabla ordenada de mayor a menor según el volumen de unidades vendidas.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El Administrador debe estar dentro del Dashboard.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
Las consultas complejas (JOINs) deben estar optimizadas mediante índices en la base de datos PostgreSQL para evitar cuellos de botella al escalar la cantidad de pedidos.
<!-- [SECTION_END: Rendimiento] -->
