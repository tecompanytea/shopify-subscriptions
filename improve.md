# Shopify Subscriptions Review Backlog

Last reviewed: March 7, 2026

Source set:
- Active reviews pulled from `https://apps.shopify.com/shopify-subscriptions/reviews` pages `1-54`
- Archived reviews also appear in the hidden block on page `54`

Notes:
- This file is a review-driven backlog, not a commitment list.
- Prioritize recurring pain with clear merchant or customer impact.

## Highest Priority

- [ ] Merchant contract list search and findability
  Problem: merchants repeatedly say they cannot quickly find contracts by customer, product, or contract ID.
  Why it matters: this creates daily admin friction and slows support workflows.
  Review signal: recurring in 1-star to 3-star reviews, with direct requests for search.

- [ ] Show next billing / renewal date directly in the contracts list
  Problem: merchants want to see what is renewing soon without opening contracts one by one.
  Why it matters: inventory planning, production planning, and support are all harder without this.
  Review signal: repeated requests for next order date, renewal date, or "what is coming up".

- [ ] Fix customer "manage subscription" entry points
  Problem: some reviews describe the customer-side manage link as confusing or broken.
  Why it matters: when customers cannot self-serve, merchant support load goes up immediately.
  Review signal: multiple low-rating reviews mention customer-side manage issues or unclear portal access.

- [ ] Improve failed payment recovery and expired card update UX
  Problem: merchants report that customers update cards but subscriptions still fail, or the retry path is unclear.
  Why it matters: this directly impacts retention and revenue recovery.
  Review signal: repeated complaints about expired cards, failed payments, and confusing update flows.

## Medium Priority

- [ ] Customer self-service for billing date changes and rescheduling
  Problem: customers cannot easily move or reschedule billing dates.
  Why it matters: merchants end up cancelling and recreating subscriptions manually.
  Review signal: one of the most common flexibility complaints.

- [ ] Customer self-service for product swaps, variant changes, and quantity changes
  Problem: customers cannot easily modify subscription contents.
  Why it matters: support teams handle work that customers expect to do themselves.
  Review signal: recurring requests for swaps, variant edits, and quantity adjustments.

- [ ] Frontend subscription widget customization and layout
  Problem: merchants want better control over widget placement, wording, and layout.
  Why it matters: poor presentation can lower conversion and create confusion.
  Review signal: recurring complaints about limited customization and awkward storefront placement.

- [ ] Address and delivery update reliability
  Problem: merchants report address or delivery changes not behaving as expected.
  Why it matters: this can cause fulfillment issues and customer frustration.
  Review signal: repeated complaints around shipping address and delivery updates.

- [ ] Better merchant visibility into subscription issues
  Problem: merchants want clearer visibility into failed payments, contract health, and operational issues.
  Why it matters: teams need to know what needs intervention without hunting through details.
  Review signal: repeated complaints about weak visibility and poor issue tracking.

## Lower Priority Or Larger Product Work

- [ ] Forecasting, reporting, and analytics
  Problem: merchants want forward-looking reporting for renewals, pickup, production, and cash flow.
  Why it matters: useful for larger merchants, but this is broader than a narrow UX fix.
  Review signal: frequent complaint, especially from more operationally complex stores.

- [ ] Pricing and discount controls
  Problem: merchants want more control over subscription pricing behavior and discount guardrails.
  Why it matters: affects margin protection and promotional abuse concerns.
  Review signal: recurring but less concentrated than search, self-service, and payment recovery.

- [ ] Import, export, and migration workflow quality
  Problem: merchants mention weak migration ergonomics, duplicate risk, and inconvenient export flow.
  Why it matters: high pain during setup and platform switching, but not as universal day-to-day.
  Review signal: concentrated in longer negative reviews from larger merchants.

- [ ] Broader API and platform capability gaps
  Problem: some complaints are really requests for more platform-level capability rather than a small app fix.
  Why it matters: these likely need product and API decisions, not just UI work.
  Review signal: shows up in reviews asking for deeper editability, richer APIs, and more automation hooks.

## Suggested Order Of Attack

- [ ] Phase 1: search, next billing visibility, and customer manage-link reliability
- [ ] Phase 2: payment recovery UX and customer self-service date changes
- [ ] Phase 3: product swaps, richer editing, reporting, and migration/API improvements

## Out Of Scope For A Small Patch

- Full reporting suite
- Full payment reauthorization redesign
- Complete subscription editor for cadence, contents, pricing, and shipping
- New platform or API capabilities that are not already exposed to this app
