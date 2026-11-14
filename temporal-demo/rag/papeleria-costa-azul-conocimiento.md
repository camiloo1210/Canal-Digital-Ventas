# Papelería Costa Azul: base de conocimiento

Documento de demostración para probar RAG (Kivi, Conocimiento en `/dashboard/integrations`). Es contenido ficticio de la tienda de ejemplo.

## Sobre la tienda

Papelería Costa Azul es una papelería mayorista con sede en Manta, Ecuador. Vende cuadernos, papel, material de escritura y suministros de oficina a colegios, oficinas e instituciones. Tiene más de 450 productos con precios por volumen. La tienda en línea está en `/store/costa-azul-manta`.

Horario de atención por WhatsApp: lunes a viernes de 08:00 a 18:00 y sábados de 09:00 a 13:00 (hora de Ecuador). Los domingos y feriados no se atienden mensajes.

Responsable de la tienda: Jorge Alvarado.

## Catálogo y precios

Todos los precios están en dólares estadounidenses (USD). Cada producto tiene precio unitario y precio mayorista. El precio mayorista se aplica automáticamente al llegar a la cantidad mínima mayorista.

| Producto                                 | SKU         | Precio unitario | Precio mayorista | Mínimo para mayorista | Stock inicial |
| ---------------------------------------- | ----------- | --------------- | ---------------- | --------------------- | ------------- |
| Resma Papel Bond A4 75g 500 hojas        | PAP-A4-500  | 4.50            | 3.90             | 20 unidades           | 800           |
| Marcadores Permanentes Surtidos x12      | MAR-PER-12  | 9.50            | 8.00             | 12 unidades           | 150           |
| Cuaderno Universitario 100 hojas cuadros | CUA-UNI-100 | 1.75            | 1.40             | 50 unidades           | 1200          |
| Esfero Azul Punta Media caja x50         | ESF-AZU-50  | 12.00           | 10.00            | 10 unidades           | 300           |
| Carpeta Archivadora A4 Lomo Ancho        | CAR-ARC-A4  | 3.25            | 2.70             | 24 unidades           | 500           |
| Grapadora Metálica de Escritorio         | GRA-MET-ESC | 5.80            | 4.90             | 12 unidades           | 90            |

### Ejemplo de ahorro mayorista

Si un colegio compra 20 resmas de papel bond A4, paga 3.90 por resma y no 4.50. Son 78.00 USD en lugar de 90.00 USD, un ahorro de 12.00 USD (13,3 %).

### Detalles de producto

- **Resma Papel Bond A4:** papel blanco de 75 g, 500 hojas, ideal para impresión y fotocopiado de alto volumen. Pesa 2.5 kg.
- **Marcadores permanentes:** caja surtida de 12 marcadores de tinta permanente. Pesa 0.25 kg.
- **Cuaderno universitario:** 100 hojas, formato cuadros, tamaño 26 x 18.5 cm.
- **Esfero azul:** caja de 50 unidades, punta media, tinta azul.
- **Carpeta archivadora A4:** lomo ancho, tamaño A4, 8 cm de lomo.
- **Grapadora metálica:** de escritorio, cuerpo metálico, pesa 0.4 kg.

## Categorías

- Cuadernos y Papel: cuadernos, resmas y papel para oficina e instituciones.
- Escritura y Arte: esferos, marcadores, lápices y material de dibujo.
- Oficina y Archivo: carpetas, grapadoras y suministros de oficina.

## Cómo comprar

1. Entra a la tienda y agrega productos al carrito.
2. En el checkout completa nombre, correo, teléfono, cédula o documento, dirección de envío y referencia.
3. Paga con tarjeta. El pago lo procesa Lemon Squeezy.
4. Recibes la confirmación por correo y puedes seguir el pedido en "Mis compras".

Se necesita una cuenta de comprador. Se crea en `/signup` con correo y una contraseña de 6 caracteres o más.

## Formas de pago

- Se aceptan tarjetas de crédito y débito mediante Lemon Squeezy.
- No se recibe efectivo ni transferencias en la tienda en línea.
- El pedido pasa a "procesando" cuando el pago se confirma.
- Para pruebas existe una tarjeta de prueba: 4242 4242 4242 4242, con cualquier fecha futura y CVC de 3 dígitos. Funciona solo en modo de prueba.

## Envíos

