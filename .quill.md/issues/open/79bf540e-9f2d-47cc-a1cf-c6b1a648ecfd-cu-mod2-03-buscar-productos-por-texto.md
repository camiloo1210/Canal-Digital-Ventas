---
id: 79bf540e-9f2d-47cc-a1cf-c6b1a648ecfd
title: "CU-MOD2-03: Buscar Productos por Texto"
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
frecuencia: Alta
importancia: Alta
urgencia: Media
integrity_hash: "sha256:f0c91e6e8155dde2d00f6fe7a8cc566bc612c0a403d0df40ce499d191f72b6db"
---

## Actores
<!-- [SECTION_START: Actores] -->
Comprador Mayorista,Vendedor
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El usuario utiliza la barra de búsqueda para localizar un SKU específico mediante su nombre. El sistema aplica un retraso intencional (debounce) y actualiza la URL para convertirla en la fuente de verdad del estado de la búsqueda.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 Ningún producto coincide con el texto ingresado. -> El sistema muestra el mensaje: "No se encontraron resultados para la búsqueda actual."
2 El usuario borra todo el texto de la barra. -> El sistema elimina el parámetro de la URL y vuelve a renderizar el catálogo completo (450 SKUs).
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Actor hace clic en la barra de búsqueda y teclea el nombre del producto deseado. -> El sistema captura la entrada de teclado pero retiene la ejecución de la búsqueda (debounce).
2 -> Tras detectar 300 milisegundos de inactividad en el teclado, el sistema actualiza silenciosamente los parámetros de la URL del navegador.
3 -> El sistema extrae el texto de la URL, lo convierte a minúsculas y filtra el listado completo buscando coincidencias en el nombre del producto (case-insensitive).
4 -> El sistema renderiza la nueva grilla con los resultados.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
La URL del navegador se actualiza (ej. ?q=cuaderno) y la grilla muestra únicamente los productos que coinciden con el texto ingresado.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El catálogo debe estar cargado.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
El debounce de 300ms es obligatorio para evitar múltiples renderizados innecesarios y optimizar el uso de memoria en el navegador del cliente.
<!-- [SECTION_END: Rendimiento] -->
