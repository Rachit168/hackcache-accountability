import {z} from 'zod';
export const escalationPolicy={version:'DEMO-ESC-1',ackHours:24,responseHours:72,investigationHours:48,maxStageHours:168,maxClockHours:720,maxLevel:2} as const;
export const escalationCommands={evaluate:z.object({}).strict(),advance:z.object({}).strict(),acknowledge:z.object({}).strict(),investigate:z.object({reason:z.string().max(1000).trim().min(10)}).strict(),respond:z.object({text:z.string().max(2000).trim().min(1),claimedResolved:z.boolean()}).strict()};
export type EscalationAction=keyof typeof escalationCommands;
export type EscalationStage={level:number;startedAt:string;acknowledged:boolean;responded:boolean;claimedResolved:boolean;investigationUntil:string|null};
export function escalationDecision(stage:EscalationStage,now:string){
 const start=Date.parse(stage.startedAt),time=Date.parse(now);if(!Number.isFinite(start)||!Number.isFinite(time)||stage.level<0||stage.level>2)throw Error('Invalid policy input');
 const ordinary=start+(stage.acknowledged?escalationPolicy.responseHours:escalationPolicy.ackHours)*3600000;
 const hold=stage.investigationUntil?Date.parse(stage.investigationUntil):NaN;
 const validHold=stage.acknowledged&&Number.isFinite(hold)&&hold>start&&hold<=start+escalationPolicy.maxStageHours*3600000;
 const deadline=validHold?Math.max(ordinary,hold):ordinary;
 const due=time>=deadline;
 return {deadline:new Date(deadline).toISOString(),status:due?(stage.level===2?'highest_limit':'overdue'):validHold&&time<hold?'investigating':stage.responded?'response_received_unverified':stage.acknowledged?'awaiting_response':'awaiting_acknowledgement',escalate:due&&stage.level<2};
}
