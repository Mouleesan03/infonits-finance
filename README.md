# Infonits Finance

A private finance workspace built with Next.js App Router, TypeScript, Tailwind CSS, shadcn-style Radix UI primitives, TanStack Table, Supabase, Zod, React Hook Form and Lucide. Typography is locally hosted Poppins; the logo and palette reference [Infonits](https://infonits.io/).

## Current state

The full application source, SQL migration, RLS policies, audit triggers, financial tests, PostgreSQL integration tests and Vercel configuration are included. Supabase and Vercel are deliberately **not connected or deployed**, as requested. With environment variables absent, the app provides an explicitly labeled empty setup workspace. There are no demo customers, fabricated balances, localStorage financial records, or mock persistence fallbacks. Saving/importing is disabled until configured.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended for Vercel) and npm.

```sh
npm ci
cp .env.example .env.local
# Set the two public Supabase connection values when ready.
npm run dev
```

Open http://127.0.0.1:3000. You can inspect the setup workspace before connecting Supabase. If your environment blocks Turbopack workers, use `npm run dev -- --webpack` and `npm run build -- --webpack`.

```sh
npm test                 # Financial, validation, CSV, PostgreSQL and RLS checks
npm run test:db          # Embedded PostgreSQL integration checks only
npm run typecheck
npm run build
npm start
```

## Connect Supabase

1. Create a Supabase project (PostgreSQL 15 or later). Use separate projects for production and development/preview.
2. Run `supabase/migrations/202610080001_finance.sql` once in the Supabase SQL Editor on a fresh project. Alternatively, use the Supabase CLI: `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, then `supabase db push`. Do not reset an existing database. Review the migration before applying it to any existing schema.
3. Copy **Project URL** and the public **anon** key from Project Settings → API into `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   ```

   No service-role key is used anywhere in the app. Keep database credentials and administrative keys out of browser code and Git.

4. In Authentication settings, **disable public signup** and enable TOTP MFA. Add the production site URL and exact local/production redirect URLs to the allowlist.
5. Configure the **Invite user** email template link as:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite"
     >Accept invitation</a
   >
   ```

   For the **Reset password** template use the same URL with `type=recovery`. The app verifies the token server-side, establishes a session, then opens `/auth/complete` to set a password. Use Supabase's administrator console to send invitations or recovery messages. There is no public signup endpoint.

6. Invite the owner through the Supabase Authentication console. Copy that user's UUID, then provision the profile using the SQL Editor (replace the placeholder):

   ```sql
   insert into public.profiles (id, name, role)
   values ('REPLACE_WITH_AUTH_USER_UUID', 'Infonits administrator', 'admin');
   ```

   The default organization UUID is `11111111-1111-4111-8111-111111111111`. Version 1 uses this one organization. Future organizations can provision profiles with a different UUID; all financial foreign keys enforce organization consistency. No client-side membership or role editing is allowed.

7. Accept the invitation, set a password (minimum 12 characters), and enroll an authenticator. Administrators need an AAL2 session before either the server or database exposes financial records. Ordinary provisioned `editor` accounts can read and edit company finances at AAL1; assign this role only to trusted finance staff.
8. Restart the app. Add a client → add a project → record payments and costs. Data is persisted in Supabase and all summaries are derived from the database financial view.

To revoke access, set the user's profile `active = false` through the administrator console/SQL Editor. RLS checks active membership on every query; an existing session is insufficient to retain access. Keep at least one recovery administrator and follow Supabase's MFA recovery procedure if an owner loses their authenticator.

## Financial rules

- **For Me / expected project profit = recorded LKR contract value − all planned and committed direct project costs.** Client advances do not reduce profit. Paying a cost does not deduct it a second time.
- **LKR reporting outstanding = recorded LKR project value − actual LKR receipts.** Negative values are retained rather than silently clamped.
- **Original currency remaining = original contract amount − payments allocated in the contract currency.** Payment status follows this original-currency balance. Different settlement rates can leave an LKR reporting difference after the original contract is fully paid; the detail screen labels the FX difference explicitly.
- **Margin = expected profit / contract value × 100**, or “Not applicable” for zero-value contracts.
- **Unpaid cost obligations** use allocated payments in each cost's original currency, converted at that cost's stored rate. Cash settlements retain their own rate and actual LKR amount.
- **Net expected company profit = expected project profit for the reporting period − operating expenses incurred in that period.** This is a management projection, not statutory revenue recognition.
- **Net cash flow = actual client receipts − actual cost payments − operating cash paid during the selected dates.** It is period movement, not an opening/closing bank balance. All-time project cash movement is shown separately in project details.
- Amounts use PostgreSQL `NUMERIC(18,2)` and rates use `NUMERIC(18,8)`. Database response selections cast monetary fields to text. Decimal.js performs all application financial arithmetic; chart heights alone convert to numbers for plotting.
- Settlements may override the LKR amount calculated from their rate. The actual LKR settlement is authoritative. Store an explanation in notes for deviations/rounding.
- Contract, cost, and payment rates are historical. The Settings exchange-rate registry is a reference log; changing a reference rate does not rewrite transactions.
- Direct costs belong to projects; general operating expenses do not. All direct costs, including planned estimates, are included in expected profit. Cancelled projects remain financial records; change their values/costs explicitly when reversing obligations.

