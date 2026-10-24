export type LedgerEvent={caseId:string;sequence:number;actor:string;time:string;action:string;payloadText:string;previousHash:string;hash:string};
export type LedgerRecord={version:number;caseId:string;events:LedgerEvent[];count:number;head:string|null};
export type RecordBundle=LedgerRecord&{displayed:{narrative:string;concerns:{type:string;wording:string}[]};evidence:import('./evidence').EvidenceFile[]};
function semantic(value:unknown):string {if(Array.isArray(value))return '['+value.map(semantic).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+semantic(v)).join(',')+'}';return JSON.stringify(value);}
export function verifyDisplayed(record:RecordBundle):{valid:boolean;failure?:string}{
 try{
  const start=record.events.find(e=>e.action==='submitted'||e.action==='migration_baseline');if(!start)return {valid:false,failure:'missing-commitment'};
  const data=JSON.parse(start.payloadText);const payload=start.action==='submitted'?data.payload:data.case.payload;
  if(semantic(record.displayed)!==semantic({narrative:payload.narrative,concerns:payload.concerns}))return {valid:false,failure:'displayed-account-or-concerns'};
  const commitment=record.events.find(e=>e.action==='evidence_manifest');const files=commitment?JSON.parse(commitment.payloadText).files:[];
  if(semantic(record.evidence)!==semantic(files))return {valid:false,failure:'evidence-manifest'};
  return {valid:true};
 }catch{return {valid:false,failure:'incomplete-commitment'};}
}
export function ledgerFrame(parts:string[]):Uint8Array {
 const encode=new TextEncoder();
 return encode.encode(parts.map(value=>`${encode.encode(value).length}:${value}`).join(''));
}
export async function eventHash(event:LedgerEvent):Promise<string>{
 const bytes=ledgerFrame(['HC-LEDGER-1',event.caseId,String(event.sequence),event.actor,event.time,event.action,event.payloadText,event.previousHash]);
 const digest=await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>);
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}
export async function verifyRecord(record:LedgerRecord):Promise<{valid:boolean;failure?:string;sequence?:number;legacy:boolean}>{
 const legacy=record.events.some(e=>e.action==='migration_baseline');
 const fail=(failure:string,sequence?:number)=>({valid:false,failure,sequence,legacy});
 if(record.version!==1)return fail('unsupported-version');
 if(!record.events.length)return fail('incomplete-no-events');
 let previous='0'.repeat(64);
 for(let i=0;i<record.events.length;i++){
  const event=record.events[i];
  if(event.sequence!==i+1||event.caseId!==record.caseId)return fail('sequence',i+1);
  if(event.previousHash!==previous)return fail('link',i+1);
  if(await eventHash(event)!==event.hash)return fail('event-hash',i+1);
  previous=event.hash;
 }
 if(record.count!==record.events.length||record.head!==previous)return fail('head-or-count');
 return {valid:true,legacy};
}
