# Real Workshop Operations — Design

## Objective

Evolve the existing owner-only Oficina SaaS into a production pilot for Paulinho Autocar while preserving the current customer, vehicle, service-order, inventory, finance, and retention data. The product remains a multi-tenant SaaS for workshops, but the first real operation is one owner-managed workshop with no employee login and no scheduling module.

The product must cover the complete operational chain: customer, vehicle, intake inspection, diagnosis, digital quote, approval, execution, parts, collaborators, payment, printable A4 work order, financial closing, next maintenance, and customer reactivation. The current WhatsApp Business number must be preserved.

## Product principles

- The owner is the only authenticated operator in this phase.
- Collaborators are operational and financial records, never login identities.
- Every business record belongs to a workshop and every server query derives the workshop from the authenticated owner.
- Money is stored as integer cents. Percentages are stored as basis points where practical.
- A closed work order keeps immutable financial snapshots; later configuration changes never rewrite history.
- External integrations fail gracefully and always retain a manual fallback.
- The interface favors fast daily operation over dense administration screens.
- The visual direction is “Premium clean”: warm light surfaces, black navigation, white typography, and restrained Paulinho Autocar red accents. The previous yellow accent is retired.

## Scope

### Included

- Owner authentication and multi-workshop tenant isolation.
- Workshop identity and operational settings.
- Customer CRUD, WhatsApp consent, address, document, and notes.
- Car and motorcycle records, including assisted lookup by plate.
- Sequential work-order numbers per workshop.
- Intake checklist, fuel, tire condition, odometer, vehicle damage map, and photos.
- Diagnosis, catalog services, parts, discounts, digital quote, approval, and status history.
- Several collaborators on the same labor item.
- Monthly fixed compensation, fixed amount per service, percentage commission, and hybrid compensation.
- Simple stock with reservation, consumption, adjustment, minimum-level alerts, and an audit trail.
- Split payments, installments, card fees, receivables, payables, recurrence, and attachments.
- Estimated tax reserve with workshop default and per-order override.
- Cash and accrual financial views.
- Official WhatsApp reminders with consent, templates, opt-out, and delivery history when coexistence is available.
- Manual WhatsApp fallback without changing the current number.
- A4 work-order printing based on the supplied paper model.
- One-way CSV export for Business Fin with duplicate-resistant identifiers.
- Current-month operational dashboard and filterable financial reporting.

### Explicitly deferred

- Employee logins, permissions, or time clock.
- Calendar, appointments, and customer self-booking.
- Electronic invoice issuance or accounting substitution.
- Bank reconciliation and direct Business Fin API integration until a documented partner API is available.
- Purchase orders, supplier catalog, inventory batches, and serial-number control.
- Automated SaaS subscription billing.

## Architecture

The application remains a modular Next.js App Router monolith deployed on Vercel. Neon Postgres and Better Auth remain the database and authentication layers. Drizzle remains the schema and migration layer.

The physical `service_records` table is retained for compatibility and evolves into the work-order aggregate. UI and domain naming use “ordem de serviço”; a destructive rename is not required for the pilot. New child tables normalize payments, inspections, collaborator assignments, status history, financial entries, and message delivery.

Server Components perform tenant-scoped reads. Validated Server Actions perform mutations. Critical work-order transitions run in database transactions. Integration clients sit behind small provider interfaces so plate lookup, WhatsApp, file storage, and Business Fin export can be replaced independently.

Photos and financial attachments move to object storage rather than growing the Postgres database as base64. Existing photos remain readable during migration. Vercel Blob is the default pilot choice because it fits the current hosting model.

## Main workflow

