import { describe,it,expect } from 'vitest';
import pg from 'pg';
import { migrationConnectionUri } from '../database/connection-uri.js';
describe('local password URI encoding; fictional secrets only',()=>{
  it('round-trips reserved characters and percent sequences through pg',()=>{
    for(const password of ['fake%password','fake%23%ab','fake:/?#@[]\\+ space','fictional-हिन्दी-🔒','%','100%25']){
      const uri=migrationConnectionUri('postgresql://hc_runtime.example:unused@aws-0-ap-south-1.pooler.supabase.com:5432/postgres','example',password);
      expect(decodeURIComponent(new URL(uri).password)).toBe(password);
      const client=new pg.Client({connectionString:uri});
      expect((client as unknown as {connectionParameters:{password:string}}).connectionParameters.password).toBe(password);
    }
  });
  it('rejects a different project runtime login',()=>expect(()=>migrationConnectionUri('postgresql://hc_runtime.other:unused@aws-0-ap-south-1.pooler.supabase.com/postgres','example','fake')).toThrow());
});
