---
id: 3402b937-36ec-4dd3-ac6f-36a903e542f6
title: "CU-MOD6-02: Configurar Precios al Por Mayor"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
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
integrity_hash: "sha256:5dc90578d20bb63cf62fcab8069f67eeaabbfd22e7ac3771cfd5df7adc241e94"
---

## Actores
<!-- [SECTION_START: Actores] -->
Administrador.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Administrador fija el valor comercial B2B de un SKU. Este caso de uso es crítico porque el campo wholesale_price es el detonante lógico que le indica al sistema si debe mostrar el producto con el distintivo (Badge) "Mayorista" en el catálogo público.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 El Administrador ingresa un valor negativo (ej. -5.00). -> El sistema bloquea el guardado advirtiendo: "El precio no puede ser negativo."
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Administrador selecciona un producto y accede al campo "Precio Mayorista". -> El sistema habilita la edición del campo numérico.
2 El Administrador ingresa el nuevo valor (ej. 1.50) y guarda. -> El sistema valida que el valor sea numérico y positivo (Zod).
3 -> El sistema actualiza la columna wholesale_price en la base de datos.
4 -> En el catálogo público, la lógica detecta que el precio > 0 y activa automáticamente la etiqueta visual de "Mayorista".
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
El precio se actualiza en la base de datos y altera las condiciones de compra en el carrito para los futuros pedidos.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El producto debe estar creado previamente. Permiso ROLES_MANAGE.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
Operación de actualización de columna específica: < 200ms.
<!-- [SECTION_END: Rendimiento] -->