1. The owner creates or finds a customer.
2. The owner enters a plate. A provider lookup suggests vehicle data, which remains editable and must be confirmed before saving.
3. The owner opens a sequential OS and records intake data: odometer, fuel, tires, accessories, damage marks, and photos.
4. The owner records the complaint and diagnosis.
5. Catalog labor and inventory parts are added to a digital quote. The expected return date is calculated from the selected service interval and remains editable.
6. The customer approves or rejects the quote through a signed public link. The owner may also record an offline approval with its source and timestamp.
7. Approval reserves stock. Starting work consumes reserved parts. Cancellation releases unconsumed reservations.
8. One or more collaborators are assigned to each labor item. The system previews compensation without exposing it to the customer.
9. The order moves through `open`, `diagnosis`, `awaiting_approval`, `approved`, `in_progress`, `ready`, `delivered`, or `cancelled`. Every change records actor, timestamp, and optional note.
10. When ready, the customer receives an approved WhatsApp template or the owner uses the manual WhatsApp fallback.
11. One or more payments are recorded. Each payment snapshots method, installments, fee, gross value, and net value.
12. Delivery closes the OS, commits financial snapshots, creates commission and tax-reserve entries, confirms stock movements, and creates the next-maintenance opportunity.
13. The owner can print the A4 OS before or after closing and later export financial movements to Business Fin.

## Data model

### Workshop and configuration

`workshops` gains business identity used by the A4 document: trade name, legal name, document, phone, WhatsApp number, email, and address. Sensitive Wi-Fi credentials from the supplied paper example are intentionally excluded.

Configuration is split into dedicated records:

- `workshop_financial_settings`: default estimated tax percentage, cash-view default, and recognition rules.
- `payment_fee_rules`: payment method, installments, percentage fee, fixed fee, effective period, and active state.
- `workshop_integrations`: provider status and non-secret metadata. Secrets remain in Vercel environment variables.
- `workshop_sequences`: atomic next OS number per workshop.
- `message_templates`: approved purpose, locale, provider template identifier, and active state.

### Customers and vehicles

Customers gain address and optional CPF/CNPJ fields plus contact preferences, consent timestamp/source, and opt-out timestamp. Normalized phone and plate columns support reliable search and uniqueness.

Vehicles gain type (`car` or `motorcycle`), color, manufacture year, model year, fuel, engine displacement, power, municipality/UF, and masked chassis. Plate lookup provenance and lookup timestamp are stored so imported data is distinguishable from manual corrections.

### Work orders, inspection, and quotes

`service_records` remains the root work-order record and gains OS number, intake/delivery timestamps, financial close timestamp, subtotal snapshots, discount allocation, tax settings, and totals.

New supporting tables:

- `work_order_status_events`: append-only lifecycle history.
- `vehicle_inspections`: odometer, fuel level, tire condition, checklist snapshot, observations, and customer acknowledgment.
- `inspection_damage_marks`: vehicle view, normalized X/Y coordinates, damage type, and note.
- `work_order_items`: existing item table extended with cost snapshot, discount allocation, approval state, completion state, and stock-reservation state.
- `work_order_approvals`: quote version, decision, source, timestamp, public token identity, and optional customer note.
- `service_photos`: storage URL/key, kind, caption, content type, size, and ordering. New uploads stop using base64.

Every quote change after customer approval creates a new version and requires approval again when it increases price or materially changes scope.

### Collaborators and compensation

`collaborators` stores name, phone, active state, and compensation mode. A collaborator may have:

- monthly fixed amount;
- default labor commission percentage;
- fixed amount per completed service;
- any combination of those components for a hybrid model.

`collaborator_service_rates` overrides the collaborator’s variable rule for a catalog service. `work_order_item_assignments` links several collaborators to one labor item and stores participation percentage plus calculation snapshots.

Percentage commission is calculated only on discounted labor, never on parts, estimated tax, or card fees:

`commission = discounted labor item total × participation percentage × collaborator commission percentage`

Fixed-per-service compensation is added once per completed assignment. Monthly fixed compensation becomes a recurring payable and is not duplicated per OS. Hybrid compensation combines the applicable monthly and variable components. Total participation on a labor item cannot exceed 100%.

### Inventory

Inventory remains intentionally simple. Each item stores current quantity, reserved quantity, minimum quantity, cost, sale price, and active state. The movement ledger is authoritative.

