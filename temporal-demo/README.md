# temporal-demo: material para la presentación

Todo lo necesario para ensayar y presentar la demo de Papelería Costa Azul. Es una carpeta temporal en una rama aparte.

## Contenido

| Ruta                                       | Para qué sirve                                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `STORYTELLING.md`                          | Guion de 15 min: solo se crea el negocio en vivo; el resto usa uno ya configurado, mapeado a las 8 épicas |
| `DATOS-DEMO.md`                            | Valores para copiar y pegar en cada formulario                                                            |
| `rag/papeleria-costa-azul-conocimiento.md` | Documento para probar RAG (Kivi)                                                                          |
| `imagenes/`                                | Una foto por producto, lista para subir                                                                   |
| `imagenes/ATRIBUCION.md`                   | Autor y licencia de cada foto                                                                             |

## Imágenes por producto

| Producto                                 | SKU         | Archivo                    |
| ---------------------------------------- | ----------- | -------------------------- |
| Resma Papel Bond A4 75g 500 hojas        | PAP-A4-500  | `imagenes/pap-a4-500.jpg`  |
| Marcadores Permanentes Surtidos x12      | MAR-PER-12  | `imagenes/mar-per-12.jpg`  |
| Cuaderno Universitario 100 hojas cuadros | CUA-UNI-100 | `imagenes/cua-uni-100.jpg` |
| Esfero Azul Punta Media caja x50         | ESF-AZU-50  | `imagenes/esf-azu-50.jpg`  |
| Carpeta Archivadora A4 Lomo Ancho        | CAR-ARC-A4  | `imagenes/car-arc-a4.jpg`  |
| Grapadora Metálica de Escritorio         | GRA-MET-ESC | `imagenes/gra-met-esc.jpg` |

Son JPG de hasta 1200 px de ancho y pesan menos de 1 MB, así que cumplen el límite de 5 MB. Puedes arrastrarlas al recuadro de imágenes del producto. Son fotos genéricas de Wikimedia Commons, no de las marcas exactas.

## Probar el RAG

1. Entra a `/dashboard/integrations` y ve a la sección de conocimiento de Kivi.
2. Sube `rag/papeleria-costa-azul-conocimiento.md`. Se admiten `.md`, `.markdown` y `.txt` de hasta 200 KB; este pesa unos 7 KB.
3. Espera a que el documento termine de sincronizarse.
4. Haz las preguntas de la tabla final del documento y compara las respuestas.

Kivi necesita un código de enlace y las credenciales de Meta (ver `STORYTELLING.md`, sección de riesgos). Sin eso, solo puedes mostrar la subida del documento.

## Lista previa a la presentación

- [ ] Supabase: **Confirm email** desactivado.
- [ ] Lemon Squeezy en modo de prueba, con el túnel público activo para el webhook.
- [ ] FedEx en sandbox. Plan B: guía manual.
- [ ] Ventana normal para el vendedor y dos ventanas de incógnito para comprador y staff.
- [ ] Base de datos limpia, o slug y correos nuevos si repites el ensayo.
- [ ] `GEMINI_API_KEY` en `apps/web/.env.local` para el asesor de Business Intelligence.
- [ ] Carpeta `imagenes/` abierta para arrastrar las fotos.

## Analítica (EPIC-08)

Los KPI y las ventas históricas dependen de pedidos reales. Antes de la defensa, haz varios pedidos de ensayo en el negocio de referencia (distintos productos y estados) para que el Business Intelligence muestre datos.

## Nota

El documento RAG es ficticio. Las políticas de devolución, horarios y envíos están inventados para la demo y no reflejan reglas reales del sistema.
