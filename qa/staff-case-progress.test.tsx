import {describe,expect,it,vi} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {staffCaseJourney} from '../web/staff-case-progress';
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
  expect(last.target).toBe('evidence');
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
