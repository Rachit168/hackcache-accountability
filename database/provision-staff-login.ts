import 'dotenv/config';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {configuration} from '../server/config.js';
import {postgresTls} from '../server/postgres-tls.js';
import {uuidSchema} from '../domain/complaint.js';

// Local administrator-only account creation. Never call this from the web app.
// STAFF_ACCOUNT_EMAIL, STAFF_ACCOUNT_PASSWORD, SUPABASE_SERVICE_ROLE_KEY and
// MIGRATION_DATABASE_URL must be set privately. No secrets are logged.
const config=configuration();
const [kind,argument]=process.argv.slice(2);
const allowedOffices=['SAMPLE_MUNICIPAL_DESK','UNRELATED_DEMO_OFFICE'];
const office=kind==='office'?(argument??'SAMPLE_MUNICIPAL_DESK'):null;
const assignedCase=kind==='reviewer'&&argument?argument:undefined;
const email=process.env.STAFF_ACCOUNT_EMAIL?.trim().toLowerCase();
const password=process.env.STAFF_ACCOUNT_PASSWORD;
const secret=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const uri=process.env.MIGRATION_DATABASE_URL;
const ref=process.env.SUPABASE_PROJECT_REF;
if(!config.ready||!uri||!secret||!email||!password||password.length<12||
   !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||
   !['reviewer','office'].includes(kind)||
   (kind==='office'&&!allowedOffices.includes(office!))||
   (kind==='reviewer'&&argument&&!uuidSchema.safeParse(argument).success)){
 throw Error('Private configuration or arguments missing. Usage: tsx database/provision-staff-login.ts office [OFFICE] OR reviewer [CASE_UUID]. Set STAFF_ACCOUNT_EMAIL, STAFF_ACCOUNT_PASSWORD (12+), SUPABASE_SERVICE_ROLE_KEY, MIGRATION_DATABASE_URL privately.');
}
const migration=new URL(uri);
if(!(migration.hostname==='db.'+ref+'.supabase.co'||
    (migration.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(migration.username)==='postgres.'+ref))){
 throw Error('Dedicated migration credentials for the configured project are required.');
}
const keyRole=secret.startsWith('sb_secret_')?'service_role':(()=>{
 try{return JSON.parse(Buffer.from(secret.split('.')[1],'base64url').toString()).role;}catch{return '';}})();
if(keyRole!=='service_role')throw Error('A project-specific Supabase secret/service-role key is required. Publishable keys cannot provision staff.');
const client=createClient(config.url!,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const created=await client.auth.admin.createUser({email,password,email_confirm:true});
if(created.error||!created.data.user)throw Error('Supabase staff account creation failed. Check the private administrator setup.');
const userId=created.data.user.id;
const pool=new pg.Pool({connectionString:migration.toString(),ssl:postgresTls(),connectionTimeoutMillis:8000});
let committed=false;
try{
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  await db.query('INSERT INTO hc_private.demo_principals(actor_id,kind,office) VALUES($1,$2,$3)',[userId,kind,office]);
  if(assignedCase)await db.query('INSERT INTO hc_private.review_assignments(case_id,reviewer_id) VALUES($1,$2)',[assignedCase,userId]);
  await db.query('COMMIT');committed=true;
 }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}finally{db.release();}
 console.log('Authorized staff account created:',kind,office??'assigned reviewer',assignedCase?'with one initial case assignment':'with no initial case assignment');
 console.log('New staff actor ID for private administrator assignments:',userId);
 console.log('Sign in at /staff with the separately configured staff email and password. No JSON file is required.');
}catch{
 if(!committed)await client.auth.admin.deleteUser(userId).catch(()=>{});
 console.error('Authorization setup failed. No staff permissions were committed. Check the local administrator configuration.');
 process.exitCode=1;
}finally{await pool.end();}
