import {z} from 'zod';
export const coverageStatuses=['addressed','partial','not_explicit','unclear'] as const;
export type CoverageStatus=typeof coverageStatuses[number];
export type AuditSources={caseId:string;concerns:{id:string;wording:string}[];responses:{id:string;versionId:string;text:string;time:string}[];disputes:{id:string;actor:string;time:string;responseId:string;reason:string;concernIds:string[]}[]};
export const auditReportSchema=z.object({items:z.array(z.object({concernId:z.uuid(),status:z.enum(coverageStatuses),concernQuote:z.string().min(1).max(2000),responseQuotes:z.array(z.string().min(1).max(2000)).max(3)}).strict()).max(30)}).strict();
export function validateAudit(value:unknown,sources:AuditSources,responseId:string){
 const report=auditReportSchema.parse(value);const response=sources.responses.find(r=>r.id===responseId);if(!response||report.items.length!==sources.concerns.length)throw Error('Incomplete sources');
 const seen=new Set<string>();for(const item of report.items){const concern=sources.concerns.find(c=>c.id===item.concernId);if(!concern||seen.has(item.concernId)||!concern.wording.includes(item.concernQuote)||item.responseQuotes.some(q=>!q.trim()||!response.text.includes(q))||(['addressed','partial'].includes(item.status)&&!item.responseQuotes.length))throw Error('Unsupported citation or incomplete comparison');seen.add(item.concernId);}
 return sources.concerns.map(c=>report.items.find(i=>i.concernId===c.id)!);
}
export function auditSources(caseId:string,view:any):AuditSources{return {caseId,concerns:view.concerns.map((c:any)=>({id:c.id,wording:c.wording})),responses:view.targets.filter((r:any)=>r.kind==='office_response').map((r:any)=>({id:r.id,versionId:r.versionId,text:r.text,time:r.time})),disputes:view.history.filter((d:any)=>d.target_kind==='office_response').map((d:any)=>({id:d.id,actor:d.actor_id,time:d.recorded_at,responseId:d.target_id,reason:d.request.reason,concernIds:d.request.concernIds}))};}
