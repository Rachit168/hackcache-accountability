import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const main=readFileSync(new URL('../web/main.tsx',import.meta.url),'utf8');
const welcome=readFileSync(new URL('../web/welcome.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
const intake=readFileSync(new URL('../web/intake-assistant.tsx',import.meta.url),'utf8');
const guidance=readFileSync(new URL('../web/guidance.tsx',import.meta.url),'utf8');

describe('UX structural regressions (source checks, not browser proof)',()=>{
 it('shows only one language picker on the website',()=>{
  expect(main).toContain('<LanguageToggle language={language}');
  expect(welcome).not.toContain('welcome-language');
  expect(welcome).not.toContain('setLanguage(');
 });
 it('keeps staff-only access reachable but out of the citizen header',()=>{
  expect(main).toContain('<Link to="/staff">{language');
  expect(main).not.toContain('<Link to="/staff">{language===\'hi\'?\'कार्यालय डेमो\'');
  expect(main).toContain('<Route path="/staff" element={<StaffPortal');
 });
 it('maintains separate operator and citizen storage identities',()=>{
  expect(main).toContain("storageKey:'janvaani-operator-session'");
  expect(main).toContain("storageKey:'sb-'");
  expect(main).toContain('StaffSession client={client}');
  expect(main).toContain('const operatorApi=useCallback');
  expect(main).not.toContain('StaffSession client={auth}');
 });
 it('only mounts response-related workspace when it is relevant',()=>{
  expect(main).toContain("activePanel==='response'||activePanel==='audit'||activePanel==='next'");
  expect(main).toContain("setResponseCheck(value.responses?.length?'available':'missing')");
 });
 it('keeps a scrollable editorial landing page without a card grid',()=>{
  expect(welcome).toContain('className="welcome-copy"');
  expect(welcome).toContain('className="welcome-process"');
  expect(welcome).not.toContain('className="welcome-start"');
  expect(welcome).not.toContain('className="welcome-features"');
  expect(css).toContain('--shadow-soft:none;--shadow-lift:none;');
 });
 it('keeps issue choice options native, keyboard-accessible radio inputs',()=>{
  expect(main).toContain('className="choice-pill"');
  expect(main).toContain('type="radio" name={\'type-\'+field}');
  expect(main).toContain('className="remove-concern"');
 });
 it('provides clearly separated recording and help actions',()=>{
  expect(intake).toContain('className="recording-preview"');
  expect(intake).toContain('className="recording-actions"');
  expect(intake).toContain('className="processing-choice"');
  expect(guidance).toContain('aria-expanded={expanded.includes(c.id)}');
  expect(guidance).toContain('Visit official source');
 });
});
