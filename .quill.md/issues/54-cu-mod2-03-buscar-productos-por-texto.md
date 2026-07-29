---
id: "e0b7ef13-15b6-40a1-a99f-12357e48093e"
title: 'CU-MOD2-03: Buscar Productos por Texto'
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
    id: "c14d990d-745f-48e1-9eef-2fb369c18639"
---

<!-- [SECTION_START: description] -->

El usuario utiliza la barra de búsqueda para localizar un SKU específico mediante su nombre. El sistema aplica un retraso intencional (debounce) y actualiza la URL para convertirla en la fuente de verdad del estado de la búsqueda.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. Ningún producto coincide con el texto ingresado. -> El sistema muestra el mensaje: "No se encontraron resultados para la búsqueda actual."
2. El usuario borra todo el texto de la barra. -> El sistema elimina el parámetro de la URL y vuelve a renderizar el catálogo completo (450 SKUs).

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

La URL del navegador se actualiza (ej. ?q=cuaderno) y la grilla muestra únicamente los productos que coinciden con el texto ingresado.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El catálogo debe estar cargado.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Actor hace clic en la barra de búsqueda y teclea el nombre del producto deseado. -> El sistema captura la entrada de teclado pero retiene la ejecución de la búsqueda (debounce).
2. Tras detectar 300 milisegundos de inactividad en el teclado, el sistema actualiza silenciosamente los parámetros de la URL del navegador.
3. El sistema extrae el texto de la URL, lo convierte a minúsculas y filtra el listado completo buscando coincidencias en el nombre del producto (case-insensitive).
4. El sistema renderiza la nueva grilla con los resultados.

<!-- [SECTION_END: sequence] -->
