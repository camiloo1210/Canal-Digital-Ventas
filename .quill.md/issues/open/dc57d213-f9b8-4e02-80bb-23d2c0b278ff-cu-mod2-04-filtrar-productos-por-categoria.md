---
id: dc57d213-f9b8-4e02-80bb-23d2c0b278ff
title: "CU-MOD2-04: Filtrar Productos por Categoría"
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
frecuencia: Media
importancia: Media
urgencia: Media
integrity_hash: "sha256:83836bfc668bf88ea6344e52914a5a3d77a8639d6ecbe72aac1c44a252a90cd6"
---

## Actores
<!-- [SECTION_START: Actores] -->
Comprador Mayorista.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Comprador Mayorista navega a través de las familias de productos utilizando un menú de categorías desplazable horizontalmente. El filtro es combinable lógicamente con la búsqueda de texto.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 El actor hace clic sobre la categoría que ya se encuentra activa. -> El sistema remueve el parámetro de categoría de la URL, desactivando el filtro, y muestra todos los productos.
2 Un usuario accede directamente mediante un enlace web que contiene una categoría que fue eliminada por el administrador. -> El sistema ignora el parámetro inválido de la URL y carga el catálogo completo por defecto.
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Comprador Mayorista desplaza el menú de categorías y hace clic sobre una opción (ej. "Suministros"). -> El sistema intercepta la acción y actualiza la URL del navegador añadiendo el ID o nombre de la categoría seleccionada.
2 -> El sistema verifica si existe una búsqueda por texto activa (UC-CAT-03). Si existe, aplica una lógica combinada (Categoría AND Texto).
3 -> El sistema filtra el catálogo maestro en memoria.
4 -> El sistema actualiza la grilla de visualización con los productos correspondientes a la categoría.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
La URL se actualiza (ej. ?category=oficina) y la grilla muestra solo los productos pertenecientes a dicha categoría.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
Las categorías deben existir en el sistema y tener productos asociados.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
La transición visual en la interfaz gráfica debe ser fluida, sin bloqueos del hilo principal del navegador.
<!-- [SECTION_END: Rendimiento] -->