- Quote approval reserves available stock.
- Starting work converts the reservation into consumption.
- Cancellation releases reservations that were not consumed.
- Manual entries and adjustments require a reason.
- Negative available stock is blocked unless the owner explicitly uses an audited adjustment.
- The OS stores cost and sale-price snapshots so later item-price changes do not rewrite profit history.

### Payments and finance

`work_order_payments` supports several payments per OS. Each record stores payment method, amount, installment count, paid/expected date, status, configured fee snapshot, manual fee override, fee amount, and net amount.

`financial_entries` provides a unified auditable ledger for:

- customer receivables;
- supplier and operating payables;
- rent, utilities, payroll, tax, and other categories;
- commission liabilities;
- estimated tax reserves;
- card fees;
- recurring entries and their generated occurrences;
- optional attachment storage keys.

The cash view recognizes money on actual receipt/payment dates and is the default daily view. The accrual view recognizes work-order revenue on delivery and expenses in their configured competence period.

The estimated tax base is the gross amount actually received after commercial discounts and before card fees. The workshop default percentage is editable per OS before closing. Partial receipts create proportional tax-reserve movements. Closing the OS stores the final percentage, base, and reserve amount. This is an operational estimate, not a tax calculation or fiscal document.

Financial closing is transactional: totals, inventory, payment snapshots, commissions, tax reserve, and ledger entries either complete together or do not complete at all. Reopening a closed OS requires an explicit reversal event; historical rows are not silently edited.

## Integrations

### Plate lookup

The pilot uses a provider adapter with FipePlaca as the recommended implementation. Only the basic vehicle route is needed. Results populate make, model, years, color, fuel, location, engine details, and masked chassis. The API token is server-only. Results are cached per plate for a limited period, lookup errors never block manual registration, and the user must confirm the returned vehicle before saving.

The adapter allows later migration to the official SENATRAN/SERPRO service if the business completes its authorization and contract.

### WhatsApp

The current WhatsApp Business number is preserved. Automated sending is enabled only after the number is confirmed eligible for official WhatsApp Business Platform coexistence. The pilot must not migrate, disconnect, or replace the number as part of deployment.

Messages use explicit customer consent, approved templates outside the 24-hour service window, quiet hours, opt-out handling, idempotency keys, cooldowns, and delivery history. Initial automated events are:

- vehicle ready;
- maintenance due in 7 days;
- maintenance due today;
- maintenance overdue by 14 days.

After the three maintenance contacts, the system stops automatic reminders and leaves the customer available for a manually reviewed campaign. A daily secured Vercel Cron job fills an outbox; webhook callbacks update delivery status. Until coexistence and templates are configured, the same screens offer a prefilled `wa.me` action and record manual contact.

### Business Fin

The pilot exports a one-way CSV because no public partner API was identified. Each row includes a stable Oficina external ID, date, description, category, direction, gross amount, fees, net amount, status, and OS reference. Export history prevents the same movement from being selected twice by default, while still allowing an intentional re-export.

The exporter is isolated behind a mapping module so a Business Fin sample template or future partner API can be adopted without changing the financial domain.

## A4 work-order document

The supplied paper model is a structural reference, not a source of live customer data. The new print view uses the Paulinho Autocar logo and the Premium clean visual system while remaining economical in black-and-white printing.

The A4 document contains:

- workshop identity and sequential OS number;
- customer contact and optional document/address;
- vehicle data, masked chassis, plate, odometer, and intake date;
- accessories checklist, fuel, tire condition, and observations;
- car or motorcycle damage map with digital marks;
- intake/diagnosis/completion photo references;
- complaint, diagnosis, labor, parts, discounts, and totals;
- payment summary, warranty, configurable terms, and signatures.

No Wi-Fi password is printed. Terms are workshop settings rather than hard-coded text. Print CSS targets one A4 page when content fits and adds controlled continuation pages when item lists or photos exceed the first page.

## Interface

Navigation is reorganized around the owner’s daily work:

- Visão geral
- Ordens de serviço
- Clientes e veículos
- Serviços
- Estoque
- Colaboradores
- Financeiro
- Retenção
- Configurações

