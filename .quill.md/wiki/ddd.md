---
id: b71d2270-1b73-49ce-9880-5f7da1fe84c7
immutable: false
integrity_hash: "sha256:d42a064bb98ccbe2453efec3da644508dad44d258475ecdc8f64a796fab820c2"
---

# Programming Features Structure (Vertical Slicing / DDD)

Based on the project's architecture (Modular Monolith, Hexagonal Architecture, and Vertical Slicing) and the `.quill.md` requirements, this is the exact technical breakdown of the **features (domains / bounded contexts)** that you need to physically program inside the `packages/core/src/features/` directory. These core use cases will then be consumed by your Next.js application.

---

## 1. Feature: `products`
**Goal:** Centralized management of the inventory and catalog.
**Main Entities:** `Product`
**What you need to program (Use Cases):**
- `CreateProduct` / `UpdateProduct` / `DeleteProduct` (Basic CRUD)
- `UpdateProductStock` (Manual stock adjustments or post-purchase reductions)
- `UpdateProductPricing` (Configuration of wholesale tiered pricing)
- `SearchProducts` (Real-time text search with debounce support)
- `FilterProductsByCategory` (For catalog exploration)

## 2. Feature: `categories`
**Goal:** Hierarchical or flat classification of the inventory.
**Main Entities:** `Category`
**What you need to program (Use Cases):**
- `CreateCategory` / `UpdateCategory` / `DeleteCategory`
- `ListCategories` (To render dynamic filters in the frontend)

## 3. Feature: `cart`
**Goal:** Temporary consolidation of a customer's purchase intent.
**Main Entities:** `Cart`, `CartItem`
**What you need to program (Use Cases):**
- `AddItemToCart` / `RemoveItemFromCart`
- `UpdateItemQuantity`
- `CalculateCartTotals` (Strict business logic applying tiered pricing based on product quantities)
- `ClearCart`

## 4. Feature: `orders`
**Goal:** The lifecycle of the commercial and logistical transaction.
**Main Entities:** `Order`, `OrderItem`
**What you need to program (Use Cases):**
- `CreateOrderFromCart` (Validates available stock and transforms the cart into a `PENDING` order)
- `UpdateOrderStatus` (Handles state transitions: `CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED`)
- `CancelOrder` (For buyers or sellers)
- `GetOrderById` (To track order status)
- `ListCustomerOrders` / `ListAllOrders`

## 5. Feature: `payments`
**Goal:** Integration and reconciliation with Lemon Squeezy.
**Main Entities:** `PaymentTransaction` (or delegate state directly to `Order`)
**What you need to program (Use Cases):**
- `GeneratePaymentLink` (Communicates with Lemon Squeezy to generate the checkout session)
- `ProcessPaymentWebhook` (**Critical logic:** Validates the HMAC-SHA256 signature, ensures idempotency, and triggers `UpdateOrderStatus` to mark the order as paid).

## 6. Feature: `users` / `roles` (Access & Permissions Control)
**Goal:** Identity, Authentication, and Authorization (RBAC).
**Main Entities:** `User`, `Role`, `Permission`
**What you need to program (Use Cases):**
- `AssignRoleToUser`
- `GrantPermission` / `RevokePermission` (To manage the 14 discrete permissions mentioned in the documentation)
- `UpdateUserProfile`
- `CheckUserPermission` (To protect Next.js Server Actions)

## 7. Feature: `customers`
**Goal:** Extend the generic user entity with specific commercial data.
**Main Entities:** `Customer`
**What you need to program (Use Cases):**
- `RegisterCustomer` / `UpdateCustomerDetails`
- `GetCustomerDetails` (Billing details, Tax ID / RUC, shipping address)

## 8. Feature: `notifications`
**Goal:** Asynchronous communication via WhatsApp Cloud API.
**Main Entities:** `NotificationTemplate`, `Message`
**What you need to program (Use Cases):**
- `ConfigureWhatsAppTokens`
- `SendOrderConfirmation` (Triggered asynchronously when a payment is successful)
- `SendOrderStatusUpdate`
- `ProcessIncomingMessage` (The Meta webhook that responds to `!pedido` or `!factura` self-service commands)

## 9. Feature: `analytics`
**Goal:** Reporting and Business Intelligence KPIs.
**What you need to program (Use Cases):**
- `GetSalesKPIs` (Revenue, inventory turnover)
- `GetTopSellingProducts`
- `GetOrderMetrics`

---

### Summary
Your `packages/core/src/features/` folder structure should look exactly like this:
- `/products`
- `/categories`
- `/cart`
- `/orders`
- `/payments`
- `/users`
- `/customers`
- `/notifications`
- `/analytics`

Following the Hexagonal Architecture, each of these feature folders must contain its own internal layers: `domain/` (entities, exceptions, value objects), `application/` (use-cases, out-ports), and `infrastructure/` (adapters like `SupabaseProductRepository`, `LemonSqueezyPaymentService`).
