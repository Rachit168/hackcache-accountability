import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {staffCaseJourney,displayedWorkflowVersions,nextOfficeVersionAction} from '../web/staff-case-progress';
import {StaffCaseJourney} from '../web/staff-case-journey';

const released={id:'version-1'};
const ack={versionId:'version-1',action:'acknowledge'};
const answer={versionId:'version-1',action:'response'};
describe('staff case action journey (data-backed and role scoped)',()=>{
 it('shows reviewer assigned -> release -> response without falsely claiming resolution',()=>{
  const first=staffCaseJourney({kind:'reviewer',versions:[],history:[]},'en')!;
  expect(first.steps.map(s=>s.done)).toEqual([true,false,false]);
  expect(first.target).toBe('actions');
  expect(first.next).toContain('Prepare');
  const next=staffCaseJourney({kind:'reviewer',versions:[released],history:[ack]},'en')!;
  expect(next.steps.map(s=>s.done)).toEqual([true,true,false]);
  expect(next.target).toBe('history');
  const last=staffCaseJourney({kind:'reviewer',versions:[released],history:[ack,answer]},'en')!;
  expect(last.steps.map(s=>s.done)).toEqual([true,true,true]);
  expect(last.target).toBe('history');
  expect(last.explanation).toContain('does not verify');
 });
 it('requires actual acknowledgement of the latest office-facing version before suggesting response',()=>{
  const old={id:'version-older'};
  const view={kind:'office',versions:[old,released],history:[{...ack,versionId:old.id},{...answer,versionId:old.id}]};
  const step=staffCaseJourney(view,'en')!;
  expect(step.steps.map(s=>s.done)).toEqual([true,false,false]);
  expect(step.next).toContain('Acknowledge');
  expect(step.target).toBe('actions');
  const acked=staffCaseJourney({...view,history:[...view.history,ack]},'en')!;
  expect(acked.steps.map(s=>s.done)).toEqual([true,true,false]);
  expect(acked.next).toContain('Write a response');
  const replied=staffCaseJourney({...view,history:[...view.history,ack,answer]},'en')!;
  expect(replied.steps.map(s=>s.done)).toEqual([true,true,true]);
  expect(replied.target).toBe('history');
  expect(replied.explanation).toContain('unverified');
 });
 it('uses server role, not caller-chosen state; renders nothing for a citizen',()=>{
  expect(staffCaseJourney({kind:'citizen',versions:[released],history:[ack,answer]},'en')).toBeNull();
  const html=renderToStaticMarkup(<StaffCaseJourney view={{kind:'citizen'}} language="en" onNavigate={vi.fn()}/>);
  expect(html).toBe('');
 });
 it('limits office UI to one authorized version at a time while other roles retain their history',()=>{
  const versions=[{id:'a'},{id:'b'},{id:'c'}];
  expect(displayedWorkflowVersions('office',versions,'latest')).toEqual([{id:'c'}]);
  expect(displayedWorkflowVersions('office',versions,'a')).toEqual([{id:'a'}]);
  expect(displayedWorkflowVersions('office',versions,'not-in-server-response')).toEqual([]);
  expect(displayedWorkflowVersions('reviewer',versions,'latest')).toEqual(versions);
  expect(displayedWorkflowVersions('citizen',versions,'latest')).toEqual(versions);
  expect(displayedWorkflowVersions('office',undefined,'latest')).toEqual([]);
 });
 it('permits only the next office action per authorized version and prevents repeated acknowledgements',()=>{
  const old=[{versionId:'earlier',action:'response'}];
  expect(nextOfficeVersionAction('latest',old)).toBe('acknowledge');
  expect(nextOfficeVersionAction('latest',[...old,{versionId:'latest',action:'acknowledge'}])).toBe('response');
  expect(nextOfficeVersionAction('latest',[...old,{versionId:'latest',action:'acknowledge'},{versionId:'latest',action:'response'}])).toBe('complete');
  expect(nextOfficeVersionAction('latest',[{versionId:'latest',action:'response'}])).toBe('complete');
  expect(nextOfficeVersionAction('latest',undefined)).toBe('acknowledge');
 });
 it('renders editable office controls only in actions, never in case history',()=>{
  const src=readFileSync(new URL('../web/workflow.tsx',import.meta.url),'utf8');
  expect(src).toContain("view.kind==='office'&&!panel&&staffTab==='actions'&&(()=>{const action=nextOfficeVersionAction");
  expect(src).toContain("action==='complete'");
  expect(src).toContain('Response recorded for this version');
  expect(src).toContain("setStaffTab('history')");
  expect(src).toContain("const visibleHistory=view.kind==='office'");
  expect(src).toContain('visibleHistory.map(h=>');
 });
 it('has native next-action button, accessible milestone list and Hindi copy',()=>{
  const html=renderToStaticMarkup(<StaffCaseJourney view={{kind:'office',versions:[released],history:[ack]}} language="hi" onNavigate={vi.fn()}/>);
  expect(html).toContain('staff-journey-steps');
  expect(html).toContain('aria-current="step"');
  expect(html).toContain('type="button"');
  expect(html).toContain('जवाब');
  expect(html).not.toContain('100%');
  expect(html).not.toContain('Verified resolution');
 });
});
