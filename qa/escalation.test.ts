import {describe,it,expect} from 'vitest';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {escalationDecision,escalationCommands,type EscalationStage} from '../domain/escalation';
import {createApp} from '../server/app';
const start='2026-10-24T00:00:00.000Z';const at=(h:number)=>new Date(Date.parse(start)+h*3600000).toISOString();
const stage:EscalationStage={level:0,startedAt:start,acknowledged:false,responded:false,claimedResolved:false,investigationUntil:null};
describe('fictional DEMO-ESC-1 policy',()=>{
 it('holds before acknowledgement deadline and qualifies at equality',()=>{expect(escalationDecision(stage,at(23)).escalate).toBe(false);expect(escalationDecision(stage,at(24)).escalate).toBe(true);});
 it('acknowledgement is not resolution, and response uses the original bounded stage deadline',()=>{const s={...stage,acknowledged:true};expect(escalationDecision(s,at(24)).status).toBe('awaiting_response');expect(escalationDecision({...s,responded:true,claimedResolved:true},at(72)).escalate).toBe(true);});
 it('late acknowledgement retains the missed fictional milestone at and after the 24-hour boundary',()=>{const timely={...stage,acknowledged:true};expect(escalationDecision(timely,at(23)).status).toBe('awaiting_response');const late={...timely,acknowledgementMissedEffectiveAt:at(24)};expect(escalationDecision(late,at(24))).toMatchObject({deadline:at(24),status:'overdue',escalate:true});expect(escalationDecision(late,at(25)).escalate).toBe(true);});
 it('valid investigations hold temporarily; expired and invalid holds cannot block forever',()=>{const s={...stage,acknowledged:true,investigationUntil:at(100)};expect(escalationDecision(s,at(80)).status).toBe('investigating');expect(escalationDecision(s,at(100)).escalate).toBe(true);expect(escalationDecision({...s,investigationUntil:at(999)},at(80)).escalate).toBe(true);});
 it('never advances beyond the highest authority',()=>{expect(escalationDecision({...stage,level:2},at(100))).toMatchObject({status:'highest_limit',escalate:false});});
 it('rejects forged clock, role and authority fields in every command schema',()=>{for(const action of ['evaluate','advance','acknowledge'] as const)for(const field of ['now','authority','actor','role','offsetHours'])expect(escalationCommands[action].safeParse({[field]:'forged'}).success).toBe(false);expect(escalationCommands.investigate.safeParse({reason:'short'}).success).toBe(false);});
 it('HTTP validation rejects forged metadata before invoking a command',async()=>{let calls=0;const actor=randomUUID();const app=createApp({config:{ready:true,url:'https://fixture.supabase.co',key:'fixture',databaseUrl:'fixture'},verify:async()=>actor,store:{submit:async()=>{throw Error();},read:async()=>null,escalationCommand:async()=>{calls++;return {};}}});const r=await request(app).post('/api/escalation/'+randomUUID()+'/advance').auth('unit-token',{type:'bearer'}).set('Idempotency-Key',randomUUID()).send({now:at(900)});expect(r.status).toBe(400);expect(calls).toBe(0);});
});
