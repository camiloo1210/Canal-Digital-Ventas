---
id: 000e03fb-32bf-4228-920a-1ea3ae81a362
title: "CU-MOD6-03: Gestionar Categorías y Niveles de Stock"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-08-06"
issue_type: use-case
status: open
labels:
  - ai-generated
relations:
  - type: parent
    id: 85ec2bcf-6220-4ffc-b64e-87346d3346be
frecuencia: Alta
importancia: Vital
urgencia: Media
integrity_hash: "sha256:3832d2791ee10cfc0989c654e2a0c4971ccc9be1b3d9a9a5ef0214ae725e0f9e"
---

## Actores
<!-- [SECTION_START: Actores] -->
Administrador.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Administrador organiza el catálogo agrupando productos por familias (útiles, suministros, bazar) y actualiza manualmente las cantidades físicas disponibles en el local, lo cual alimenta el motor de disponibilidad del sistema.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 El Administrador intenta eliminar una categoría que tiene 20 productos asociados. -> El sistema protege la integridad referencial de la base de datos y bloquea la acción: "No puedes eliminar una categoría en uso. Reasigna los productos primero."
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Administrador accede a la gestión de inventario y modifica la cantidad de un producto (ej. de 50 a 15). -> El sistema valida la solicitud de actualización y la ejecuta en la base de datos.
2 -> El sistema recalcula la disponibilidad: el producto pasa de mostrar la etiqueta verde "Disponible" a la etiqueta amarilla "Pocas unidades" en tiempo real.
3 El Administrador crea una nueva categoría "Cartulinas" y la asocia a varios SKUs. -> El sistema registra la categoría y actualiza el menú de navegación horizontal del catálogo para incluir el nuevo filtro.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
Las categorías permiten el filtrado en la interfaz del cliente. El nivel de stock altera las etiquetas de "Disponible/Agotado" y las validaciones del carrito.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
Permiso ROLES_MANAGE.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
Operación de actualización: < 300ms.
<!-- [SECTION_END: Rendimiento] -->
