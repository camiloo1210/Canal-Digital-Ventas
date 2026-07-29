---
id: 522238b4-2ae2-4651-af4e-d7483b816725
title: "CU-MOD2-01: Visualizar Catálogo y Precios Mayoristas"
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
importancia: Vital
urgencia: Inmediata
integrity_hash: "sha256:54ba0dc1a26e748e66ae0a1ebdeec7d2f1be856575bf4c88a42801620418cdcf"
---

## Actores
<!-- [SECTION_START: Actores] -->
Comprador Mayorista,Vendedor
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El usuario accede al canal web para explorar el inventario de la Papelería Costa Azul. El sistema despliega la grilla de productos (450 SKUs) solicitando las imágenes de forma segura y calculando la visualización del precio Mayorista.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 No hay productos activos registrados en el sistema. -> El sistema muestra una alerta visual: "Actualmente no hay productos disponibles en el catálogo."
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Actor ingresa a la URL principal del canal de ventas digital. -> El sistema (mediante Server Components) consulta la base de datos eludiendo la caché para asegurar datos en tiempo real.
2 -> El sistema solicita a la API de Storage la generación de URLs firmadas con caducidad de 1 hora para las imágenes de los productos.
3 -> El sistema evalúa el campo wholesale_price. Si es mayor a cero, activa el renderizado de la etiqueta "Mayorista" junto al precio
4 -> El sistema despliega la información estructurada (nombre, descripción, imagen y precio) en el dispositivo del actor.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
La interfaz renderiza la grilla de productos de forma responsiva (1 a 4 columnas) con la información comercial actualizada.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El usuario debe tener conexión a internet. Los productos deben estar registrados en estado activo en la base de datos (Supabase).
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
El tiempo de respuesta (TTFB) y renderizado inicial del catálogo completo no debe superar los 500 milisegundos .
<!-- [SECTION_END: Rendimiento] -->
