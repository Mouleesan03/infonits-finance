# Backup and restore runbook

The app cannot enable a hosting plan's backups on your behalf. Configure and verify this on the connected Supabase project before using it for company records.

## Before launch

1. Decide acceptable data loss and recovery time with the owner. Enable Supabase daily backups or point-in-time recovery appropriate to the project plan. Confirm retention in the actual dashboard; do not assume a free project has a usable managed backup policy.
2. Keep migration SQL and the application lockfile in a private version-control repository. Keep credentials in the hosting secret store, not that repository.
3. Take encrypted logical database backups on a controlled machine using Supabase's documented CLI/pg_dump procedures. Include public financial tables, profiles, audit_logs, enum types, functions, policies, triggers and source_record import evidence. Account for Auth users and identities separately using Supabase's documented restoration procedure: profiles reference auth.users.
4. Store backups outside the primary database account, encrypt them, restrict access to the finance administrator, and document retention. CSV exports are useful reconciliation material but are **not** complete backups.
5. Perform a restore drill into a separate disposable Supabase project. Never validate a restore by overwriting production.

## Restore drill / incident recovery

1. Put the application in maintenance mode and revoke write access while recovering. Record the recovery target time and affected period.
2. Restore a managed backup/PITR target into an isolated recovery environment using Supabase's supported process. For logical dumps, follow the documented order for roles/schema, Auth users, profile membership, and financial data; verify compatible schema versions. Do not disable RLS and expose the recovery environment to normal traffic.
3. Validate counts for clients/projects/payments/costs/cost payments/expenses/exchange rates/audits. Compare aggregate project value, received, direct cost, expected profit, and selected-period cash flow with trusted reconciliation exports. Check original CSV evidence and audit chronology.
4. Verify an admin must complete MFA, ordinary authorized members are scoped to their organization, and an uninvited user/anon key cannot read financial data. Verify foreign keys and triggers are present.
5. Test adding/editing/deleting disposable records in the recovery project and ensure audit events appear. Compare a restored project's original-currency remaining balance and LKR reporting balance.
6. Only after validation, update the deployment connection as part of the incident plan. Reconcile transactions written after the restore point explicitly, avoiding duplicate settlements.
7. Record the elapsed recovery time, last included transaction, any data loss, and follow-up actions. Repeat the drill after material schema/auth changes and at the organization's chosen cadence.

Authoritative procedure: https://supabase.com/docs/guides/platform/backups

No backup configuration or actual restore has been performed in this code-only delivery.
