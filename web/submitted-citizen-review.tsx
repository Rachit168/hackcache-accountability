import React from 'react';
import {z} from 'zod';
import type {Language} from './i18n';

// Parse only citizen-authored, human-readable fields. An older saved version
// may include more fields; do not publish credentials, opaque IDs or internal
// JSON metadata as part of this summary.
const citizenViewSchema=z.object({
 narrative:z.string(),
 concerns:z.array(z.object({
  type:z.enum(['service','conduct','mixed']),
  wording:z.string()
 }).passthrough())
}).passthrough();

export function readCitizenReview(version:unknown){
 const result=citizenViewSchema.safeParse(version);
 if(!result.success)return null;
 return {narrative:result.data.narrative,concerns:result.data.concerns.map(({type,wording})=>({type,wording}))};
}

export function SubmittedCitizenReview({version,language}:{version:unknown;language:Language}){
 const hi=language==='hi';const saved=readCitizenReview(version);
 if(!saved)return <p role="status" className="field-help">{hi?'सहेजे गए नागरिक संस्करण का संक्षिप्त रूप उपलब्ध नहीं है। मूल रिकॉर्ड बदल नहीं गया है; रिकॉर्ड जाँच और सहायता इतिहास देखें।':'The saved citizen version cannot be presented in this summary format. The underlying record has not been edited; use record verification for further checks.'}</p>;
 const labels={en:{service:'Service or delay',conduct:'Staff behavior',mixed:'Service and staff behavior'},hi:{service:'सेवा या देरी',conduct:'व्यवहार',mixed:'सेवा और व्यवहार'}} as const;
 return <section className="citizen-review-readable" aria-label={hi?'नागरिक का सहेजा गया विवरण':'Submitted citizen version'}>
  <h4>{hi?'आपका जमा किया हुआ विवरण':'Your submitted account'}</h4>
  <p className="preserve">{saved.narrative}</p>
  <h4>{hi?'आपके जमा किए हुए सवाल':'Questions you submitted'}</h4>
  <ol className="citizen-review-issues">{saved.concerns.map((item,i)=><li key={i}><strong>{labels[language][item.type]}</strong><p className="preserve">{item.wording}</p></li>)}</ol>
  <p className="field-help">{hi?'यह आपके अपने शब्द हैं, AI का लिखा संस्करण नहीं। मूल रिकॉर्ड सहेजा हुआ है और यहाँ संपादित नहीं होता।':'These are your own submitted words, not the AI’s rewrite. This is a read-only view of the retained version.'}</p>
 </section>;
}
