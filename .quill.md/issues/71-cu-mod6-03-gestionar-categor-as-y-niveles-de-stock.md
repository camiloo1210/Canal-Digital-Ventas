---
id: "7f52410c-be0c-4fda-92ff-affdaaf63e1f"
title: 'CU-MOD6-03: Gestionar Categorías y Niveles de Stock'
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
    id: "180f7de6-1fca-4bb0-adde-bdbaf7a87d05"
---

<!-- [SECTION_START: description] -->

El Administrador organiza el catálogo agrupando productos por familias (útiles, suministros, bazar) y actualiza manualmente las cantidades físicas disponibles en el local, lo cual alimenta el motor de disponibilidad del sistema.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. El Administrador intenta eliminar una categoría que tiene 20 productos asociados. -> El sistema protege la integridad referencial de la base de datos y bloquea la acción: "No puedes eliminar una categoría en uso. Reasigna los productos primero."

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

Las categorías permiten el filtrado en la interfaz del cliente. El nivel de stock altera las etiquetas de "Disponible/Agotado" y las validaciones del carrito.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

Permiso ROLES_MANAGE.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Administrador accede a la gestión de inventario y modifica la cantidad de un producto (ej. de 50 a 15). -> El sistema valida la solicitud de actualización y la ejecuta en la base de datos.
2. El sistema recalcula la disponibilidad: el producto pasa de mostrar la etiqueta verde "Disponible" a la etiqueta amarilla "Pocas unidades" en tiempo real.
3. El Administrador crea una nueva categoría "Cartulinas" y la asocia a varios SKUs. -> El sistema registra la categoría y actualiza el menú de navegación horizontal del catálogo para incluir el nuevo filtro.

<!-- [SECTION_END: sequence] -->
