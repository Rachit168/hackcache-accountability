import {beforeEach,describe,it,expect,vi} from 'vitest';
import type {ReactElement,ReactNode} from 'react';
const hooks=vi.hoisted(()=>({states:[] as unknown[],cleanups:[] as (()=>void)[],index:0}));
vi.mock('react',async importOriginal=>{
 const original=await importOriginal<typeof import('react')>();
 const overrides={useState:(initial:unknown)=>{const i=hooks.index++;hooks.states[i]=initial;return [initial,(v:unknown)=>{hooks.states[i]=v;}];},useRef:(current:unknown)=>({current}),useEffect:(effect:()=>void|(()=>void))=>{const cleanup=effect();if(cleanup)hooks.cleanups.push(cleanup);}};
 return {...original,...overrides,default:{...original,...overrides}};
});
import {IntakeAssistant,type IntakeDraft} from '../web/intake-assistant';
function findGenerate(node:ReactNode):ReactElement<{onClick:()=>Promise<void>;children?:ReactNode}>|undefined{
 if(!node||typeof node!=='object')return;
 if(Array.isArray(node)){for(const child of node){const found=findGenerate(child);if(found)return found;}return;}
 const e=node as ReactElement<{onClick:()=>Promise<void>;children?:ReactNode}>;
 if(e.type==='button'&&e.props.children==='Generate source-linked draft')return e;
 return findGenerate(e.props?.children);
}
const draft=(id:string)=>({id,body:{sources:[],report:{},provenance:{mode:'live',provider:'fixture'}}}) as unknown as IntakeDraft;
beforeEach(()=>{hooks.states=[];hooks.cleanups=[];hooks.index=0;});
describe('actual assistant request handlers with controlled hooks',()=>{
 it('ignores an older response, creates a new revision key after success, and never automatically applies edits',async()=>{
  const requests:{resolve:(v:IntakeDraft)=>void;key:string}[]=[];const apply=vi.fn();
  const api=vi.fn((_path:string,init?:RequestInit)=>new Promise<IntakeDraft>(resolve=>requests.push({resolve,key:(init!.headers as Record<string,string>)['Idempotency-Key']})));
  const tree=IntakeAssistant({api:api as never,language:'en',text:'Citizen edited account',evidenceIds:[],disabled:false,onSource:vi.fn(),onApply:apply});
  const click=findGenerate(tree)!.props.onClick;
  const older=click(),newer=click();expect(requests[0].key).toBe(requests[1].key);
  requests[1].resolve(draft('newer'));await newer;requests[0].resolve(draft('older'));await older;
  expect((hooks.states[1] as IntakeDraft).id).toBe('newer');expect(apply).not.toHaveBeenCalled();
  const revision=click();expect(requests[2].key).not.toBe(requests[1].key);requests[2].resolve(draft('revision'));await revision;
  expect((hooks.states[1] as IntakeDraft).id).toBe('revision');expect(JSON.parse(api.mock.calls[2][1]!.body as string).text).toBe('Citizen edited account');
 });
 it('keeps the request identity after provider failure for an unchanged retry',async()=>{
  let attempt=0;const keys:string[]=[];const api=vi.fn(async(_path:string,init?:RequestInit)=>{keys.push((init!.headers as Record<string,string>)['Idempotency-Key']);if(++attempt===1)throw Error('PROVIDER_UNAVAILABLE');return draft('retry');});
  const tree=IntakeAssistant({api:api as never,language:'en',text:'Unchanged citizen text',evidenceIds:[],disabled:false,onSource:vi.fn(),onApply:vi.fn()});const click=findGenerate(tree)!.props.onClick;
  await click();expect(hooks.states[3]).toContain('provider');await click();expect(keys[1]).toBe(keys[0]);expect((hooks.states[1] as IntakeDraft).id).toBe('retry');
 });
 it('a pending response cannot replace state after the assistant unmounts',async()=>{
  let resolve!:(v:IntakeDraft)=>void;const api=vi.fn(()=>new Promise<IntakeDraft>(r=>resolve=r));
  const tree=IntakeAssistant({api:api as never,language:'en',text:'Fictional',evidenceIds:[],disabled:false,onSource:vi.fn(),onApply:vi.fn()});const pending=findGenerate(tree)!.props.onClick();hooks.cleanups.forEach(cleanup=>cleanup());resolve(draft('stale'));await pending;expect(hooks.states[1]).toBeUndefined();
 });
});
