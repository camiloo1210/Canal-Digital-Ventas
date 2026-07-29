---
id: "69f96106-a113-4ccd-a653-8c67954cb578"
title: 'CU-MOD6-02: Configurar Precios al Por Mayor'
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
    id: "6418d17f-a7cf-4336-bd41-042024196f9d"
---

<!-- [SECTION_START: description] -->

El Administrador fija el valor comercial B2B de un SKU. Este caso de uso es crítico porque el campo wholesale_price es el detonante lógico que le indica al sistema si debe mostrar el producto con el distintivo (Badge) "Mayorista" en el catálogo público.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. El Administrador ingresa un valor negativo (ej. -5.00). -> El sistema bloquea el guardado advirtiendo: "El precio no puede ser negativo."

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El precio se actualiza en la base de datos y altera las condiciones de compra en el carrito para los futuros pedidos.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El producto debe estar creado previamente. Permiso ROLES_MANAGE.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Administrador selecciona un producto y accede al campo "Precio Mayorista". -> El sistema habilita la edición del campo numérico.
2. El Administrador ingresa el nuevo valor (ej. 1.50) y guarda. -> El sistema valida que el valor sea numérico y positivo (Zod).
3. El sistema actualiza la columna wholesale_price en la base de datos.
4. En el catálogo público, la lógica detecta que el precio > 0 y activa automáticamente la etiqueta visual de "Mayorista".

<!-- [SECTION_END: sequence] -->
