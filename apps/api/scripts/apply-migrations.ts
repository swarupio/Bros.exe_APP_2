import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';

// SQL policies/triggers remain authoritative. Uses Supabase's session connection;
// no psql installation and no Prisma db push that would discard security rules.
const migrationUrl=process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!migrationUrl) throw new Error('Configure a server-only migration-capable Supabase connection');
const client=new pg.Client({connectionString:migrationUrl,connectionTimeoutMillis:10000});
await client.connect();
try {
  await client.query('select pg_advisory_lock(746291)');
  await client.query('create table if not exists public.app_schema_migrations (name text primary key, sha256 text not null, applied_at timestamptz not null default now())');
  await client.query('alter table public.app_schema_migrations enable row level security');
  await client.query('revoke all on public.app_schema_migrations from anon,authenticated');
  const folder=new URL('../../../supabase/migrations/',import.meta.url);
  for (const name of (await readdir(folder)).filter(f => f.endsWith('.sql')).sort()) {
    const sql=await readFile(new URL(name,folder),'utf8'),sha=createHash('sha256').update(sql).digest('hex');
    const prior=await client.query('select sha256 from public.app_schema_migrations where name=$1',[name]);
    if (prior.rows.length) { if (prior.rows[0].sha256!==sha) throw new Error(`Migration checksum changed: ${name}`); continue; }
    await client.query('begin');
    try {
      // Migration transaction wrappers are replaced by the runner's transaction.
      await client.query(sql.replace(/^begin;\s*/mi,'').replace(/^commit;\s*$/mi,''));
      await client.query('insert into public.app_schema_migrations(name,sha256) values($1,$2)',[name,sha]);
      await client.query('commit');
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query('rollback');
      const message = error instanceof Error ? error.message : 'unknown database error';
      throw new Error(`Migration failed: ${name}; ${message}`);
    }
  }
} finally { await client.end(); }
