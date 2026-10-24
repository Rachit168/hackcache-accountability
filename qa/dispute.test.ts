import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {disputeSchema} from '../domain/dispute';
import {createApp} from '../server/app';
const body={targetKind:'office_response',targetId:randomUUID(),reason:'Unanswered original concern.',concernIds:[],evidenceIds:[]};
it('requires bounded reason, unique references and rejects caller-assigned metadata',()=>{expect(disputeSchema.safeParse(body).success).toBe(true);for(const extra of [{actor:randomUUID()},{time:'2099-01-01'},{reason:'short'},{evidenceIds:[randomUUID(),randomUUID(),randomUUID(),randomUUID(),randomUUID(),randomUUID()]}])expect(disputeSchema.safeParse({...body,...extra}).success).toBe(false);const id=randomUUID();expect(disputeSchema.safeParse({...body,concernIds:[id,id]}).success).toBe(false);});
it('rejects forged HTTP dispute metadata before calling the store',async()=>{let calls=0;const app=createApp({config:{ready:true,url:'fixture',key:'fixture',databaseUrl:'fixture'},verify:async()=>randomUUID(),store:{submit:async()=>{throw Error();},read:async()=>null,disputeSubmit:async()=>{calls++;return {};}}});const r=await request(app).post('/api/disputes/'+randomUUID()).auth('fixture',{type:'bearer'}).set('Idempotency-Key',randomUUID()).send({...body,actor:randomUUID()});expect(r.status).toBe(400);expect(calls).toBe(0);});