### Dates and period selection

The application uses Asia/Colombo for the default current date and display of audit timestamps. A project's reporting month is explicitly assigned (first day of the month). Project cards, value/cost/profit totals and the monthly chart use that month. Received and outstanding values on those cards are **all-time balances of the selected projects**, not cash received during that month. The separate cash-flow card and recent payments use actual transaction dates. Operating expenses use incurred dates for projected profit and `paid_on` for cash flow. No historic month-end “as of” reconstruction is implied by the month selector.

### Fees, partial payments, and corrections

Record processing/conversion fees as identifiable project costs with category `Processing fees` or `Conversion fees`. If a fee was withheld from a client transfer, record **net** LKR received, then settle the fee cost with **“Fee withheld from a client settlement”** checked. This marks the obligation paid while avoiding a second deduction from actual cash flow. If paid separately, leave that checkbox unchecked and record the cash payment normally. Explain the original-currency allocation and settlement difference in notes.

Client payment allocations cannot exceed the original contract value. Increase the contract first for additional agreed work. Cost payment allocations cannot exceed the original cost obligation. To correct an error, edit/delete the incorrect settlement; an immutable audit row retains before/after values. Obligations cannot be reduced below amounts already allocated, and currency cannot change while payments exist. Parent deletion is blocked while dependent financial records exist.

Operating expenses support unpaid, partially paid or paid amounts and one cash date **per expense entry**. Split an operating bill into separate entries for installments paid on different dates, including a separate unpaid remainder, rather than overwriting a cumulative cash amount across months.

## CSV migration

Projects → Import supports UTF-8 CSVs up to 2 MB and 500 rows. Download the blank template or map spreadsheet column names manually. Create clients first. Client name matching must resolve to one existing client, or choose one default client for the batch. Review every row and explicitly confirm before import.

The import is a single PostgreSQL transaction: any invalid/duplicate row rolls back the entire batch. A SHA-256 fingerprint detects repeated source rows. Original parsed CSV fields (including unmapped legacy amounts) are retained in `projects.source_record` and the insertion audit; retain the original source file separately for byte-for-byte archival.

**Legacy payments and costs are not imported automatically.** Before migrating them, resolve:

- Is “Paid for work (A)” a payment against “Pay for work”, or an additional expense?
- Is “Pay for work” the full obligation or its remaining unpaid amount?
- What are the original currencies, historical rates, clients, and transaction dates?
- Which amount is authoritative where the USD and LKR columns disagree or LKR is blank?

Never map an advance or the legacy “For Me” value into profit. The screenshot appears to subtract advances from “For Me”; this app computes the corrected formula from reviewed contracts and costs. Project CSV exports neutralize spreadsheet formula injection.

## Vercel deployment

`vercel.json` configures Next.js with Singapore (`sin1`) as the preferred function region. Connect this directory to a new Vercel project, install from the committed npm lockfile, and use Node 24. Add both Supabase public environment variables to the intended environment, update Supabase's Site URL/redirect allowlist, and deploy. Preview deployments must use a separate nonproduction Supabase project. Run build and tests before promoting production.

This development session did not create a Vercel project, provision a Supabase instance, send invitations, or deploy the app.

## Security and operations

- All financial tables and audit logs have RLS. Membership is checked server-side and in the database. Admin MFA is also enforced in RLS, so calling Supabase directly cannot bypass it.
- Composite foreign keys prevent cross-organization references. Views use `security_invoker`; aggregate child relations separately to avoid multiplying payment/cost totals.
- Default table privileges are revoked before exact SELECT/INSERT/UPDATE/DELETE grants. Authenticated users cannot truncate tables, write profiles, or alter/delete audit rows.
- API routes whitelist tables and Zod-validate fields; generated balances are never accepted from the browser. Same-origin checks and Next/Supabase cookie handling protect browser mutations. RLS remains the authorization boundary for direct database API requests.
- Edits/deletions compare `updated_at` to detect stale versions. Payment/allocation triggers lock the obligation and enforce allocation limits; mutations and audit rows commit together. Database constraints also validate direct API requests.
- No financial data is stored in localStorage or seeded into the live application. Financial responses use private/no-store headers. Poppins and the logo are served locally.
- See [Backup and restore](docs/BACKUP_RESTORE.md) and [Verification](docs/VERIFICATION.md) before launch.

## Source map

- `app/` — App Router pages, invitation callback, authorized mutation/import endpoints.
- `components/` — Finance sheet, client/detail views, forms, authentication, import review and settings.
- `components/ui/` — Reusable shadcn-style Button and Radix Dialog primitives.
- `lib/` — Decimal finance helpers, Zod schemas, CSV parsing, Supabase session clients and server data loading.
- `supabase/migrations/` — Schema, constraints, RLS, immutable audit history, exact summary view, transactional import.
- `tests/` — Financial/CSV tests plus embedded PostgreSQL integration/RLS coverage. Test fixtures never reach the application database.

Version 1 intentionally excludes invoices, quotations, payroll, tax reporting, subscriptions and automatic reminders.
