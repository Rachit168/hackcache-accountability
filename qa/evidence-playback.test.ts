import {afterEach,it,expect,vi} from 'vitest';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app';
import {fingerprint} from '../server/evidence';
const actor=randomUUID(),id=randomUUID();
const config={ready:true,url:'https://fixture.supabase.co',key:'fixture',databaseUrl:'fixture'};
afterEach(()=>vi.unstubAllGlobals());
it('plays only authorized hash-matching allowlisted bytes and fails closed on denial, tampering and storage outage',async()=>{
 const bytes=Buffer.alloc(44);bytes.write('RIFF');bytes.writeUInt32LE(36,4);bytes.write('WAVEfmt ',8);bytes.write('data',36);
 let denied=false,type='audio/wav';const remote=vi.fn(async()=>new Response(bytes));vi.stubGlobal('fetch',remote);
 const app=createApp({config,verify:async()=>actor,store:{read:async()=>null,submit:async()=>{throw Error();},evidenceGet:async()=>{if(denied)throw Object.assign(Error(),{code:'42501'});return {object_path:'opaque',media_type:type,byte_count:bytes.length,sha256:fingerprint(bytes)} as any;}}});
 const get=()=>request(app).get('/api/evidence/'+id+'/playback').auth('fixture',{type:'bearer'});
 expect((await get()).headers['content-type']).toContain('audio/wav');
 denied=true;remote.mockClear();expect((await get()).status).toBe(403);expect(remote).not.toHaveBeenCalled();denied=false;
 type='application/pdf';expect((await get()).status).toBe(400);type='audio/wav';
 remote.mockImplementation(async()=>new Response(Buffer.from('changed')));expect((await get()).status).toBe(409);
 remote.mockImplementation(async()=>new Response('',{status:503}));expect((await get()).status).toBe(503);
});
