# Storytelling: "Papelería Costa Azul sale del mostrador"

Guion de la defensa de tesis (15 minutos). Los datos para copiar y pegar están en `DATOS-DEMO.md`.

**Hilo conductor:** una papelería de Manta que vende solo en el local y depende de la temporada escolar. Se muestra cómo pasa a vender a mayoristas las 24 h, desde cero.

**Ventanas:** normal = Vendedor · incógnito 1 = Comprador · incógnito 2 = Personal invitado.

---

## 0:00–1:30 · Gancho y problema (sin tocar la app)

> "La Papelería Costa Azul, en Manta, solo vende presencial y al detal. Cuando termina la temporada escolar, sus ingresos caen. Un colegio o una oficina que quiere 500 resmas tiene que ir al local a preguntar precios. Hoy les muestro cómo esa misma papelería abre un canal de ventas mayorista en minutos."

## 1:30–3:00 · Paso 1: el comprador crea su cuenta (`/signup`, incógnito 1)

> "Empiezo desde cero, como cualquier cliente nuevo."

_Dato técnico:_ hay rate limiting con Upstash Redis y la identidad es única en Supabase Auth. Con la misma credencial una persona puede ser comprador o vendedor.

## 3:00–4:30 · Paso 2: el vendedor crea su negocio (`/signup/business`, ventana normal)

> "Del otro lado, el dueño registra su negocio. Una sola acción crea la identidad, la tienda y el rol de dueño."

Llegas a `/dashboard`.

_Dato técnico:_ el onboarding usa una clave de idempotencia y una transacción atómica. Moneda base: USD (Ecuador).

## 4:30–5:30 · Paso 3: configurar la tienda (`/dashboard/store`)

Descripción, logo y banner (opcionales), enlace público de la tienda y **dirección de origen del envío**.

> "Antes de vender, la tienda ya sabe desde dónde despacha."

## 5:30–6:30 · Paso 4: categorías (`/dashboard/catalog/categories/new`)

Crea las tres categorías, una por una.

## 6:30–8:30 · Paso 5: productos con precio mayorista (`/dashboard/catalog/products/new`)

Crea 2 en vivo y di "los otros cuatro ya están cargados". Muestra el bloque de venta mayorista: precio y cantidad mínima.

_Dato técnico:_ el dinero se guarda en enteros (centavos), nunca con floats. El formulario conserva lo escrito si el servidor lo rechaza, y las reglas de negocio viven en `packages/core`.

## 8:30–10:30 · Paso 6: el comprador compra (incógnito 1, `/`)

1. Inicia sesión y entra a la tienda **Papelería Costa Azul**.
2. Agrega 20 resmas y 12 marcadores. El precio mayorista se aplica solo al llegar al mínimo.
3. Completa el checkout.

> "Fíjense que el total lo calcula el servidor, no el navegador."

## 10:30–11:30 · Paso 7: pago

Pulsa **Pagar** y se abre Lemon Squeezy (modo prueba).

_Dato técnico:_ el webhook se verifica con HMAC-SHA256 y es idempotente. El pedido pasa de `PENDING` a `CONFIRMED` de forma asíncrona. Hay lógica de expiración y de reembolsos.

## 11:30–13:00 · Paso 8: el vendedor despacha (`/dashboard/orders`)

1. Aparece el pedido nuevo (y la notificación al comerciante).
2. Cambia el estado a **processing** y luego a **shipped**.
3. Registra el envío manual con FedEx, o habilita el seguimiento sandbox.

## 13:00–13:45 · Paso 9: el comprador sigue su pedido (`/purchases`)

Muestra la línea de tiempo y el progreso. Vuelve al vendedor, marca **delivered** y refresca al comprador.

## 13:45–14:30 · Paso 10: inteligencia de negocio y equipo

- `/dashboard/business-intelligence`: ventas, productos con más rotación y el asesor.
- `/dashboard/users`: crea un rol, genera una invitación y acéptala en incógnito 2. El usuario invitado solo ve Pedidos, por el RBAC.

> "El dueño controla permisos sin pedirle correos reales a su personal."

## 14:30–15:00 · Cierre: arquitectura y mensaje final

> "Todo esto corre sobre arquitectura hexagonal. Next.js es solo el adaptador de entrega y la lógica de negocio está en un core en TypeScript puro, probado de forma independiente. Aísla a cada negocio con RLS en PostgreSQL, procesa pagos con webhooks idempotentes y notifica por WhatsApp de forma desacoplada. Para Costa Azul, el objetivo es crecer entre 20 % y 30 % fuera de temporada escolar y subir la rotación de inventario de 6 a 10 veces al año."

---

## Riesgos a cubrir antes de la defensa

- **FedEx sandbox:** usa direcciones de Memphis (EE. UU.) para origen y destino. Si preguntan, di: "En producción serían direcciones de Ecuador; el sandbox de FedEx solo valida direcciones de EE. UU."
- Kivi y WhatsApp (`/dashboard/integrations`) necesitan código de enlace y credenciales de Meta. Quedaron fuera de los 15 min; menciónalos de palabra en el paso 10.
- El slug de tienda y los correos son únicos: si repites el ensayo, cambia el slug o limpia la base.
- Haz un ensayo completo antes, sobre todo el túnel del webhook y el pago, que es donde más puede fallar en vivo.
