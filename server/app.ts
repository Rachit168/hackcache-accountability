import express from 'express';
import {auditSources} from '../domain/resolution-audit.js';
import {generateAudit} from './resolution-audit.js';
import {disputeSchema} from '../domain/dispute.js';
import path from 'node:path';
import { complaintSchema, uuidSchema } from '../domain/complaint.js';
import type { configuration } from './config.js';
import type { caseStore } from './database.js';
import { complaintRequestLimitBytes } from './request-limits.js';
import {evidenceLimits,fingerprint,privateStorage,validatedType} from './evidence.js';
import {buildIntake} from './intake-ai.js';
import {generationSchema,safeFilename} from '../domain/intake-ai.js';
import {escalationCommands,type EscalationAction} from '../domain/escalation.js';
type Store=Pick<ReturnType<typeof caseStore>,'submit'|'read'> & Partial<Pick<ReturnType<typeof caseStore>,'workflowRead'|'workflowCommit'|'recordRead'|'recordBundle'|'evidenceGet'|'evidenceStage'|'intakeCommand'|'escalationRead'|'escalationCommand'|'disputeRead'|'disputeSubmit'>>;
type Dependencies={config:ReturnType<typeof configuration>; store?:Store; verify?:(token:string)=>Promise<string|null>};
export function createApp({config,store,verify}:Dependencies) {
  const app=express(); app.disable('x-powered-by');
  app.use((_req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; style-src 'self' 'unsafe-inline'; media-src 'self' blob:; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});next();});
  app.use(express.json({limit:complaintRequestLimitBytes}));
  app.get('/api/health',(_req,res)=>res.json({status:'ok',configured:config.ready,stage:'task-01-foundation'}));
  app.get('/api/config',(_req,res)=>res.json(config.ready?{ready:true,url:config.url,publishableKey:config.key}:{ready:false,message:'Dedicated Supabase configuration is needed. No complaint can be submitted yet.'}));
  app.get('/api/fixtures/intake.wav',(_req,res)=>res.type('audio/wav').sendFile(path.resolve('content/b02/fictional-report.wav')));
  app.use('/api',async(req,res,next)=>{
    const match=/^Bearer ([^\s]+)$/.exec(req.headers.authorization??'');
    if(!match){res.status(401).json({error:'Sign in with a managed citizen account.'});return;}
    if(!config.ready||!store||!verify){res.status(503).json({error:'SETUP_NEEDED'});return;}
    try {const actor=await verify(match[1]); if(!actor||!uuidSchema.safeParse(actor).success){res.status(401).json({error:'Invalid or expired credentials.'});return;} res.locals.actor=actor;res.locals.token=match[1];next();} catch {res.status(503).json({error:'Authentication service unavailable. Please retry.'});}
  });
  const auditBusy=new Set<string>();const auditBudgets=new Map<string,{time:number;count:number}>();
  app.get('/api/audit/:id',async(req,res,next)=>{const id=uuidSchema.safeParse(req.params.id);if(!id.success){res.status(400).json({error:'Invalid case.'});return;}try{res.json(auditSources(id.data,await store!.disputeRead!(res.locals.actor,id.data)));}catch(e){next(e);}});
  app.post('/api/audit/:id',async(req,res,next)=>{const id=uuidSchema.safeParse(req.params.id),rid=uuidSchema.safeParse(req.body?.responseId);if(!id.success||!rid.success||Object.keys(req.body??{}).join(',')!=='responseId'){res.status(400).json({error:'Select an exact recorded response.'});return;}const actor=res.locals.actor;try{const sources=auditSources(id.data,await store!.disputeRead!(actor,id.data));if(!sources.responses.some(r=>r.id===rid.data)){res.status(400).json({error:'No such substantive response in this case.'});return;}const now=Date.now();let budget=auditBudgets.get(actor);if(!budget||now-budget.time>=600000){budget={time:now,count:0};if(auditBudgets.size>=256)auditBudgets.delete(auditBudgets.keys().next().value!);auditBudgets.set(actor,budget);}if(auditBusy.has(actor)||auditBusy.size>=2||budget.count>=4){res.status(429).json({error:'AUDIT_BUSY_OR_RATE_LIMITED'});return;}budget.count++;auditBusy.add(actor);try{res.json({sources,responseId:rid.data,...await generateAudit(sources,rid.data)});}finally{auditBusy.delete(actor);}}catch(e){next(e);}});
  app.get('/api/disputes/:id',async(req,res,next)=>{const id=uuidSchema.safeParse(req.params.id);if(!id.success){res.status(400).json({error:'Invalid case.'});return;}try{res.json(await store!.disputeRead!(res.locals.actor,id.data));}catch(e){next(e);}});
  app.post('/api/disputes/:id',async(req,res,next)=>{const id=uuidSchema.safeParse(req.params.id),key=uuidSchema.safeParse(req.get('Idempotency-Key')),body=disputeSchema.safeParse(req.body);if(!id.success||!key.success||!body.success){res.status(400).json({error:'Invalid dispute.'});return;}try{res.json(await store!.disputeSubmit!(res.locals.actor,id.data,key.data,body.data));}catch(e){next(e);}});
  app.get('/api/escalation/:id',async(req,res,next)=>{const id=uuidSchema.safeParse(req.params.id);if(!id.success){res.status(400).json({error:'Invalid case.'});return;}try{res.json(await store!.escalationRead!(res.locals.actor,id.data));}catch(e){next(e);}});
  app.post('/api/escalation/:id/:action',async(req,res,next)=>{
    const id=uuidSchema.safeParse(req.params.id),key=uuidSchema.safeParse(req.get('Idempotency-Key'));const action=String(req.params.action);
    const schema=Object.hasOwn(escalationCommands,action)?escalationCommands[action as EscalationAction]:null;const input=schema?.safeParse(req.body);
    if(!id.success||!key.success||!input?.success){res.status(400).json({error:'Invalid escalation command. Roles, authorities and timestamps are server-assigned.'});return;}
    try{res.json(await store!.escalationCommand!(res.locals.actor,id.data,key.data,action,input.data));}catch(e){next(e);}
  });
  const intakeBusy=new Set<string>();const intakeCounts=new Map<string,{start:number;count:number}>();
  app.post('/api/intake/drafts',async(req,res,next)=>{
    const key=uuidSchema.safeParse(req.get('Idempotency-Key')),input=generationSchema.safeParse(req.body);if(!key.success||!input.success){res.status(400).json({error:'Invalid intake request.'});return;}
    const actor=res.locals.actor;try{
      const prior=await store!.intakeCommand!(actor,'find',key.data,{});if(prior){if(JSON.stringify(prior.body.request)!==JSON.stringify(input.data)){/* Compare normalized JSON objects independent of key order. */const a=prior.body.request;if(a.text!==input.data.text||a.mode!==input.data.mode||JSON.stringify(a.evidenceIds)!==JSON.stringify(input.data.evidenceIds)){res.status(409).json({error:'Intake key conflict.'});return;}}res.json(prior);return;}
      const now=Date.now();let budget=intakeCounts.get(actor);if(!budget||now-budget.start>600000){budget={start:now,count:0};if(intakeCounts.size>=256)intakeCounts.delete(intakeCounts.keys().next().value!);intakeCounts.set(actor,budget);}
      if(intakeBusy.has(actor)||intakeBusy.size>=2||budget.count>=6){res.status(429).json({error:'PROCESSING_BUSY_OR_RATE_LIMITED'});return;}budget.count++;intakeBusy.add(actor);
      try{const result=await buildIntake(config,store as ReturnType<typeof caseStore>,actor,res.locals.token,input.data);res.status(201).json(await store!.intakeCommand!(actor,'save',key.data,result));}finally{intakeBusy.delete(actor);}
    }catch(error){next(error);}
  });
  app.post('/api/intake/:id/review',async(req,res,next)=>{
    const id=uuidSchema.safeParse(req.params.id),key=uuidSchema.safeParse(req.get('Idempotency-Key')),version=complaintSchema.omit({intakeReviewId:true}).safeParse(req.body);
    if(!id.success||!key.success||!version.success){res.status(400).json({error:'Review the valid complete complaint.'});return;}
    try{res.status(201).json(await store!.intakeCommand!(res.locals.actor,'review',key.data,{draftId:id.data,version:version.data}));}catch(error){next(error);}
  });
  app.get('/api/intake/cases/:id',async(req,res,next)=>{const id=uuidSchema.safeParse(req.params.id);if(!id.success){res.status(400).json({error:'Invalid case.'});return;}try{res.json(await store!.intakeCommand!(res.locals.actor,'read',id.data,{caseId:id.data}));}catch(e){next(e);}});
  app.post('/api/intake/cases/:id/disposition',async(req,res,next)=>{const id=uuidSchema.safeParse(req.params.id),key=uuidSchema.safeParse(req.get('Idempotency-Key'));if(!id.success||!key.success||!req.body||Object.keys(req.body).sort().join(',')!=='reason,status'){res.status(400).json({error:'Invalid disposition.'});return;}try{res.status(201).json(await store!.intakeCommand!(res.locals.actor,'disposition',key.data,{caseId:id.data,...req.body}));}catch(e){next(e);}});
  let evidenceRequests=0;
  app.use('/api/evidence',(_req,res,next)=>{if(evidenceRequests>=2){res.status(503).json({error:'Evidence service busy. Retry.'});return;}evidenceRequests++;let ended=false;const release=()=>{if(!ended){ended=true;evidenceRequests--;}};res.once('finish',release);res.once('close',release);next();});
  app.post('/api/evidence',express.raw({type:'application/octet-stream',limit:evidenceLimits.fileBytes}),async(req,res,next)=>{
    try{
      const id=uuidSchema.parse(req.get('Idempotency-Key'));const name=decodeURIComponent(req.get('X-Evidence-Name')??'');
      if(!name.length||name.length>240||/[\x00-\x1f\x7f]/.test(name)||!Buffer.isBuffer(req.body))throw Object.assign(Error('Invalid upload'),{code:'22023'});
      const type=validatedType(req.body);const hash=fingerprint(req.body);const path=res.locals.actor+'/'+id;
      const storage=privateStorage(config.url!,config.key!,res.locals.token);
      const response=await storage.upload(path,req.body,type);await response.body?.cancel();
      const stored=await storage.read(path);
      if(stored.length!==req.body.length||fingerprint(stored)!==hash||validatedType(stored)!==type)throw Object.assign(Error('Upload conflict'),{code:'HC409'});
      res.status(201).json(await store!.evidenceStage!(res.locals.actor,id,name,type,stored.length,hash));
    }catch(error){if((error as {name?:string}).name==='ZodError'){res.status(400).json({error:'Invalid upload identifier.'});return;}next(error);}
  });
  app.get('/api/evidence/:id/:action',async(req,res,next)=>{
    try{
      const id=uuidSchema.safeParse(req.params.id);if(!id.success||!['download','verify'].includes(String(req.params.action))){res.status(400).json({error:'Invalid evidence request.'});return;}
      const file=await store!.evidenceGet!(res.locals.actor,id.data);
      const bytes=await privateStorage(config.url!,config.key!,res.locals.token).read(file.object_path);
      if(req.params.action==='verify'){res.json({id:id.data,state:bytes.length===file.byte_count&&fingerprint(bytes)===file.sha256?'verified':'mismatch'});return;}
      res.set({'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename=\"evidence\"; filename*=UTF-8''"+encodeURIComponent(safeFilename(file.display_name)),'Content-Security-Policy':"sandbox; default-src 'none'"});res.send(bytes);
    }catch(error){next(error);}
  });
  app.get('/api/records/:id',async(req,res,next)=>{
    const id=uuidSchema.safeParse(req.params.id);if(!id.success){res.status(400).json({error:'Invalid record ID.'});return;}
    try{if(!store?.recordRead){res.status(503).json({error:'Verification unavailable.'});return;}res.json(await (store.recordBundle??store.recordRead)(res.locals.actor,id.data));}catch(error){next(error);}
  });
  app.post('/api/complaints',async(req,res,next)=>{
    const key=uuidSchema.safeParse(req.get('Idempotency-Key')); const payload=complaintSchema.safeParse(req.body);
    if(!key.success||!payload.success){res.status(400).json({error:'Provide a UUID Idempotency-Key and valid fictional complaint. Fields outside the form are not accepted.'});return;}
    try{const receipt=await store!.submit(res.locals.actor,key.data,payload.data);res.status(201).json(receipt);}catch(error){next(error);}
  });
  app.get('/api/complaints/:id',async(req,res,next)=>{
    const id=uuidSchema.safeParse(req.params.id); if(!id.success){res.status(400).json({error:'Invalid complaint ID.'});return;}
    try{const record=await store!.read(res.locals.actor,id.data);if(!record){res.status(404).json({error:'Complaint not found.'});return;}res.json(record);}catch(error){next(error);}
  });
  app.get('/api/workflow',async(_req,res,next)=>{
    try { res.json(await store!.workflowRead!(res.locals.actor)); } catch(error){next(error);}
  });
  app.get('/api/workflow/:id',async(req,res,next)=>{
    const id=uuidSchema.safeParse(req.params.id); if(!id.success){res.status(400).json({error:'Invalid case ID.'});return;}
    try { const value=await store!.workflowRead!(res.locals.actor,id.data);if(!value){res.status(404).json({error:'Not found.'});return;}res.json(value); }catch(error){next(error);}
  });
  app.post('/api/workflow/:id/:action',async(req,res,next)=>{
    const id=uuidSchema.safeParse(req.params.id),key=uuidSchema.safeParse(req.get('Idempotency-Key'));
    if(!id.success||!key.success||!['release','acknowledge','response'].includes(String(req.params.action))){res.status(400).json({error:'Invalid workflow command.'});return;}
    try{res.status(201).json(await store!.workflowCommit!(res.locals.actor,id.data,key.data,String(req.params.action),req.body));}catch(error){next(error);}
  });
  app.use('/api',(_req,res)=>res.status(404).json({error:'No such API route.'}));
  app.use(express.static(path.resolve('dist/web')));
  app.get('/{*path}',(_req,res)=>res.sendFile(path.resolve('dist/web/index.html')));
  app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    const intakeCode=(error as {intakeCode?:string}).intakeCode;
    if(intakeCode){res.status(intakeCode==='SOURCE_DENIED'?403:503).json({error:intakeCode});return;}
    const code=(error as {code?:string}).code;
    if(code==='42501'){res.status(403).json({error:'Denied.'});return;}
    if(code==='22023'||code==='22P02'){res.status(400).json({error:'Invalid workflow content or transition.'});return;}
    if(code==='HC409'){res.status(409).json({error:'This submission key was already used with different content. Start a new submission.'});return;}
    if((error as {type?:string}).type==='entity.too.large'){res.status(413).json({error:'Request too large.'});return;}
    if(error instanceof SyntaxError){res.status(400).json({error:'Invalid JSON.'});return;}
    res.status(503).json({error:'The complaint service is unavailable. Your submission has not been confirmed. Retry with the same submission key.'});
  });
  return app;
}
