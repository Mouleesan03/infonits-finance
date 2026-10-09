import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
let db: PGlite;
const editor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const admin = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const other = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const outsider = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const org = '11111111-1111-4111-8111-111111111111';
const otherOrg = '22222222-2222-4222-8222-222222222222';
let clientId: string, projectId: string, costId: string, paymentId: string;
async function identity(id: string, aal = 'aal1') {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claim.aal','${aal}',false);`,
  );
}
async function one<T = Record<string, string>>(sql: string, params: unknown[] = []) {
  const result = await db.query<T>(sql, params);
  return result.rows[0];
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;grant usage on schema auth to anon,authenticated;grant execute on all functions in schema auth to anon,authenticated;grant usage on schema public to anon,authenticated;alter default privileges in schema public grant all on tables to anon,authenticated;`,
  );
  // PGlite uses the same PostgreSQL SQL/RLS engine; UUID generation is built into Postgres.
  const migration = readFileSync('supabase/migrations/202610080001_finance.sql', 'utf8').replace(
    'create extension if not exists pgcrypto;',
    '',
  );
  await db.exec(migration);
  await db.exec(
    `insert into auth.users values('${editor}'),('${admin}'),('${other}'),('${outsider}');insert into public.profiles(id,role,organization_id) values('${editor}','editor','${org}'),('${admin}','admin','${org}'),('${other}','editor','${otherOrg}');`,
  );
  await identity(editor);
  clientId = (await one("insert into clients(name) values('Test Client') returning id")).id;
  projectId = (
    await one(
      "insert into projects(client_id,name,amount,currency,exchange_rate,reporting_month,status) values($1,'FX website',1000,'USD',300,'2026-01-01','In progress') returning id",
      [clientId],
    )
  ).id;
  costId = (
    await one(
      "insert into project_costs(project_id,description,category,amount,currency,exchange_rate,date) values($1,'Design','Freelancer',100000,'LKR',1,'2026-01-12') returning id",
      [projectId],
    )
  ).id;
}, 60000);
afterAll(async () => {
  await db.close();
});
describe('PostgreSQL financial integration', () => {
  it('applies all tables and security-invoker views', async () => {
    const row = await one(
      "select count(*)::text as count from pg_tables where schemaname='public' and rowsecurity",
    );
    expect(row.count).toBe('9');
    const view = await one(
      "select reloptions::text as options from pg_class where relname='project_financials'",
    );
    expect(view.options).toContain('security_invoker=true');
  });
  it('treats unpaid committed costs as profit deductions', async () => {
    const p = await one('select * from project_financials where id=$1', [projectId]);
    expect(p.profit).toBe('200000.00');
    expect(p.unpaid_costs).toBe('100000.00');
    expect(p.received).toBe('0');
  });
  it('records multiple partial receipts without changing profit', async () => {
    paymentId = (
      await one(
        "insert into client_payments(project_id,amount,currency,exchange_rate,amount_lkr,contract_amount,date,method) values($1,200,'USD',310,62000,200,'2026-01-15','Bank') returning id",
        [projectId],
      )
    ).id;
    await db.query(
      "insert into client_payments(project_id,amount,currency,exchange_rate,amount_lkr,contract_amount,date,method) values($1,300,'USD',320,96000,300,'2026-02-02','Wise')",
      [projectId],
    );
    const p = await one('select * from project_financials where id=$1', [projectId]);
    expect(p.received).toBe('158000.00');
    expect(p.outstanding).toBe('142000.00');
    expect(p.original_outstanding).toBe('500.00');
    expect(p.profit).toBe('200000.00');
    expect(p.payment_status).toBe('Partially paid');
  });
  it('prevents multiple child rows from multiplying totals', async () => {
    await db.query(
      "insert into project_costs(project_id,description,category,amount,currency,exchange_rate,date,is_estimate) values($1,'Testing','Freelancer',50000,'LKR',1,'2026-01-20',true)",
      [projectId],
    );
    const p = await one('select * from project_financials where id=$1', [projectId]);
    expect(p.received).toBe('158000.00');
    expect(p.costs).toBe('150000.00');
    expect(p.profit).toBe('150000.00');
  });
  it('keeps cost settlement distinct from direct expenses', async () => {
    await db.query(
      "insert into project_cost_payments(cost_id,amount,currency,exchange_rate,amount_lkr,cost_amount,date,method) values($1,30000,'LKR',1,30000,30000,'2026-01-16','Bank')",
      [costId],
    );
    const p = await one('select * from project_financials where id=$1', [projectId]);
    expect(p.profit).toBe('150000.00');
    expect(p.unpaid_costs).toBe('120000.00');
  });
  it('rejects over-allocation and incoherent same-currency payments', async () => {
    await expect(
      db.query(
        "insert into client_payments(project_id,amount,currency,exchange_rate,amount_lkr,contract_amount,date,method) values($1,600,'USD',310,186000,600,'2026-01-17','Bank')",
        [projectId],
      ),
    ).rejects.toThrow(/exceeds/);
    await expect(
      db.query(
        "insert into client_payments(project_id,amount,currency,exchange_rate,amount_lkr,contract_amount,date,method) values($1,20,'USD',310,6200,10,'2026-01-17','Bank')",
        [projectId],
      ),
    ).rejects.toThrow(/match contract/);
    await expect(
      db.query(
        "insert into project_cost_payments(cost_id,amount,currency,exchange_rate,amount_lkr,cost_amount,date,method) values($1,80000,'LKR',1,80000,80000,'2026-01-17','Bank')",
        [costId],
      ),
    ).rejects.toThrow(/exceeds/);
  });
  it('prevents reducing contract or costs below allocated payments', async () => {
    await expect(
      db.query('update projects set amount=100 where id=$1', [projectId]),
    ).rejects.toThrow(/less than payments/);
    await expect(
      db.query('update project_costs set amount=20000 where id=$1', [costId]),
    ).rejects.toThrow(/less than payments/);
  });
  it('updates historical amounts and audits before/after values', async () => {
    await db.query('update projects set amount=1200 where id=$1', [projectId]);
    const p = await one('select * from project_financials where id=$1', [projectId]);
    expect(p.amount_lkr).toBe('360000.00');
    expect(p.profit).toBe('210000.00');
    const audit = await one(
      "select old_record->>'amount' old,new_record->>'amount' new from audit_logs where record_id=$1 and action='UPDATE' order by created_at desc limit 1",
      [projectId],
    );
    expect(audit.old).toBe('1000.00');
    expect(audit.new).toBe('1200.00');
  });
  it('deleting a payment recalculates receipts while preserving an audit trail', async () => {
    await db.query('delete from client_payments where id=$1', [paymentId]);
    const p = await one('select * from project_financials where id=$1', [projectId]);
    expect(p.received).toBe('96000.00');
    expect(p.profit).toBe('210000.00');
    const audit = await one(
      "select action from audit_logs where record_id=$1 and action='DELETE'",
      [paymentId],
    );
    expect(audit.action).toBe('DELETE');
  });
  it('restricts destructive parent deletion', async () => {
    await expect(db.query('delete from projects where id=$1', [projectId])).rejects.toThrow(
      /foreign key/,
    );
    await expect(db.query('delete from clients where id=$1', [clientId])).rejects.toThrow(
      /foreign key/,
    );
  });
  it('supports a negative-profit project', async () => {
    const id = (
      await one(
        "insert into projects(client_id,name,amount,currency,exchange_rate,reporting_month,status) values($1,'Loss project',100,'LKR',1,'2026-01-01','Planned') returning id",
        [clientId],
      )
    ).id;
    await db.query(
      "insert into project_costs(project_id,description,category,amount,currency,exchange_rate,date) values($1,'Work','Work',150,'LKR',1,'2026-01-01')",
      [id],
    );
    const p = await one('select * from project_financials where id=$1', [id]);
    expect(p.profit).toBe('-50.00');
    expect(p.margin).toBe('-50.0');
  });
  it('rolls back an entire CSV import on an invalid row', async () => {
    const base = {
      client_id: clientId,
      name: 'Import',
      amount: '20',
      currency: 'LKR',
      exchange_rate: '1',
      reporting_month: '2026-01-01',
      status: 'Planned',
      notes: '',
      source_record: { original: 'kept' },
    };
    await expect(
      db.query('select import_projects($1::jsonb)', [
        JSON.stringify([
          { ...base, import_key: 'batch-a' },
          { ...base, amount: '-5', import_key: 'batch-b' },
        ]),
      ]),
    ).rejects.toThrow();
    const result = await one(
      "select count(*)::text count from projects where import_key in ('batch-a','batch-b')",
    );
    expect(result.count).toBe('0');
  });
  it('preserves import source records and rejects duplicate imports', async () => {
    const base = {
      client_id: clientId,
      name: 'Imported',
      amount: '20',
      currency: 'LKR',
      exchange_rate: '1',
      reporting_month: '2026-01-01',
      status: 'Planned',
      notes: '',
      source_record: { 'For Me': 'ambiguous' },
      import_key: 'unique-source',
    };
    await db.query('select import_projects($1::jsonb)', [JSON.stringify([base])]);
    const row = await one(
      "select source_record->>'For Me' source from projects where import_key='unique-source'",
    );
    expect(row.source).toBe('ambiguous');
    await expect(
      db.query('select import_projects($1::jsonb)', [JSON.stringify([base])]),
    ).rejects.toThrow(/unique/);
  });
});
describe('PostgreSQL security boundaries', () => {
  it('does not allow anonymous reads or imports', async () => {
    await db.exec('reset role;set role anon;');
    await expect(db.query('select * from project_financials')).rejects.toThrow(/permission denied/);
    await expect(db.query("select import_projects('[]')")).rejects.toThrow(/permission denied/);
  });
  it('rejects authenticated users without provisioned membership', async () => {
    await identity(outsider);
    expect((await db.query('select * from projects')).rows).toHaveLength(0);
    await expect(db.query("insert into clients(name) values('Unauthorized')")).rejects.toThrow();
  });
  it('explicitly denies TRUNCATE privileges that bypass RLS', async () => {
    await identity(editor);
    for (const table of ['projects', 'profiles', 'audit_logs'])
      await expect(db.query(`truncate ${table} cascade`)).rejects.toThrow(/permission denied/);
  });
  it('rejects nonfinite values even through direct database writes', async () => {
    await identity(editor);
    await expect(
      db.query("update projects set amount='NaN' where id=$1", [projectId]),
    ).rejects.toThrow();
    await expect(
      db.query("update projects set exchange_rate='NaN' where id=$1", [projectId]),
    ).rejects.toThrow();
  });
  it('prevents client-side role escalation and audit tampering', async () => {
    await identity(editor);
    await expect(
      db.query("update profiles set role='admin' where id=$1", [editor]),
    ).rejects.toThrow(/permission denied/);
    await expect(db.query('delete from audit_logs')).rejects.toThrow(/permission denied/);
  });
  it('requires MFA on administrator reads and writes', async () => {
    await identity(admin);
    expect((await db.query('select * from project_financials')).rows).toHaveLength(0);
    await expect(db.query("insert into clients(name) values('MFA bypass')")).rejects.toThrow();
    await identity(admin, 'aal2');
    expect((await db.query('select * from project_financials')).rows.length).toBeGreaterThan(0);
  });
  it('isolates organizations and cross-organization foreign keys', async () => {
    await identity(other);
    expect((await db.query('select * from project_financials')).rows).toHaveLength(0);
    await expect(
      db.query(
        "insert into projects(client_id,name,amount,currency,exchange_rate,reporting_month,status) values($1,'Intrusion',1,'LKR',1,'2026-01-01','Planned')",
        [clientId],
      ),
    ).rejects.toThrow(/foreign key/);
    await expect(
      db.query("insert into clients(name,organization_id) values('Intrusion',$1)", [org]),
    ).rejects.toThrow(/row-level security/);
  });
  it('revokes access immediately when membership becomes inactive', async () => {
    await db.exec(`reset role;update profiles set active=false where id='${other}';`);
    await identity(other);
    await expect(db.query("insert into clients(name) values('Inactive')")).rejects.toThrow();
    await identity(editor);
  });
});
