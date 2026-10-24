import {commandFailure} from './workflow-state';
export type EscalationView={policy:string;status:string;level?:number;authority?:string;deadline?:string;effectiveNow?:string;offsetHours?:number;canManage:boolean;claimedResolved?:boolean;independentlyResolved?:boolean;investigationReason?:string;history:{id:string;actor:string;operation:string;recordedAt:string;detail:{toLevel?:number;reason?:string;text?:string}}[]};
export type EscalationApi=<T>(path:string,init?:RequestInit)=>Promise<T>;
export function escalationController(api:EscalationApi,id:string){
 let pending:{action:'evaluate'|'advance';key:string;confirmed:boolean}|undefined;let running=false;
 const read=()=>api<EscalationView>('/escalation/'+id);
 return {read,get pending(){return pending;},async send(action:'evaluate'|'advance'){
  if(running||pending&&pending.action!==action)throw Error('Pending command');running=true;
  pending??={action,key:crypto.randomUUID(),confirmed:false};
  try{if(!pending.confirmed){await api('/escalation/'+id+'/'+action,{method:'POST',headers:{'Idempotency-Key':pending.key},body:'{}'});pending.confirmed=true;}const result=await read();pending=undefined;return result;}
  catch(e){if(!pending?.confirmed&&commandFailure((e as {status?:number}).status)!=='uncertain')pending=undefined;throw e;}finally{running=false;}
 }};
}
