---
id: "41e76d27-84ed-49be-b135-8ef417a783e7"
title: 'CU-MOD6-01: Crear, Editar y Eliminar Productos'
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
    id: "8028c7f7-daa9-40d3-a91a-557e54b82368"
---

<!-- [SECTION_START: description] -->

El Administrador gestiona el catálogo maestro de la papelería realizando operaciones CRUD (Crear, Leer, Actualizar, Eliminar). Esto incluye la carga de imágenes al servicio de almacenamiento en la nube (Supabase Storage) y la definición de datos base como nombre y descripción.

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. Falla la subida de la imagen por problemas de red o tamaño excedido. -> El sistema aborta la creación del registro en la base de datos (garantizando integridad) y muestra el error: "No se pudo cargar la imagen. Verifique el tamaño y vuelva a intentar."

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

La base de datos (PostgreSQL) y el bucket de almacenamiento se actualizan. Los cambios se reflejan inmediatamente en el catálogo público al no utilizar caché estática.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El Administrador debe tener sesión activa y poseer el permiso estricto ROLES_MANAGE.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Administrador accede al panel de "Gestión de Catálogo" y selecciona "Nuevo Producto" (o Editar). -> El sistema despliega el formulario de captura de datos (Nombre, Descripción, Imagen).
2. El Administrador completa los campos, adjunta una imagen y presiona "Guardar". -> El sistema (vía Zod) valida los tipos de datos en el cliente y servidor. Verifica la autorización ROLES_MANAGE.
3. El sistema sube el archivo de imagen a Supabase Storage y obtiene la referencia del archivo.
4. El sistema inserta o actualiza el registro del producto en la base de datos con la referencia de la imagen y retorna un mensaje de éxito.

<!-- [SECTION_END: sequence] -->
