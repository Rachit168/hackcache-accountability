import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {eventHash,ledgerFrame,verifyRecord,type LedgerRecord,type LedgerEvent} from '../domain/record-verification';
async function fixture(){
 const e:LedgerEvent={caseId:'fictional-case',sequence:1,actor:'fictional-actor',time:'2026-10-24T00:00:00.000001Z',action:'submitted',payloadText:JSON.stringify({wording:'हिंदी 😀 é',value:1.25,flags:[null,true,false],nested:{a:':\n'}}),previousHash:'0'.repeat(64),hash:''};
 e.hash=await eventHash(e);return {version:1,caseId:e.caseId,events:[e],count:1,head:e.hash} satisfies LedgerRecord;
}
describe('record verification',()=>{
 it('frames UTF-8 bytes, punctuation and empty values unambiguously',()=>{expect(new TextDecoder().decode(ledgerFrame(['é','',':']))).toBe('2:é0:1::');});
 it('agrees with independent Node SHA-256 for Unicode and nontrivial payload values',async()=>{const r=await fixture();const e=r.events[0];const parts=['HC-LEDGER-1',e.caseId,'1',e.actor,e.time,e.action,e.payloadText,e.previousHash];const frame=parts.map(s=>Buffer.byteLength(s,'utf8')+':'+s).join('');expect(e.hash).toBe(createHash('sha256').update(frame,'utf8').digest('hex'));expect((await verifyRecord(r)).valid).toBe(true);});
 it('detects changed payload without corrupting retained records',async()=>{const r=await fixture();r.events[0].payloadText+=' ';expect(await verifyRecord(r)).toMatchObject({valid:false,failure:'event-hash',sequence:1});});
 it('detects a sequence gap and broken link',async()=>{const r=await fixture();r.events[0].sequence=2;expect((await verifyRecord(r)).failure).toBe('sequence');r.events[0].sequence=1;r.events[0].previousHash='f'.repeat(64);expect((await verifyRecord(r)).failure).toBe('link');});
 it('detects inconsistent head, count, unsupported algorithm and missing history',async()=>{const r=await fixture();expect((await verifyRecord({...r,head:'bad'})).failure).toBe('head-or-count');expect((await verifyRecord({...r,count:2})).valid).toBe(false);expect((await verifyRecord({...r,version:2})).failure).toBe('unsupported-version');expect((await verifyRecord({...r,events:[]})).failure).toBe('incomplete-no-events');});
 it('explicitly identifies legacy baselines',async()=>{const r=await fixture();r.events[0].action='migration_baseline';r.events[0].hash=await eventHash(r.events[0]);r.head=r.events[0].hash;expect(await verifyRecord(r)).toMatchObject({valid:true,legacy:true});});
});
