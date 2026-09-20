# Owner CRM and Inventory — Design

## Objective

Turn the current single-browser workshop dashboard into a focused SaaS for workshop owners. The owner records customers, vehicles, completed services, and simple inventory movements so the product can forecast returns and surface customers worth reactivating through assisted WhatsApp outreach.

The first production phase validates the workflow with invited workshop owners. It is tenant-ready from day one, but intentionally excludes staff management, scheduling, automated messaging, and billing.

## Product scope

### Included

- Owner-only authentication by invitation.
- First-login workshop setup.
- Customer and vehicle records.
- Completed-service history with value, date, notes, and expected return date.
- Return forecast and overdue/inactive customer segments.
- Assisted WhatsApp outreach with a generated message and contact log.
- Simple inventory with SKU, cost, sale price, current quantity, and minimum quantity.
- Stock entries, adjustments, and consumption linked to a service.
- Dashboard metrics derived from persisted workshop data.
- CSV export and a migration path away from the existing browser-only state.

### Excluded from this phase

- Employees, roles, commissions, or time tracking.
- Calendar, appointment booking, or service workflow status.
- Automatic WhatsApp sending or Meta API integration.
- Public self-registration, Stripe, plans, or automated subscription enforcement.
- Suppliers, purchase orders, batches, serial numbers, and fiscal documents.
- Native mobile applications or offline synchronization.

## Architecture

The application remains a modular Next.js monolith deployed on Vercel.

- **Runtime:** Next.js App Router and React.
- **Database:** Neon Postgres.
- **Authentication:** Neon Auth, owner-only in this phase.
- **Database access:** Drizzle ORM through the Neon serverless driver.
- **Mutations:** validated Server Actions.
- **Reads:** authenticated Server Components and narrowly scoped query modules.
- **Tenant boundary:** the server derives the authenticated owner's workshop and applies its `workshop_id` to every business query. The browser never chooses a tenant identifier.

This keeps deployment and operations simple while preserving clean boundaries between authentication, data access, business rules, and presentation.

## Domain model

### Workshops

`workshops` stores the workshop name, owner authentication ID, inactivity threshold, locale, timestamps, and lifecycle status. The initial relationship is one owner to one workshop. A future `memberships` table can add staff without changing business-table ownership.

### Customers and vehicles

`customers` belongs to a workshop and stores contact information, WhatsApp consent, notes, and timestamps. `vehicles` belongs to both a workshop and customer and stores plate, make, model, year, and optional odometer. Cross-workshop foreign-key relationships are prohibited by service-layer checks and indexed tenant keys.

### Service records

`service_records` represents completed work, not an appointment or work order. It stores workshop, customer, optional vehicle, description, completion date, amount in integer cents, optional odometer, notes, return interval in days, and calculated `next_due_at`.

Forecasting uses the explicit `next_due_at` when present. Otherwise it applies the service's return interval. A customer is:

- **upcoming** when the next return date is within 30 days;
- **overdue** when the return date has passed;
- **inactive** when there is no future return date and the latest completed service is older than the workshop inactivity threshold, initially 180 days.

The forecast is deterministic and explainable; no machine-learning model is introduced in the MVP.

### Inventory

`inventory_items` stores SKU, name, unit, cost cents, sale price cents, current quantity, minimum quantity, active state, and timestamps.

`inventory_movements` is the audit trail. Its signed integer quantity records entry, consumption, or adjustment and may reference a service record. A database transaction creates a movement and updates the item's current quantity together. Consumption cannot make stock negative. Low stock means current quantity is less than or equal to the minimum quantity.

### Outreach

The application derives campaign opportunities from overdue and inactive customers. The owner selects a customer, reviews an editable message, and opens a `wa.me` URL. `contact_events` records the customer, channel, message, reason, and timestamp only after the owner confirms the assisted action in the product. No message is sent by the server.

## Main flows

### First access

1. An owner is invited through Neon Auth.
2. The owner signs in.
3. If no workshop exists for the authenticated ID, the setup screen collects the workshop name and inactivity threshold.
4. The owner reaches an empty dashboard with calls to add a customer, record a service, or add inventory.

### Record a completed service

1. The owner selects or creates a customer and vehicle.
2. The owner records service description, date, amount, and expected return interval.
3. Optional inventory items and quantities are added.
4. One transaction creates the service, creates stock movements, and updates balances.
5. Dashboard, forecast, customer history, and inventory reflect the result.

### Recover an inactive customer

1. The system lists upcoming, overdue, and inactive customers with the reason for each classification.
2. The owner opens a customer opportunity.
3. The product generates an editable WhatsApp message using the customer, vehicle, latest service, and workshop name.
4. The browser opens WhatsApp for manual sending.
5. The owner marks the contact as made, creating a contact event.

## Interface

The black, yellow, and white visual system and existing logo remain. Navigation is reduced to:

- Visão geral
- Clientes
- Serviços
- Retenção
- Estoque
- Configurações

Agenda, service-order statuses, employee settings, and billing UI are removed. Desktop and mobile navigation expose the same modules. Empty states lead directly to the next useful action.

## Security and privacy

- Every mutation authenticates the owner on the server.
- Every business query is scoped by the server-resolved workshop ID.
- Input is validated before persistence.
- Currency uses integer cents; dates are stored as timestamps.
- Phone and email are treated as personal data and are never written to logs.
- WhatsApp contact requires an explicit consent field on the customer.
- Secrets remain in Vercel environment variables and never enter the repository.
- Production and preview use separate Neon branches and authentication endpoints when available.

## Error handling

- Validation errors return field-level messages without losing form input.
- Database and authentication failures show a retryable, user-safe error.
- Stock conflicts reject the complete service transaction; partial inventory updates are not allowed.
- WhatsApp links are disabled when the customer lacks a valid phone number or consent.
- Empty and loading states remain usable and do not display seed data as real records.

## Migration and compatibility

The existing `localStorage` state is no longer the production source of truth. A one-time client-side import can read compatible local customer/service data and submit it through authenticated server actions after workshop setup. Seed data remains available only to tests and development fixtures.

The deployment must build without live database access; database connections are created lazily at request time. Production data features require the Neon and Neon Auth environment variables.

## Testing and release criteria

- Unit tests cover forecasting, segmentation, money conversion, message generation, stock rules, and tenant scoping helpers.
- Database integration tests cover service-plus-stock transactions and cross-workshop isolation when a test database is available.
- Component tests cover the reduced navigation and critical empty states.
- Type checking, production build, dependency audit, and migration generation must pass.
- Vercel production must report `Ready` for the exact released commit.
- A live smoke test must verify sign-in routing, public metadata, and the production dashboard shell.

## Deferred phases

1. Public registration and Stripe subscriptions.
2. Automated WhatsApp templates and delivery tracking.
3. Staff memberships and roles.
4. Calendar and appointment scheduling.
5. Supplier purchasing and advanced inventory.
