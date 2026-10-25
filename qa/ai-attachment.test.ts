import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {INTAKE_DRAFT_INSTRUCTIONS} from '../server/intake-ai';

describe('AI attachment preserves citizen authorship (source-level wiring guard)',()=>{
 const main=readFileSync(new URL('../web/main.tsx',import.meta.url),'utf8');
 const assistant=readFileSync(new URL('../web/intake-assistant.tsx',import.meta.url),'utf8');
 const status=readFileSync(new URL('../web/assistant-attachment-status.tsx',import.meta.url),'utf8');
 it('does not overwrite the citizen account or concerns when choosing an AI suggestion',()=>{
  const start=main.indexOf('onApply={(draft:IntakeDraft)=>');
  const end=main.indexOf('/>',start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const handler=main.slice(start,end);
  expect(handler).toContain('setIntakeDraft(draft.id)');
  expect(handler).toContain('setDeclaration(false)');
  expect(handler).not.toContain('setNarrative(');
  expect(handler).not.toContain('setConcerns(');
  expect(handler).not.toContain('report.allegation.value');
  expect(main).toContain('<AssistantAttachmentStatus language={language}/>');
  expect(status).toContain('Your original story and questions remain unchanged');
  expect(main).toContain('Your own story and questions above were not replaced');
 });
 it('clearly labels the suggestion as supplementary and never auto-applies it',()=>{
  expect(assistant).toContain('Attach AI suggestions (keep my original text)');
  expect(assistant).toContain('Suggestions are saved separately for review');
  expect(assistant).toContain('onClick={()=>onApply(draft)}');
  expect(assistant).not.toContain('Only Apply changes the editor');
 });
 it('requests complete actionable questions instead of vague topic labels',()=>{
  expect(INTAKE_DRAFT_INSTRUCTIONS).toContain('complete answerable question');
  expect(INTAKE_DRAFT_INSTRUCTIONS).toContain('not a noun phrase or topic label');
  expect(INTAKE_DRAFT_INSTRUCTIONS).toContain('Copy quoted source text exactly');
 });
});
