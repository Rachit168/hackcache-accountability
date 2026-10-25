import React from 'react';
import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {SubmittedCitizenReview,readCitizenReview} from '../web/submitted-citizen-review';

const version={
 office:'SAMPLE_MUNICIPAL_DESK',
 category:'SAMPLE_MUNICIPAL_SERVICE',
 narrative:'On Monday, the fictional office was closed. <script>alert(1)</script>',
 concerns:[
  {type:'service',wording:'Why was the office closed during the published hours?'},
  {type:'mixed',wording:'What staff response and reopening information can be provided?'}
 ],
 declaration:true,
 extraCredential:'MUST-NOT-APPEAR-IN-CITIZEN-PANEL'
};
describe('readable citizen provenance and receipt evidence layout',()=>{
 it('renders authored account and ordered issues, not internal server JSON or credentials',()=>{
  const html=renderToStaticMarkup(<SubmittedCitizenReview version={version} language="en"/>);
  expect(html).toContain('Your submitted account');
  expect(html).toContain('Questions you submitted');
  expect(html).toContain('Why was the office closed');
  expect(html).toContain('What staff response');
  expect(html.indexOf('Why was the office closed')).toBeLessThan(html.indexOf('What staff response'));
  expect(html).not.toContain('MUST-NOT-APPEAR');
  expect(html).not.toContain('SAMPLE_MUNICIPAL_DESK');
  expect(html).not.toContain('declaration');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
 });
 it('renders Hindi labels without rewriting citizen wording',()=>{
  const html=renderToStaticMarkup(<SubmittedCitizenReview version={version} language="hi"/>);
  expect(html).toContain('आपका जमा किया हुआ विवरण');
  expect(html).toContain('सेवा और व्यवहार');
  expect(html).toContain(version.concerns[0].wording);
 });
 it('rejects malformed data in the preview rather than inventing a retained version',()=>{
  expect(readCitizenReview({narrative:42,concerns:[]})).toBeNull();
  expect(readCitizenReview({narrative:'X',concerns:[{type:'unknown',wording:'Y'}]})).toBeNull();
  const html=renderToStaticMarkup(<SubmittedCitizenReview version={null} language="en"/>);
  expect(html).toContain('cannot be presented in this summary format');
 });
 it('keeps full provider source and human review behind separate optional disclosures',()=>{
  const provenance=readFileSync(new URL('../web/intake-assistant.tsx',import.meta.url),'utf8');
  const section=provenance.slice(provenance.indexOf('export function IntakeProvenance('));
  expect(section).toContain('View your submitted account and questions');
  expect(section).toContain('Inspect AI suggestions, quotes and sources');
  expect(section).toContain('<SubmittedCitizenReview version={value.citizenReview.version} language={language}/>');
  expect(section).toContain('<Report draft={value} language={language}/>');
  expect(section).not.toContain('JSON.stringify(value.citizenReview.version');
  expect(section).toContain("value.flags.length>0");
  expect(section).toContain("'/intake/cases/'+id+'/disposition'");
 });
 it('lays out both views within responsive bounded sections',()=>{
  const style=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
  expect(style).toContain('.intake-provenance-disclosure>.citizen-review-readable');
  expect(style).toContain('.intake-provenance-disclosure>.report-draft');
  expect(style).toContain('@media(max-width:560px)');
  expect(style).toContain('.verification-limits');
  const verify=readFileSync(new URL('../web/record-verification.tsx',import.meta.url),'utf8');
  expect(verify).toContain('No uploaded evidence files are attached');
  expect(verify).toContain('Verification checks recorded-data consistency');
  expect(verify).toContain('What this verification cannot prove');
 });
});
