import {afterEach,describe,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {buildIntake,INTAKE_DRAFT_INSTRUCTIONS} from '../server/intake-ai';
import {createApp} from '../server/app';
import {fixtureText,preparedReport,validateReport,generationSchema,type Source} from '../domain/intake-ai';
import type {caseStore} from '../server/database';

const actor=randomUUID();
const config={ready:true,url:'https://fixture.supabase.co',key:'fixture-publishable',databaseUrl:'fixture'};
const written:Source={id:'written',kind:'written account',sha256:'fixture',segments:[{location:'written account',text:fixtureText}]};
const concerns=[
 {type:'service' as const,wording:'Why was the counter closed during stated opening hours?'},
 {type:'service' as const,wording:'What are the correct hours and when will services resume?'},
];
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

describe('citizen questions reach exactly one bounded AI request',()=>{
 it('adds separately identifiable requests without rewriting or exposing them as event evidence',async()=>{
  vi.stubEnv('OPENROUTER_API_KEY','unit-test-only');
  const fetch=vi.fn(async(_path:string|URL|Request,_options?:RequestInit)=>Response.json({choices:[{message:{content:JSON.stringify(preparedReport([written]))}}]}));
  vi.stubGlobal('fetch',fetch);
  const result=await buildIntake(config,{} as ReturnType<typeof caseStore>,actor,'token',{text:fixtureText,concerns,evidenceIds:[],mode:'live'});
  expect(result.request.concerns).toEqual(concerns);
  expect(result.sources[0].segments[0].text).toBe(fixtureText);
  expect(result.sources[1].id).toBe('requested-answers');
  expect(result.sources[1].segments.map(s=>s.text)).toEqual(concerns.map(c=>c.wording));
  expect(result.report.allegation.citations[0].sourceId).toBe('written');
  expect(fetch).toHaveBeenCalledTimes(1);
  const body=JSON.parse(fetch.mock.calls[0][1]!.body as string);
  const input=JSON.parse(body.messages[1].content);
  expect(input.map((s:{id:string})=>s.id)).toEqual(['written','requested-answers']);
  expect(input[1].segments[1].text).toBe(concerns[1].wording);
  expect(body.messages[1].content).not.toContain('sha256');
  expect(body.tools).toBeUndefined();
  expect(body.messages[0].content).toContain('timeline');
  expect(body.messages[0].content).toContain('EVERY distinct question');
  expect(INTAKE_DRAFT_INSTRUCTIONS).toContain('citizen’s questions, not evidence');
  expect(INTAKE_DRAFT_INSTRUCTIONS).toContain('DETAILS THE CITIZEN WOULD NEED TO SUPPLY');
  expect(INTAKE_DRAFT_INSTRUCTIONS).toContain('never include it in missing');
 });
 it('rejects attempting to establish events from a citizen question citation',()=>{
  const report=preparedReport([written]);
  const questions:Source={id:'requested-answers',kind:'citizen requested answers, not event evidence',sha256:'fixture',segments:[{location:'citizen question 1',text:'The counter was closed on Monday.'}]};
  report.allegation.citations=[{sourceId:'requested-answers',segment:0,quote:'The counter was closed on Monday.'}];
  expect(()=>validateReport(report,[written,questions])).toThrow('Citizen questions are not evidence');
  report.allegation=preparedReport([written]).allegation;
  report.timeline[0].citations=[{sourceId:'requested-answers',segment:0,quote:'The counter was closed on Monday.'}];
  expect(()=>validateReport(report,[written,questions])).toThrow('Citizen questions are not evidence');
 });
 it('still accepts older clients without concerns and rejects invalid concern types or empty answers',()=>{
  expect(generationSchema.safeParse({text:fixtureText,evidenceIds:[],mode:'live'}).success).toBe(true);
  expect(generationSchema.safeParse({text:fixtureText,evidenceIds:[],mode:'live',concerns:[{type:'service',wording:''}]}).success).toBe(false);
  expect(generationSchema.safeParse({text:fixtureText,evidenceIds:[],mode:'live',concerns:[{type:'fake',wording:'Tell me why'}]}).success).toBe(false);
 });
 it('rejects replaying the same intake key after changing only the questions',async()=>{
  const key=randomUUID();
  const prior={body:{request:{text:fixtureText,mode:'live',evidenceIds:[],concerns},sources:[],report:{}}};
  const store={intakeCommand:vi.fn(async()=>prior)};
  const app=createApp({config,store:store as unknown as ReturnType<typeof caseStore>,verify:async()=>actor});
  const post=(next:typeof concerns)=>request(app).post('/api/intake/drafts').auth('unit-token',{type:'bearer'}).set('Idempotency-Key',key).send({text:fixtureText,evidenceIds:[],mode:'live',concerns:next});
  expect((await post(concerns)).status).toBe(200);
  const changed=await post([{type:'service',wording:'Different question about reopening'}]);
  expect(changed.status).toBe(409);
  expect(store.intakeCommand).toHaveBeenCalledTimes(2);
 });
});
