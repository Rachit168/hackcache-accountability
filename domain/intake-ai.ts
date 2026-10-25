import {z} from 'zod';
export const fixtureText='This is a fictional demonstration. The sample service counter was closed on Monday. I asked for the opening hours. A staff member allegedly refused to answer. Please explain the closure and review the alleged conduct.';
export const citationSchema=z.object({sourceId:z.string().max(80),segment:z.number().int().min(0).max(99),quote:z.string().min(1).max(1200)}).strict();
const field=z.object({value:z.string().min(1).max(2000),citations:z.array(citationSchema).max(5)}).strict();
export const reportSchema=z.object({allegation:field,time:field,location:field,department:field,concerns:z.array(z.object({type:z.enum(['service','conduct','mixed']),field}).strict()).min(1).max(10),timeline:z.array(field).max(12),missing:z.array(z.string().max(200)).max(10)}).strict();
export type Source={id:string;kind:string;sha256:string;segments:{location:string;text:string}[]};
export type AIReport=z.infer<typeof reportSchema>;
export const generationSchema=z.object({text:z.string().max(12000),evidenceIds:z.array(z.string().uuid()).max(5),mode:z.enum(['prepared','live'])}).strict();
export function validateReport(value:unknown,sources:Source[]):AIReport{
 const report=reportSchema.parse(value);const fields=[report.allegation,report.time,report.location,report.department,...report.concerns.map(c=>c.field),...report.timeline];
 for(const f of fields){if(f.value==='not stated'){if(f.citations.length)throw Error('Missing field cannot claim sources');continue;}if(!f.citations.length)throw Error('Source required');for(const c of f.citations){const s=sources.find(s=>s.id===c.sourceId);if(!s?.segments[c.segment]?.text.includes(c.quote))throw Error('Unsupported source or quotation');}}
 return report;
}
/**
 * Repair only formatting of existing source quotations. Some structured-output
 * models fold line breaks or multiple spaces into a single space. The stored
 * source remains authoritative: never trust an invented paraphrase or source ID.
 * Require an unambiguous, case-sensitive whitespace-equivalent substring.
 */
export function canonicalizeReportWhitespace(value:unknown,sources:Source[]):AIReport{
 const parsed=reportSchema.parse(value);
 const repair=(item:typeof parsed.allegation)=>{
  const citations=item.citations.map(c=>{
   const original=sources.find(s=>s.id===c.sourceId)?.segments[c.segment]?.text;
   if(!original||original.includes(c.quote))return c;
   const trimmed=c.quote.trim();
   // Escape every regex metacharacter before relaxing runs of whitespace only.
   if(!trimmed||!/\s/.test(trimmed))return c;
   const pattern=trimmed.split(/\s+/).map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\export function preparedReport(sources:Source[]):AIReport{')).join('\\s+');
   const re=new RegExp(pattern,'g');
   const found=[...original.matchAll(re)];
   if(found.length!==1)return c;
   return {...c,quote:found[0][0]};
  });
  return {...item,citations};
 };
 const normalized={...parsed,allegation:repair(parsed.allegation),time:repair(parsed.time),location:repair(parsed.location),department:repair(parsed.department),concerns:parsed.concerns.map(c=>({...c,field:repair(c.field)})),timeline:parsed.timeline.map(repair)};
 return validateReport(normalized,sources);
}

export function preparedReport(sources:Source[]):AIReport{
 const s=sources.find(s=>s.segments.length===1&&s.segments[0].text===fixtureText);if(!s||sources.some(s=>s.segments.length!==1||s.segments[0].text!==fixtureText))throw Error('PREPARED_FIXTURE_ONLY');
 const f=(value:string,quote:string)=>({value,citations:[{sourceId:s.id,segment:0,quote}]});const absent={value:'not stated',citations:[]};
 return validateReport({allegation:f('The citizen alleges the sample counter was closed and a staff member refused to answer.','The sample service counter was closed on Monday.'),time:f('Monday; date not stated.','on Monday'),location:absent,department:f('Sample service counter; department not stated.','sample service counter'),concerns:[{type:'service',field:f('Explain the counter closure and opening hours.','Please explain the closure')},{type:'conduct',field:f('Review the alleged refusal to answer.','A staff member allegedly refused to answer.')}],timeline:[f('The sample counter was reportedly closed on Monday.','The sample service counter was closed on Monday.'),f('The citizen asked for opening hours.','I asked for the opening hours.')],missing:['Exact date, location and department are not stated.']},sources);
}
export function safeFilename(name:string):string{return (name.replace(/[\\/\x00-\x1f\x7f<>:"|?*]/g,'_').replace(/^\.+/,'').slice(-180)||'evidence');}
export function fileSize(bytes:number):string{return bytes<1024?`${bytes} B`:bytes<1048576?`${(bytes/1024).toFixed(1)} KiB`:`${(bytes/1048576).toFixed(2)} MiB`;}
