import express from 'express';
import path from 'node:path';
import { complaintSchema, uuidSchema } from '../domain/complaint.js';
import type { configuration } from './config.js';
import type { caseStore } from './database.js';
import { complaintRequestLimitBytes } from './request-limits.js';
type Store=Pick<ReturnType<typeof caseStore>,'submit'|'read'> & Partial<Pick<ReturnType<typeof caseStore>,'workflowRead'|'workflowCommit'>>;
type Dependencies={config:ReturnType<typeof configuration>; store?:Store; verify?:(token:string)=>Promise<string|null>};
export function createApp({config,store,verify}:Dependencies) {
  const app=express(); app.disable('x-powered-by');
  app.use((_req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});next();});
  app.use(express.json({limit:complaintRequestLimitBytes}));
  app.get('/api/health',(_req,res)=>res.json({status:'ok',configured:config.ready,stage:'task-01-foundation'}));
  app.get('/api/config',(_req,res)=>res.json(config.ready?{ready:true,url:config.url,publishableKey:config.key}:{ready:false,message:'Dedicated Supabase configuration is needed. No complaint can be submitted yet.'}));
  app.use('/api',async(req,res,next)=>{
    const match=/^Bearer ([^\s]+)$/.exec(req.headers.authorization??'');
    if(!match){res.status(401).json({error:'Sign in with a managed citizen account.'});return;}
    if(!config.ready||!store||!verify){res.status(503).json({error:'SETUP_NEEDED'});return;}
    try {const actor=await verify(match[1]); if(!actor||!uuidSchema.safeParse(actor).success){res.status(401).json({error:'Invalid or expired credentials.'});return;} res.locals.actor=actor;next();} catch {res.status(503).json({error:'Authentication service unavailable. Please retry.'});}
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
