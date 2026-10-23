import 'dotenv/config';
import fs from 'node:fs/promises';
import { migrationConnectionUri } from './connection-uri.js';
const ref=process.env.SUPABASE_PROJECT_REF;
if(!ref||process.env.DEDICATED_PROJECT_CONFIRM!==ref||!process.env.DATABASE_URL) throw new Error('Confirmed dedicated runtime configuration required.');
if(!process.env.HC_MIGRATION_PASSWORD){console.log('PRIVATE_DATABASE_PASSWORD_REQUIRED: enter HC_MIGRATION_PASSWORD privately in ignored .env.');process.exitCode=2;}
else {
  const uri=migrationConnectionUri(process.env.DATABASE_URL,ref,process.env.HC_MIGRATION_PASSWORD);
  const env=await fs.readFile('.env','utf8');
  if(!/^MIGRATION_DATABASE_URL=.*$/m.test(env)) throw new Error('Migration configuration line missing.');
  await fs.writeFile('.env',env.replace(/^MIGRATION_DATABASE_URL=.*$/m,()=>`MIGRATION_DATABASE_URL=${uri}`));
  // Keep the private staging value until connection verification succeeds.
  console.log('PRIVATE_MIGRATION_CONFIGURATION_PREPARED: no credentials printed.');
}