- Los envíos se hacen con FedEx.
- Cuando el vendedor despacha, el pedido pasa a "enviado" y se registra el número de guía. El comprador lo ve en su historial.
- Un pedido tiene estos estados: pendiente, procesando, enviado y entregado. También puede cancelarse.
- El tiempo de preparación es de 1 a 2 días hábiles después de confirmado el pago.
- El costo de envío se calcula según el peso y las dimensiones del paquete y el destino.
- Una resma de papel A4 pesa 2.5 kg, por eso los pedidos grandes de papel pueden costar más de envío.

## Devoluciones y garantía

- Aceptamos devoluciones de productos sin abrir hasta 7 días después de la entrega.
- Si el producto llega dañado o equivocado, escribe dentro de 48 horas con una foto. Lo reponemos sin costo.
- Los marcadores y esferos abiertos o usados no se pueden devolver, salvo defecto de fábrica.
- Los reembolsos se devuelven al mismo método de pago.

## Facturación

- Se emite factura a nombre de la persona o institución que indique en el checkout, usando su cédula o RUC como documento.
- Para colegios e instituciones se puede pedir una cotización formal antes de comprar.

## Facturación y régimen RIMPE

- Papelería Costa Azul emite comprobantes electrónicos por cada venta.
- Para pedir factura, indica en el checkout el nombre o razón social y la cédula o RUC. Si olvidaste hacerlo, escribe por WhatsApp con el número de pedido dentro de los 7 días posteriores a la compra.
- Si eres contribuyente del régimen RIMPE (Emprendedor o Negocio Popular), envía tu RUC y confirma tu categoría para que la factura se emita con los datos correctos.
- Los datos de este apartado son orientativos para la demostración. Para decisiones tributarias, consulta al SRI o a tu contador.

## Descuentos para instituciones

- Las compras que alcanzan el mínimo mayorista reciben el precio mayorista automáticamente.
- Para pedidos de más de 500 USD escribe por WhatsApp para negociar condiciones especiales.
- No se acumulan descuentos mayoristas con otras promociones.

## Preguntas frecuentes

**¿Hacen envíos fuera de Ecuador?**
En la demostración los envíos se prueban con direcciones de Memphis, EE. UU., porque el sandbox de FedEx solo valida direcciones reales de ese país. En producción se confirma la cobertura con cada vendedor.

**¿Cuánto es el pedido mínimo?**
No hay monto mínimo. El precio mayorista aplica por producto, al llegar a su cantidad mínima.

**¿Cómo sé si un producto tiene stock?**
La ficha muestra el stock disponible. Si no hay, no se puede agregar al carrito.

**¿Puedo cancelar un pedido?**
Sí, mientras esté pendiente o procesando. Una vez enviado ya no se puede cancelar.

**¿Dónde veo mi guía de rastreo?**
En "Mis compras", dentro del detalle del pedido, después de que el vendedor lo despache.

**¿Qué hago si olvidé mi contraseña?**
Usa la opción de recuperar contraseña en la pantalla de inicio de sesión.

**¿Tienen tienda física?**
La sede está en Manta. Para retiros en persona se coordina previamente por WhatsApp.

## Preguntas de prueba para validar el RAG

Haz estas preguntas al asistente. La respuesta correcta debe salir de este documento y no estar inventada.

| Pregunta                                               | Respuesta esperada                                                                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Cuánto cuesta la resma de papel A4 al por mayor?      | 3.90 USD, desde 20 unidades                                                                                                                    |
| ¿Cuántos marcadores trae la caja?                      | 12                                                                                                                                             |
| ¿Cuál es el horario de atención?                       | Lunes a viernes de 08:00 a 18:00 y sábados de 09:00 a 13:00                                                                                    |
| ¿En cuántos días puedo devolver un producto?           | 7 días después de la entrega, si está sin abrir                                                                                                |
| ¿Qué empresa hace los envíos?                          | FedEx                                                                                                                                          |
| ¿Cuál es la cantidad mínima mayorista de la grapadora? | 12 unidades                                                                                                                                    |
| ¿Cuánto ahorra un colegio comprando 20 resmas?         | 12.00 USD (13,3 %)                                                                                                                             |
| ¿Aceptan transferencias bancarias?                     | No, solo tarjeta mediante Lemon Squeezy                                                                                                        |
| ¿Cómo pido factura si soy RIMPE?                       | Indicar nombre y cédula o RUC en el checkout, o escribir por WhatsApp con el número de pedido dentro de 7 días, y confirmar la categoría RIMPE |
| ¿Venden computadoras?                                  | No está en el documento; el asistente debe decir que no tiene esa información                                                                  |

La última pregunta comprueba que el asistente no inventa datos.
