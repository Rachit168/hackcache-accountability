import fs from 'node:fs';
export function postgresTls(env: NodeJS.ProcessEnv = process.env) {
  return { rejectUnauthorized: true as const, ...(env.SUPABASE_CA_CERT_PATH ? { ca: fs.readFileSync(env.SUPABASE_CA_CERT_PATH, 'utf8') } : {}) };
}
