# Workshop Operations Hardening Design

## Goal

Make the Paulinho Autocar pilot reliable on Cloudflare's free Worker limits and complete the next operational layer requested by the workshop without introducing employee accounts or unsafe automatic customer contact.

## Product decisions

- Large customer, vehicle, and work-order collections are searched and paginated in PostgreSQL. Default pages render at most 24 rows/cards.
- The customer list owns customer registration; vehicle registration remains on the vehicle page so large customer option lists are not duplicated.
- Automatic WhatsApp sending remains conditional on documented consent, an active official provider, and an approved template. Without those, the app opens a prefilled WhatsApp conversation in a new tab.
- Existing customer records are never marked as consented merely in bulk. A bulk action may only record consent when the workshop confirms it already collected that consent, and stores the source and timestamp.
- Oil-change recall uses the most recent oil-change odometer plus the customer's observed oil-change cadence when at least two comparable services exist. The next reminder is the earlier of the learned mileage estimate and the six-month default, never a claim that a vehicle's live mileage is known.
- Payment fee rules are configured by payment method and installment count. “Pagamento recebido” controls cash-basis recognition and remains explicit.
- Financial categories are workshop-managed, but system categories used by automatic entries cannot be deleted; they may be renamed for display or deactivated for manual use.
- Invoice stock intake starts with Brazilian NF-e XML, which contains structured product data. A review screen is mandatory before inventory changes. Photograph/PDF OCR is a later optional integration because it adds cost and lower confidence.
- The mechanic page does not create employee accounts. It uses a workshop-device mode with a short-lived signed link or owner-authenticated shared device and exposes only execution fields, photos, mileage, damage map, and status updates.

## Delivery slices

1. Reliability and compact lists: fix Error 1102, server-side search/pagination, compact cards, smaller OS typography, remove lookup price copy.
2. Team and finance controls: remuneration CRUD and explanation, commission payable report, category CRUD/defaults, fee-rule CRUD per installments, clearer payment receipt semantics, reusable numeric inputs.
3. Customer communication: OS WhatsApp share, deduplicated ready notification, in-app approval alert, service-aware retention and oil-change cadence, safe consent confirmation.
4. Workshop intake: seeded automotive service catalog, NF-e XML stock review/import, improved damage map, mechanic execution page.

## Acceptance

- `/clientes`, `/veiculos`, and `/ordens` never load the whole imported base for a normal list view.
- The exact Cloudflare incident route completes without `exceededCpu` in a deployment smoke pass.
- Search preserves pagination and empty-state behavior.
- All mutations enforce workshop ownership and preserve historical financial snapshots.
- External messages are never sent without consent and configured provider credentials.
- Stock is not changed before an explicit invoice review confirmation.

