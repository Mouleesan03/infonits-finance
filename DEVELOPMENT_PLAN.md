# Infonits Finance — Version 1 implementation plan

## Accounting model

All monetary storage uses PostgreSQL NUMERIC(18,2), with NUMERIC(18,8) historical exchange rates. Application calculations use decimal arithmetic, not JavaScript floating-point arithmetic. Each currency amount keeps its original amount, currency, rate, and recorded LKR equivalent. Supported currencies: LKR, USD, GBP, EUR, AUD, CAD.

- Project value: agreed contract amount converted at its recorded contract rate.
- Received: sum of client payment settlements; advances are ordinary payments.
- LKR reporting outstanding: contract LKR value less actual client settlements received, following the requested formula. Also show original-currency balance (contract amount less payments allocated in the contract currency). Where settlement rates differ, explicitly label any FX difference; do not present the LKR reporting difference as an additional original-currency invoice amount.
- Expected profit / For Me: contract LKR value less all planned and committed direct cost LKR values. Never subtract advances or cost payments again.
- Unpaid direct costs: cost obligations less allocations of cost payments, at the cost's recorded rate.
- Margin: expected profit divided by contract value; undefined for zero-value projects.
- Net expected company profit: project profit attributed to the reporting period less operating expenses incurred in the same period.
- Cash flow: actual settlements received less actual cost settlements and operating cash paid during the selected dates. It is not expected profit or bank balance.

The implementation must explicitly explain the foreign-currency outstanding distinction. Different settlement rates require separate currency allocation and FX reporting. Payment entry includes the amount applied to the original contract when the payment currency differs.

## Relational model and migrations

1. Create profiles, clients, projects, client_payments, project_costs, project_cost_payments, operating_expenses, exchange_rates, and audit_logs with UUID primary keys and timestamps.
2. Give every financial row an organization ID. Version 1 has a single organization; membership is provisioned by an administrator, never chosen by a browser.
3. Record contract reporting month on projects. Record transaction date on each payment, incurred date on each cost/operating expense, and cash paid date separately.
4. Use restrictive foreign keys: deleting a client/project with dependent financial records must fail rather than silently erase history.
5. Enable RLS on every table. Only active, provisioned profiles may read/write their organization's rows. Administrators require MFA AAL2. Profile roles and organization membership cannot be changed by ordinary authenticated clients.
6. Add immutable audit triggers, timestamps, cross-organization reference checks, exact numeric summary views with security_invoker, and transactional CSV import.
7. Add database tests for anonymous/unprovisioned access, admin MFA enforcement, organization isolation, financial aggregates, constraints, updates and deletions.

## Interfaces

Poppins typography and branding reviewed against https://infonits.io/. Use restrained white/neutral surfaces with an Infonits brand accent, a simple sidebar, accessible contrast, and clear financial labels.

- Dashboard: five separate accounting cards, period selector, actual cash flow, monthly chart, recent payments, outstanding clients, and low/negative-margin projects.
- Projects: searchable, sortable TanStack table, inline edits, currency/status filters, column visibility, totals and CSV actions. Mobile uses cards with the same actions.
- Project details: contract, payments, costs and cost settlements; show expected profit independently from outstanding and cash.
- Clients: contact details and associated project/payment/profit summaries.
- Payments, project costs, operating expenses: validated CRUD forms, historical conversion inputs and visible audit-relevant dates.
- Settings: account/security, MFA enrollment/verification, recorded exchange rates, and setup status.
- Login: invitation-only Supabase authentication, no public signup, secure invite callback.

## Migration review

Do not import financial data from the screenshot automatically. Preserve uploaded CSV source rows in the import audit record. Require explicit mapping and review before a transactional import.

Unresolved legacy questions:

1. Does “Paid for work (A)” represent payments against “Pay for work”, or an additional project cost?
2. Are the displayed “Pay for work” amounts full committed obligations or only remaining balances?
3. Which original currency and historical rate apply where USD and LKR columns disagree (notably Akie Services), or where LKR is blank?
4. Which dates and clients apply to advances and cost payments?

Never import the legacy “For Me” formula as authoritative: it appears to subtract advances. Recompute profit from reviewed contract and cost data.

## Verification and release

Unit tests cover decimal conversion/rounding, partial and multiple payments, multiple unpaid costs, negative profit, FX settlement differences, period boundaries and totals. Database integration tests exercise RLS and transactional mutations. Production build and TypeScript checks must pass. Verify desktop/mobile flows against real Supabase storage once provisioned.

Production prerequisites: linked Supabase and Vercel projects, public Supabase URL/key in environment, migrations applied, public signups disabled, invited administrator profile, MFA enrolled, redirect URL allowlist and a tested backup/restore procedure. No service-role credential is needed in the application. Do not claim a live deployment or persistence test until these checks run.
