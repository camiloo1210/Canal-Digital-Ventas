---
id: "0ed48a39-6015-4763-8deb-c37749a60c4a"
title: 'CU-MOD2-04: Filtrar Productos por Categoría'
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
    id: "0fbe3b76-48e8-43c9-9c20-151b6c604305"
---

<!-- [SECTION_START: description] -->

El Comprador Mayorista navega a través de las familias de productos utilizando un menú de categorías desplazable horizontalmente. El filtro es combinable lógicamente con la búsqueda de texto.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. El actor hace clic sobre la categoría que ya se encuentra activa. -> El sistema remueve el parámetro de categoría de la URL, desactivando el filtro, y muestra todos los productos.
2. Un usuario accede directamente mediante un enlace web que contiene una categoría que fue eliminada por el administrador. -> El sistema ignora el parámetro inválido de la URL y carga el catálogo completo por defecto.

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

La URL se actualiza (ej. ?category=oficina) y la grilla muestra solo los productos pertenecientes a dicha categoría.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

Las categorías deben existir en el sistema y tener productos asociados.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Comprador Mayorista desplaza el menú de categorías y hace clic sobre una opción (ej. "Suministros"). -> El sistema intercepta la acción y actualiza la URL del navegador añadiendo el ID o nombre de la categoría seleccionada.
2. El sistema verifica si existe una búsqueda por texto activa (UC-CAT-03). Si existe, aplica una lógica combinada (Categoría AND Texto).
3. El sistema filtra el catálogo maestro en memoria.
4. El sistema actualiza la grilla de visualización con los productos correspondientes a la categoría.

<!-- [SECTION_END: sequence] -->
