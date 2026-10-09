# Verification record

Verified locally on October 9, 2026 with Node.js 22 and Next.js 16.4.0.

## Automated checks

- `npm test`: 45 checks passed across three suites.
- `npm run typecheck`: passed with strict TypeScript settings.
- `npm run format:check`: passed.
- `npm run build -- --webpack`: production compilation, type checking, page generation, and build tracing passed.
- `npm audit`: zero known vulnerabilities at installation time.

The tests cover exact decimal arithmetic, all six currencies, partial and multiple client payments, multiple costs, unpaid and partially paid obligations, negative profit, currency conversion and settlement differences, edits, deletion restrictions, immutable audit history, import rollback, duplicate imports, CSV formula injection, period boundaries, withheld processing fees, dashboard totals, organization isolation, anonymous and unprovisioned access, role escalation attempts, administrator MFA, and revoked membership.

The PostgreSQL integration tests use PGlite, which runs PostgreSQL's SQL, constraint, trigger, transaction, and row-level-security engine in-process. They apply the production migration to a fresh database. Run the migration and repeat the authorization checks against a separate Supabase development project before production launch, because a local engine cannot verify Supabase dashboard configuration, Auth email delivery, hosted backups, or PostgREST deployment settings.

## Browser checks

The local Next.js application was inspected in the in-app browser at desktop and 390 × 844 mobile viewports. Verified:

- setup-state dashboard and five independent financial cards;
- month/year selector and separate cash-flow description;
- responsive navigation drawer and keyboard dismissal;
- mobile project cards without page-level horizontal overflow;
- foreign-currency form revealing the historical rate field;
- reviewed CSV import warning and disabled commit before confirmation;
- settings connection checklist, exchange-rate area, and audit-history state;
- invitation-only login and disabled sign-in while Supabase is unconfigured;
- accessible labels for filters, forms, row actions, dialogs, and navigation;
- no new browser console errors or warnings after the final refresh.

The connected Supabase flow remains intentionally unverified. After provisioning a development Supabase project, test this exact story before production:

1. Invite an administrator, accept the invitation, set a password, enroll TOTP MFA, and verify an AAL1 admin cannot read finance rows while AAL2 can.
2. Add a client and a USD project with a historical rate.
3. Record an advance and confirm expected profit is unchanged while outstanding falls.
4. Add two direct costs, including an unpaid estimate, and confirm both reduce expected profit.
5. Settle one cost and confirm profit stays unchanged while unpaid obligations and cash flow fall.
6. Record a fee withheld from a client settlement and confirm it clears the obligation without a second cash outflow.
7. Edit and delete disposable entries; confirm totals recalculate, stale updates return a conflict, dependent parent deletions fail, and audit records remain.
8. Import a reviewed CSV into the development project, retry the same source row, and confirm the duplicate batch rolls back.
9. Use a second organization/user to verify cross-organization reads and writes return no data or fail.
10. Complete the backup/restore drill in `docs/BACKUP_RESTORE.md`.

Do not interpret the code-only verification as confirmation that production data is backed up, Supabase signups are disabled, redirect URLs are correct, or a Vercel deployment is live. Those controls depend on the projects you connect later.
