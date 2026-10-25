import 'dotenv/config';
import fs from 'node:fs/promises';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { configuration } from '../server/config.js';
import { postgresTls } from '../server/postgres-tls.js';
import { uuidSchema } from '../domain/complaint.js';
const config=configuration();
// Offices are provisioned once per fictional department; no complaint UUID is necessary.
// Reviewers remain scoped to explicitly assigned complaints.
const [kind,arg1,arg2]=process.argv.slice(2);
const caseId=kind==='reviewer'?arg1:undefined;
const office=kind==='office'?(arg1??'SAMPLE_MUNICIPAL_DESK'):(arg2??'SAMPLE_MUNICIPAL_DESK');
if(!config.ready||!process.env.MIGRATION_DATABASE_URL||!['reviewer','office'].includes(kind)||(kind==='reviewer'&&!uuidSchema.safeParse(caseId).success)||(kind==='office'&&arg2!==undefined)||!['SAMPLE_MUNICIPAL_DESK','UNRELATED_DEMO_OFFICE'].includes(office))throw Error('Usage: tsx database/provision-demo.ts office [OFFICE] OR reviewer CASE_UUID [OFFICE]. Dedicated migration credentials required.');
const admin=new URL(process.env.MIGRATION_DATABASE_URL);
const ref=process.env.SUPABASE_PROJECT_REF;
if(!(admin.hostname=== 'db.'+ref+'.supabase.co'||(admin.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(admin.username)==='postgres.'+ref)))throw Error('Dedicated migration login required.');
const auth=createClient(config.url!,config.key!,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await auth.auth.signInAnonymously();if(error||!data.session)throw Error('Managed demo identity creation failed.');
const pool=new pg.Pool({connectionString:admin.toString(),ssl:postgresTls(),connectionTimeoutMillis:8000});
try{
 const client=await pool.connect();
 try{await client.query('BEGIN');await client.query('INSERT INTO hc_private.demo_principals(actor_id,kind,office) VALUES($1,$2,$3)',[data.user!.id,kind,kind==='office'?office:null]);
 if(kind==='reviewer')await client.query('INSERT INTO hc_private.review_assignments(case_id,reviewer_id) VALUES($1,$2)',[caseId,data.user!.id]);
 await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 await fs.mkdir('.cache',{recursive:true});
 const file='.cache/t04-'+kind+'-'+data.user!.id+'.json';
 await fs.writeFile(file,JSON.stringify({access_token:data.session.access_token,refresh_token:data.session.refresh_token}),{flag:'wx',mode:0o600});
 console.log('Fictional managed identity provisioned. Open the private file in /staff:',file);
}catch{console.error('Provisioning failed. Inspect dedicated setup privately; a managed identity may exist without an assignment.');process.exitCode=1;}finally{await pool.end();}
