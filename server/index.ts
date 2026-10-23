import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { configuration } from './config.js';
import { caseStore } from './database.js';
import { createApp } from './app.js';
import { postgresTls } from './postgres-tls.js';
const config=configuration();
const pool=config.ready?new pg.Pool({connectionString:config.databaseUrl,max:5,connectionTimeoutMillis:8000,idleTimeoutMillis:30000,statement_timeout:10000,ssl:postgresTls()}):undefined;
pool?.on('error',()=>console.error('Database connection unavailable.'));
const auth=config.ready?createClient(config.url!,config.key!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(8000)})}}):undefined;
const app=createApp({config,store:pool?caseStore(pool):undefined,verify:auth?async token=>{const {data,error}=await auth.auth.getUser(token);return error?null:data.user?.id??null;}:undefined});
const server=app.listen(Number(process.env.PORT??3000),'0.0.0.0',()=>console.log(`HackCache server ready; Supabase ${config.ready?'configured (connection not yet verified)':'SETUP_NEEDED'}.`));
async function close(){server.close();await pool?.end();}
process.on('SIGTERM',close);process.on('SIGINT',close);
