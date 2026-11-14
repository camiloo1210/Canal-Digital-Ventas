# Storytelling: "Papelería Costa Azul sale del mostrador"

Guion de la defensa de tesis (15 minutos). Los datos para copiar y pegar están en `DATOS-DEMO.md`.

**Hilo conductor:** una papelería de Manta que vende solo en el local y depende de la temporada escolar. Se muestra cómo abre un canal de ventas mayorista las 24 h.

**Ventanas:** normal = Vendedor/Administrador · incógnito 1 = Comprador · incógnito 2 = Personal invitado.

## Enfoque de esta versión

- **En vivo solo se crea el negocio** (`/signup/business`). Es el momento que muestra que el sistema nace desde cero.
- **La configuración no se repite.** Tienda, categorías, productos, imágenes, dirección de envío y comprador ya están creados en un negocio de referencia, con los datos de `DATOS-DEMO.md` y las fotos de `imagenes/`. Hacerlos en vivo consumiría tiempo sin aportar valor a la defensa.
- **Frase para decirlo:** "Por temas de configuración, que no son relevantes para lo que quiero demostrar, uso el negocio que ya dejé preparado. Así nos concentramos en el flujo comercial."
- Cada paso se amarra a una épica del backlog (EPIC-01 a EPIC-08), para que el jurado vea que lo demostrado coincide con lo planificado.

## Mapa de épicas

| Épica                                      | Qué se demuestra                                              | Minuto |
| ------------------------------------------ | ------------------------------------------------------------- | ------ |
| EPIC-01 Categorías, productos e inventario | Catálogo, stock y precio mayorista                            | 3:30   |
| EPIC-02 Exploración y búsqueda             | Catálogo público, stock, búsqueda y filtro por categoría      | 5:00   |
| EPIC-03 Carrito y pedidos                  | Carrito, pedido y cancelación                                 | 6:00   |
| EPIC-04 Pagos y estado de pedidos          | Lemon Squeezy y cambio de estado                              | 8:00   |
| EPIC-05 WhatsApp                           | Configuración y notificación automática                       | 10:30  |
| EPIC-06 Autoservicio                       | Bot que consulta el pedido y responde sobre facturación RIMPE | 11:30  |
| EPIC-07 Usuarios, roles y permisos         | Rol, invitación y datos de usuarios                           | 13:00  |
| EPIC-08 Analítica                          | KPI, ventas históricas, pedidos y más vendidos                | 13:45  |

---

## 0:00–1:30 · Gancho y problema (sin tocar la app)

> "La Papelería Costa Azul, en Manta, solo vende presencial y al detal. Cuando termina la temporada escolar, sus ingresos caen. Un colegio o una oficina que quiere 500 resmas tiene que ir al local a preguntar precios. Hoy les muestro cómo esa misma papelería abre un canal de ventas mayorista."

## 1:30–3:00 · Crear el negocio en vivo (`/signup/business`, ventana normal)

Es lo único que se hace desde cero. Usa los datos del Paso 2 de `DATOS-DEMO.md` con un slug nuevo, por ejemplo `costa-azul-demo`, para no chocar con el negocio de referencia.

> "Una sola acción crea la identidad, la tienda y el rol de dueño."

Llegas a `/dashboard`. Muestra que está vacío.

_Dato técnico:_ el onboarding usa una clave de idempotencia y una transacción atómica. Moneda base: USD (Ecuador). Hay rate limiting con Upstash Redis y la identidad es única en Supabase Auth.

## 3:00–3:30 · Cambio al negocio de referencia

Cierra sesión (o usa otra ventana) e inicia sesión como `jorge@costaazul.example.com`.

> "Por temas de configuración, que no son relevantes para lo que quiero demostrar, continúo con el negocio ya preparado, que tiene tienda, categorías, productos y dirección de envío cargados."

## 3:30–5:00 · EPIC-01: categorías, productos e inventario (`/dashboard/catalog`)

1. Muestra las 3 categorías y los 6 productos con su imagen.
2. Abre **Resma Papel Bond A4** y señala el bloque de venta mayorista: 3.90 USD desde 20 unidades.
3. Cambia el stock de un producto y guarda (por ejemplo 800 → 750).

Si hay tiempo, crea o edita una categoría o un producto en vivo.

_Dato técnico:_ el dinero se guarda en enteros (centavos), nunca con floats. El formulario conserva lo escrito si el servidor lo rechaza, y las reglas de negocio viven en `packages/core`.

## 5:00–6:00 · EPIC-02: exploración y búsqueda (incógnito 1, `/store/costa-azul-manta`)

Como comprador, con sesión iniciada como `compras.sanmarino@example.com`:

1. Recorre el catálogo con precios y la disponibilidad de stock.
2. Busca "resma" en la barra de búsqueda.
3. Filtra por la categoría **Escritura y Arte**.

> "El comprador encuentra el SKU que necesita sin llamar a nadie."

## 6:00–8:00 · EPIC-03: carrito y pedido

1. Agrega 20 resmas y 12 marcadores. El precio mayorista se aplica solo al llegar al mínimo.
2. Completa el checkout con los datos del Paso 6 de `DATOS-DEMO.md`.
3. Se genera el pedido.
4. Muestra en `/purchases` que el comprador puede cancelar un pedido mientras no esté enviado. Hazlo con un segundo pedido pequeño, no con el principal.