The dashboard shows the current month by default, with compact cards for open orders, ready vehicles, receipts, expected receivables, low stock, upcoming returns, and today’s actions. Financial screens provide independent period, status, category, payment-method, collaborator, and free-text filters.

Forms use progressive disclosure: the common path stays short, while tax overrides, fee overrides, detailed vehicle fields, and advanced compensation appear only when needed. Tables become compact cards on mobile. Red is reserved for primary actions and important states, not for large background areas. Status colors retain semantic meaning and accessible contrast.

## Security, privacy, and reliability

- All reads and writes are scoped by the server-resolved workshop ID.
- Public quote links use high-entropy tokens, limited data exposure, expiry, and revocation.
- Provider secrets, webhook secrets, and cron secrets remain server-side environment variables.
- Customer phone, document, vehicle plate, and message contents are never written to application logs.
- Uploaded files are validated by content type and size and served through controlled URLs.
- Financial mutations, work-order transitions, stock consumption, exports, and WhatsApp sends use idempotency protection.
- Failed external calls are retryable without duplicating messages or ledger entries.
- Audit events record financial overrides, reopening, manual stock adjustments, consent changes, and offline approvals.
- Database migrations are additive first, backfilled, verified, and only then made strict. Existing production data is never dropped.

## Error handling

- Plate-provider failure keeps all vehicle fields editable and explains that manual registration is available.
- Insufficient stock identifies the exact item and available quantity without partially starting the OS.
- A failed financial close rolls back the complete close operation.
- A WhatsApp failure remains visible in the outbox with a safe retry or manual-send option.
- A rejected or expired public quote cannot be reused after a newer quote version exists.
- Print rendering omits unavailable optional fields instead of showing empty labels.
- Validation errors preserve entered form data and focus the first invalid field.

## Testing and acceptance

Unit tests cover commission modes, multi-collaborator participation, discount allocation, card fees, split payments, tax reserve, cash/accrual recognition, inventory reservation, reminder eligibility, and OS totals.

Database integration tests cover tenant isolation, sequential OS numbering, approval/version behavior, stock transitions, atomic closing, reversal behavior, recurrence generation, and idempotency keys.

End-to-end tests cover:

1. customer and vehicle creation with successful and failed plate lookup;
2. intake inspection with damage marks and photos;
3. quote creation, public approval, execution, ready notification, split payment, and delivery;
4. A4 print output for car and motorcycle;
5. collaborator compensation and financial reporting;
6. Business Fin CSV export without duplicates;
7. manual WhatsApp fallback and automated outbox dry-run.

Release requires passing unit tests, type checking, production build, migration generation, migration against a disposable database, and a production smoke test of login, dashboard, OS creation, public quote, print view, and finance filters.

## Delivery sequence

Implementation is incremental on the current application:

1. Additive schema and migration safety layer.
2. Premium clean design system, navigation, customer/vehicle improvements, and logo.
3. Work-order workflow, inspection, damage map, photos, versioned quote, and A4 printing.
4. Collaborators, compensation engine, stock reservation, payments, and transactional closing.
5. Complete financial ledger, reports, recurrence, attachments, and Business Fin export.
6. Plate lookup adapter and manual fallback.
7. WhatsApp coexistence integration, outbox, webhook, reminders, and manual fallback.
8. Full regression testing, data migration verification, Vercel production deployment, and smoke testing.

External account setup does not block the internal workflow: plate lookup and automated WhatsApp remain disabled behind clear configuration states until their tokens and approvals are supplied.

## Final configuration dependencies

The deployed product will require these operator-provided items where applicable:

- confirmed Paulinho Autocar business address, document, phone, email, and printable terms;
- Vercel Blob storage connection;
- FipePlaca account, prepaid balance, and API token;
- Meta Business verification, WhatsApp Business Platform coexistence eligibility, permanent access token, phone-number ID, business-account ID, webhook secret, and approved templates;
- Business Fin CSV import sample if its required column mapping differs from the generic export;
- default estimated tax percentage confirmed by the workshop’s accountant;
- card-fee rules by payment method and installment count;
- collaborator compensation configurations and opening finance balances.
