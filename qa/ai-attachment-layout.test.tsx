import React from 'react';
import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {AssistantAttachmentStatus} from '../web/assistant-attachment-status';

const main=readFileSync(new URL('../web/main.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
const assistant=readFileSync(new URL('../web/intake-assistant.tsx',import.meta.url),'utf8');

describe('AI attachment confirmation does not stick to wizard edges',()=>{
 it('renders an accessible confirmation with separate heading and explanation',()=>{
  const html=renderToStaticMarkup(<AssistantAttachmentStatus language="en"/>);
  expect(html).toContain('role="status"');
  expect(html).toContain('class="ai-attachment-confirmation"');
  expect(html).toContain('AI suggestions attached for review');
  expect(html).toContain('Your original story and questions remain unchanged.');
  expect(html).not.toContain('position:absolute');
 });
 it('preserves meaningful Hindi confirmation and no overwritten-text claim',()=>{
  const html=renderToStaticMarkup(<AssistantAttachmentStatus language="hi"/>);
  expect(html).toContain('role="status"');
  expect(html).toContain('आपकी लिखी कहानी और सवाल नहीं बदले हैं');
 });
 it('wraps all direct wizard notices with inset classes instead of bare paragraphs',()=>{
  expect(main).toContain('{intakeDraft&&<AssistantAttachmentStatus language={language}/>}')
  expect(main).toContain('className="wizard-evidence-notice"');
  expect(main).not.toContain('{intakeDraft&&<p role="status">');
  expect(assistant).toContain('className="ai-apply-help"');
 });
 it('sets real desktop/mobile padding and prevents long text overflow',()=>{
  expect(styles).toContain('.wizard-evidence>.ai-attachment-confirmation');
  expect(styles).toContain('.wizard-evidence>.wizard-evidence-notice');
  expect(styles).toContain('margin:18px 27px 22px;padding:16px 19px');
  expect(styles).toContain('margin:16px 16px 19px;padding:14px');
  expect(styles).toContain('overflow-wrap:anywhere');
  expect(styles).toContain('.wizard-evidence .ai-apply-help');
  expect(styles).toContain('box-sizing:border-box');
 });
});
