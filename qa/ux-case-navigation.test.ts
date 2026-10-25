import {describe,it,expect} from 'vitest';
import {adjacentCasePanel,casePanels,resolveCasePanel,type ResponseCheck} from '../web/case-navigation';

describe('citizen-facing response gating',()=>{
 for(const check of ['checking','missing','error'] as ResponseCheck[]){
  it('keeps office-only response tabs hidden when state is '+check,()=>{
   expect(casePanels(check)).toEqual(['overview','evidence','timeline','next']);
   expect(resolveCasePanel('response',check)).toBe('overview');
   expect(resolveCasePanel('audit',check)).toBe('overview');
   expect(resolveCasePanel(null,check,true)).toBe('overview');
   expect(adjacentCasePanel('timeline',check,1)).toBe('next');
  });
 }
 it('reveals response and comparison only after confirmed substantive response',()=>{
  expect(casePanels('available')).toEqual(['overview','evidence','timeline','response','audit','next']);
  expect(resolveCasePanel('response','available')).toBe('response');
  expect(resolveCasePanel('audit','available')).toBe('audit');
 });
 it('preserves the deep-linked audit intent after the response list is confirmed',()=>{
  expect(resolveCasePanel(null,'available',true)).toBe('audit');
  expect(resolveCasePanel('evidence','available',true)).toBe('evidence');
 });
 it('rejects unexpected or forged section values',()=>{
  for(const value of ['../staff','office?role=admin','__proto__','', 'RESPONSE']){
   expect(resolveCasePanel(value,'available')).toBe('overview');
  }
 });
 it('keeps previous/next actions within the confirmed panels',()=>{
  expect(adjacentCasePanel('overview','available',-1)).toBeNull();
  expect(adjacentCasePanel('next','available',1)).toBeNull();
  expect(adjacentCasePanel('response','available',-1)).toBe('timeline');
  expect(adjacentCasePanel('timeline','available',1)).toBe('response');
  expect(adjacentCasePanel('response','missing',1)).toBeNull();
 });
});
