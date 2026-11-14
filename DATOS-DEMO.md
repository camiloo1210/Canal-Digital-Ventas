# Datos de demo (copiar y pegar)

Acompañan a `STORYTELLING.md`. Los valores cumplen los schemas de validación del código.

## Antes de empezar

- En Supabase, desactiva **Confirm email**. Si no, los correos de prueba no entrarán.
- Lemon Squeezy en **test mode**. El webhook `/api/webhooks/lemon-squeezy` necesita un túnel público (por ejemplo ngrok).
- FedEx está en sandbox. Plan B: registrar la guía manualmente.
- Imágenes de producto opcionales: JPG, PNG o WebP, máximo 5 MB.

## Paso 1 · Comprador (`/signup`)

| Campo      | Valor                           |
| ---------- | ------------------------------- |
| Email      | `compras.sanmarino@example.com` |
| Contraseña | `Demo2026!Seguro`               |

## Paso 2 · Vendedor (`/signup/business`)

| Campo            | Valor                         |
| ---------------- | ----------------------------- |
| First Name       | `Jorge`                       |
| Last Name        | `Alvarado`                    |
| Email            | `jorge@costaazul.example.com` |
| Password         | `Demo2026!Seguro`             |
| Store Name       | `Papelería Costa Azul`        |
| Store URL (Slug) | `costa-azul-manta`            |

## Paso 3 · Tienda (`/dashboard/store`)

Descripción (máx. 255):

```
Papelería mayorista en Manta. Más de 450 productos con precios por volumen para colegios, oficinas e instituciones.
```

Dirección de origen del envío:

| Campo       | Valor                            |
| ----------- | -------------------------------- |
| contactName | `Jorge Alvarado`                 |
| phone       | `9015550123`                     |
| street      | `4466 Elvis Presley Blvd Ste 16` |
| city        | `Memphis`                        |
| state       | `TN`                             |
| zipCode     | `38116`                          |
| country     | `US` (2 letras mayúsculas)       |

> Las direcciones de origen y destino son de Memphis (EE. UU.) porque el sandbox de FedEx solo valida direcciones reales de ese país. Ambas coinciden con la tabla de pruebas de FedEx.

## Paso 4 · Categorías

| name                | description                                               |
| ------------------- | --------------------------------------------------------- |
| `Cuadernos y Papel` | `Cuadernos, resmas y papel para oficina e instituciones.` |
| `Escritura y Arte`  | `Esferos, marcadores, lápices y material de dibujo.`      |
| `Oficina y Archivo` | `Carpetas, grapadoras y suministros de oficina.`          |

## Paso 5 · Productos

Reglas: nombre máx. 50, SKU de 5 a 20 caracteres alfanuméricos o guiones, descripción máx. 200. Precios en USD con 2 decimales.

| Nombre                                     | SKU           | Categoría         | Precio  | Costo  | P. mayorista | Mín. mayor. | Stock  | Peso kg | Largo cm | Ancho cm | Alto cm |
| ------------------------------------------ | ------------- | ----------------- | ------- | ------ | ------------ | ----------- | ------ | ------- | -------- | -------- | ------- |
| `Resma Papel Bond A4 75g 500 hojas`        | `PAP-A4-500`  | Cuadernos y Papel | `4.50`  | `3.20` | `3.90`       | `20`        | `800`  | `2.5`   | `30.5`   | `21.5`   | `5.5`   |
| `Marcadores Permanentes Surtidos x12`      | `MAR-PER-12`  | Escritura y Arte  | `9.50`  | `6.40` | `8.00`       | `12`        | `150`  | `0.25`  | `18`     | `10`     | `3`     |
| `Cuaderno Universitario 100 hojas cuadros` | `CUA-UNI-100` | Cuadernos y Papel | `1.75`  | `1.00` | `1.40`       | `50`        | `1200` | `0.28`  | `26`     | `18.5`   | `1`     |
| `Esfero Azul Punta Media caja x50`         | `ESF-AZU-50`  | Escritura y Arte  | `12.00` | `8.00` | `10.00`      | `10`        | `300`  | `0.35`  | `20`     | `10`     | `5`     |
| `Carpeta Archivadora A4 Lomo Ancho`        | `CAR-ARC-A4`  | Oficina y Archivo | `3.25`  | `2.10` | `2.70`       | `24`        | `500`  | `0.45`  | `31`     | `28`     | `8`     |
| `Grapadora Metálica de Escritorio`         | `GRA-MET-ESC` | Oficina y Archivo | `5.80`  | `3.90` | `4.90`       | `12`        | `90`   | `0.4`   | `16`     | `6`      | `10`    |

Descripción de ejemplo (primer producto):

```
Papel bond blanco A4 de 75 g, ideal para impresión y fotocopiado de alto volumen.
```

## Paso 6 · Compra

Carrito: **20** × Resma Papel Bond A4 y **12** × Marcadores Permanentes (ambos alcanzan el mínimo mayorista).

| Campo      | Valor                           |
| ---------- | ------------------------------- |
| name       | `María Fernanda Loor`           |
| email      | `compras.sanmarino@example.com` |
| phone      | `9015550188`                    |
| documentId | `1311234567`                    |
| street     | `4691 Poplar Ave`               |
| city       | `Memphis`                       |
| state      | `TN`                            |
| zipCode    | `38117`                         |
| country    | `US`                            |
| reference  | `Entrada principal, recepción`  |

## Paso 7 · Pago (Lemon Squeezy, modo prueba)

| Campo       | Valor                 |
| ----------- | --------------------- |
| Tarjeta     | `4242 4242 4242 4242` |
| Vencimiento | `12/30`               |
| CVC         | `123`                 |

## Paso 8 · Envío (`/dashboard/orders`)

Tabla FedEx sandbox:

| Campo         | Origen                         | Destino         |
| ------------- | ------------------------------ | --------------- |
| Dirección     | 4466 Elvis Presley Blvd Ste 16 | 4691 Poplar Ave |
| Ciudad        | Memphis                        | Memphis         |
| Estado        | TN                             | TN              |
| Código postal | 38116                          | 38117           |
| País          | US                             | US              |

| Campo   | Valor                                  |
| ------- | -------------------------------------- |
| Estados | `processing` → `shipped` → `delivered` |
| Carrier | `FedEx`                                |
| Guía    | `794600000001`                         |

## Paso 10 · Equipo (`/dashboard/users`)

Rol:

| Campo    | Valor                          |
| -------- | ------------------------------ |
| Nombre   | `Bodeguero`                    |
| Permisos | `VIEW_ORDERS`, `MANAGE_ORDERS` |

Invitación:

| Campo            | Valor             |
| ---------------- | ----------------- |
| Modo de cuenta   | `GENERATED_EMAIL` |
| Expira en (días) | `7`               |
| Usos máximos     | `1`               |

Aceptación (incógnito 2):

| Campo      | Valor             |
| ---------- | ----------------- |
| firstName  | `Luis`            |
| lastName   | `Zambrano`        |
| Contraseña | `Demo2026!Seguro` |

Correo generado: `luis.zambrano@costa-azul-manta.staff.invalid`.

## Notas

- Contraseñas: el registro exige mínimo 6 caracteres, las invitaciones mínimo 8. `Demo2026!Seguro` cumple ambos.
- Slug: solo minúsculas, números y guiones.
- Si repites el ensayo, cambia el slug y los correos o limpia la base de datos.
