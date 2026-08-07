---
id: 4e827f18-62cf-4a56-913a-fcda56ac82e0
title: "CU-MOD6-01: Crear, Editar y Eliminar Productos"
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
urgencia: Alta
integrity_hash: "sha256:7811be927dab0c7e54a4bbab9b23dae5fa969d475c9786cef3a8f468b00d2465"
---

## Actores
<!-- [SECTION_START: Actores] -->
Administrador.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Administrador gestiona el catálogo maestro de la papelería realizando operaciones CRUD (Crear, Leer, Actualizar, Eliminar). Esto incluye la carga de imágenes al servicio de almacenamiento en la nube (Supabase Storage) y la definición de datos base como nombre y descripción.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 Falla la subida de la imagen por problemas de red o tamaño excedido. -> El sistema aborta la creación del registro en la base de datos (garantizando integridad) y muestra el error: "No se pudo cargar la imagen. Verifique el tamaño y vuelva a intentar."
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Administrador accede al panel de "Gestión de Catálogo" y selecciona "Nuevo Producto" (o Editar). -> El sistema despliega el formulario de captura de datos (Nombre, Descripción, Imagen).
2 El Administrador completa los campos, adjunta una imagen y presiona "Guardar". -> El sistema (vía Zod) valida los tipos de datos en el cliente y servidor. Verifica la autorización ROLES_MANAGE.
3 -> El sistema sube el archivo de imagen a Supabase Storage y obtiene la referencia del archivo.
4 -> El sistema inserta o actualiza el registro del producto en la base de datos con la referencia de la imagen y retorna un mensaje de éxito.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
La base de datos (PostgreSQL) y el bucket de almacenamiento se actualizan. Los cambios se reflejan inmediatamente en el catálogo público al no utilizar caché estática.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El Administrador debe tener sesión activa y poseer el permiso estricto ROLES_MANAGE.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
La actualización de datos debe ser < 500ms.
<!-- [SECTION_END: Rendimiento] -->
