import {it,expect} from 'vitest';
import {postgresTls} from '../server/postgres-tls.js';
it('keeps certificate verification on with or without an explicit CA',()=>{
  expect(postgresTls({})).toEqual({rejectUnauthorized:true});
  const tls=postgresTls({SUPABASE_CA_CERT_PATH:'database/certs/prod-ca-2021.crt'});
  expect(tls.rejectUnauthorized).toBe(true);expect(tls.ca).toContain('BEGIN CERTIFICATE');
  expect(()=>postgresTls({SUPABASE_CA_CERT_PATH:'database/certs/missing.crt'})).toThrow();
});