> "Fíjense que el total lo calcula el servidor, no el navegador."

## 8:00–10:30 · EPIC-04: pago y estado del pedido

1. Pulsa **Pagar**. Se abre Lemon Squeezy en modo prueba (tarjeta `4242 4242 4242 4242`).
2. El pedido pasa de `PENDING` a `CONFIRMED` de forma asíncrona cuando llega el webhook.
3. Vendedor, en `/dashboard/orders`: cambia el estado a **processing**, luego **shipped**, y registra la guía de FedEx.
4. Comprador, en `/purchases`: muestra la línea de tiempo. Vuelve al vendedor, marca **delivered** y refresca.

_Dato técnico:_ el webhook se verifica con HMAC-SHA256 y es idempotente. Hay lógica de expiración y de reembolsos.

## 10:30–11:30 · EPIC-05: WhatsApp (`/dashboard/integrations`)

Muestra la sección de WhatsApp: el token de autenticación y el canal, ya conectados en el negocio de referencia. Al cambiar el estado del pedido, enseña la notificación que llega al comprador.

> "Cada cambio de estado se avisa al comprador sin que el vendedor escriba nada."

_Dato técnico:_ la notificación sale por un outbox desacoplado, no dentro de la transacción del pedido. Si Meta no está disponible en el momento de la defensa, muestra la configuración y explícalo de palabra.

## 11:30–13:00 · EPIC-06: autoservicio con el bot (Kivi)

1. En `/dashboard/integrations`, sección de conocimiento, muestra el documento `rag/papeleria-costa-azul-conocimiento.md` ya cargado.
2. Pregunta al bot por el estado del pedido recién creado.
3. Pregunta: "¿Cómo pido factura? Soy contribuyente RIMPE." La respuesta debe salir del documento.
4. Pregunta algo que no está (por ejemplo, computadoras) y muestra que el bot no inventa.

> "El bot responde con el conocimiento del propio negocio, no con respuestas genéricas."

## 13:00–13:45 · EPIC-07: usuarios, roles y permisos (`/dashboard/users`)

1. Muestra la lista de usuarios y su información.
2. Crea el rol **Bodeguero** (`VIEW_ORDERS`, `MANAGE_ORDERS`).
3. Genera una invitación y acéptala en incógnito 2. El invitado solo ve Pedidos, por el RBAC.
4. Menciona que cada usuario actualiza sus propios datos desde su perfil.

> "El dueño controla permisos sin pedirle correos reales a su personal."

## 13:45–14:30 · EPIC-08: analítica (`/dashboard` y `/dashboard/business-intelligence`)

1. KPI del canal: ingresos y total de clientes.
2. Ventas históricas del período.
3. Métricas de pedidos y cuellos de botella.
4. Productos más vendidos para planificar el abastecimiento, y el asesor de IA.

> "Con esto el dueño decide qué reponer antes de que se agote."

## 14:30–15:00 · Cierre: arquitectura y mensaje final

> "Todo esto corre sobre arquitectura hexagonal. Next.js es solo el adaptador de entrega y la lógica de negocio está en un core en TypeScript puro, probado de forma independiente. Aísla a cada negocio con RLS en PostgreSQL, procesa pagos con webhooks idempotentes y notifica por WhatsApp de forma desacoplada. Para Costa Azul, el objetivo es crecer entre 20 % y 30 % fuera de temporada escolar y subir la rotación de inventario de 6 a 10 veces al año."

---

## Preparación previa (negocio de referencia)

Antes de la defensa, deja listo, con `DATOS-DEMO.md`:

- [ ] Vendedor `jorge@costaazul.example.com` con tienda `costa-azul-manta`, descripción y dirección de origen.
- [ ] Las 3 categorías y los 6 productos, con las fotos de `imagenes/` y precios mayoristas.
- [ ] Comprador `compras.sanmarino@example.com`.
- [ ] WhatsApp conectado y documento RAG cargado en Kivi (ver `README.md`).
- [ ] Datos de ventas previas, para que la analítica (EPIC-08) no salga vacía. Ver `README.md`, sección de analítica.
- [ ] Supabase con **Confirm email** desactivado, Lemon Squeezy en modo prueba con túnel activo, FedEx en sandbox.

## Riesgos

- **Analítica vacía:** con un negocio nuevo, los KPI y las ventas históricas salen en cero. Haz pedidos de ensayo en el negocio de referencia antes de la defensa.
- **FedEx sandbox:** usa direcciones de Memphis (EE. UU.). Si preguntan, di: "En producción serían direcciones de Ecuador; el sandbox de FedEx solo valida direcciones de EE. UU."
- **Kivi y WhatsApp** necesitan código de enlace y credenciales de Meta. Si fallan en vivo, muestra la configuración y explica el flujo de palabra.
- **Cancelación de pedido:** confirma en un ensayo en qué estados el sistema permite cancelar, antes de prometerlo en voz alta.
- El slug de tienda y los correos son únicos: si repites el ensayo, cambia el slug o limpia la base.
- Haz un ensayo completo antes, sobre todo el túnel del webhook y el pago, que es donde más puede fallar en vivo.
