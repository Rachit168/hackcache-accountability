import 'dotenv/config';
import pg from 'pg';
import {uuidSchema} from '../domain/complaint.js';
import {postgresTls} from '../server/postgres-tls.js';
// Administrator-only explicit case assignment. The staff web client cannot call this.
const [reviewer,caseId]=process.argv.slice(2);
const uri=process.env.MIGRATION_DATABASE_URL,ref=process.env.SUPABASE_PROJECT_REF;
if(!uuidSchema.safeParse(reviewer).success||!uuidSchema.safeParse(caseId).success||!uri||!ref)throw Error('Usage: npx tsx database/assign-reviewer.ts REVIEWER_UUID CASE_UUID (requires private MIGRATION_DATABASE_URL).');
const database=new URL(uri);
if(!(database.hostname==='db.'+ref+'.supabase.co'||(database.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(database.username)==='postgres.'+ref)))throw Error('Dedicated migration credentials required.');
const pool=new pg.Pool({connectionString:database.toString(),ssl:postgresTls(),connectionTimeoutMillis:8000});
try{
 const q=await pool.query(`INSERT INTO hc_private.review_assignments(case_id,reviewer_id)
  SELECT $2,$1 FROM hc_private.demo_principals WHERE actor_id=$1 AND kind='reviewer'
  ON CONFLICT (case_id) DO NOTHING RETURNING case_id`,[reviewer,caseId]);
 if(q.rowCount!==1)throw Error('No assignment was created: verify reviewer identity and case existence or inspect an existing assignment privately.');
 console.log('Existing case assigned to the authorized reviewer. No other case access granted.');
}catch{console.error('Assignment failed or was already present. Existing records and permissions were not broadened.');process.exitCode=1;}finally{await pool.end();}
