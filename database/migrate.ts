import 'dotenv/config';
import fs from 'node:fs/promises';
import pg from 'pg';
import { configuration } from '../server/config.js';
if(!configuration().ready||!process.env.MIGRATION_DATABASE_URL||!process.env.HC_RUNTIME_PASSWORD) throw new Error('Dedicated project, runtime URL, migration URL and HC_RUNTIME_PASSWORD are required. No database changes attempted.');
const admin=new URL(process.env.MIGRATION_DATABASE_URL);
if(decodeURIComponent(admin.username).startsWith('hc_runtime')) throw new Error('Migration and runtime credentials must differ.');
const ref=process.env.SUPABASE_PROJECT_REF;
if(!(admin.hostname===`db.${ref}.supabase.co`||(admin.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(admin.username)===`postgres.${ref}`))) throw new Error('Migration URL must target the confirmed dedicated project.');
const pool=new pg.Pool({connectionString:admin.toString(),ssl:{rejectUnauthorized:true},max:1});
let transactionOpened=false;
try {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    transactionOpened=true;
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('hc_migration',0))");
    const exists=await client.query("SELECT to_regclass('hc_private.migrations') IS NOT NULL AS applied");
    if(!exists.rows[0].applied){
      await client.query(await fs.readFile(new URL('./001_foundation.sql',import.meta.url),'utf8'));
      await client.query('CREATE TABLE hc_private.migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      await client.query('REVOKE ALL ON hc_private.migrations FROM PUBLIC,anon,authenticated,hc_runtime,hc_writer');
      await client.query('INSERT INTO hc_private.migrations(version) VALUES(1)');
    }
    await client.query(`ALTER ROLE hc_runtime LOGIN PASSWORD ${pg.escapeLiteral(process.env.HC_RUNTIME_PASSWORD)}`);
    await client.query('COMMIT'); console.log('Migration 001 applied/already present; runtime password provisioned.');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}catch{console.error(transactionOpened?'Migration failed; rollback was attempted. Check dedicated setup privately.':'Migration connection/start failed; no migration SQL executed. Check dedicated setup privately.');process.exitCode=1;}finally{await pool.end();}
