import {describe,it,expect,afterEach,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {fixtureText,preparedReport,canonicalizeReportWhitespace,validateReport,type Source} from '../domain/intake-ai';
import {buildIntake} from '../server/intake-ai';
import type {caseStore} from '../server/database';

const source=(value:string):Source=>({id:'written',kind:'written account',sha256:'test',segments:[{location:'written account',text:value}]});
const original=source(fixtureText);

describe('bounded AI quote whitespace reconciliation',()=>{
 it('restores actual retained newline bytes without accepting an invented quote',()=>{
  const changed=source(fixtureText.replace('sample service','sample\nservice'));
  const raw=preparedReport([original]);
  expect(()=>validateReport(raw,[changed])).toThrow();
  const fixed=canonicalizeReportWhitespace(raw,[changed]);
  expect(fixed.allegation.citations[0].quote).toBe('The sample\nservice counter was closed on Monday.');
  expect(fixed.timeline[0].citations[0].quote).toBe('The sample\nservice counter was closed on Monday.');
  expect(()=>validateReport(fixed,[changed])).not.toThrow();
 });
 it('rejects invented quote text and mismatched source IDs',()=>{
  const wrong=preparedReport([original]);wrong.allegation.citations[0].quote='The counter never opened on Tuesday.';
  expect(()=>canonicalizeReportWhitespace(wrong,[original])).toThrow();
  const foreign=preparedReport([original]);foreign.allegation.citations[0].sourceId=randomUUID();
  expect(()=>canonicalizeReportWhitespace(foreign,[original])).toThrow();
 });
 it('does not treat regex symbols as wildcards or accept changed punctuation',()=>{
  const changed=source(fixtureText.replace('Monday.','MondayX'));
  expect(()=>canonicalizeReportWhitespace(preparedReport([original]),[changed])).toThrow();
 });
 it('refuses ambiguous whitespace-normalized matches rather than choosing one',()=>{
  const report=preparedReport([original]);
  const doubled=source(fixtureText.replace('sample service','sample\nservice')+'\nThe sample    service counter was closed on Monday.');
  expect(()=>canonicalizeReportWhitespace(report,[doubled])).toThrow();
 });
 it('does not repair uncited facts, missing-field claims, or schema additions',()=>{
  const uncited=preparedReport([original]);uncited.time.citations=[];
  expect(()=>canonicalizeReportWhitespace(uncited,[original])).toThrow();
  const missing=preparedReport([original]);missing.location.citations=[{sourceId:'written',segment:0,quote:'Monday'}];
  expect(()=>canonicalizeReportWhitespace(missing,[original])).toThrow();
  const extra={...preparedReport([original]),verifiedGuilt:true};
  expect(()=>canonicalizeReportWhitespace(extra,[original])).toThrow();
 });
});

afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('normalizes a provider whitespace-only quote in the actual live intake path with one call',async()=>{
 vi.stubEnv('OPENROUTER_API_KEY','fake-test-key');
 const text=fixtureText.replace('sample service','sample\nservice');
 const fetch=vi.fn(async()=>Response.json({choices:[{message:{content:JSON.stringify(preparedReport([original]))}}]}));
 vi.stubGlobal('fetch',fetch);
 const result=await buildIntake({ready:true} as never,{} as ReturnType<typeof caseStore>,randomUUID(),'fake-token',{text,evidenceIds:[],mode:'live'});
 expect(result.report.allegation.citations[0].quote).toContain('sample\nservice');
 expect(result.sources[0].segments[0].text).toBe(text);
 expect(fetch).toHaveBeenCalledTimes(1);
});
