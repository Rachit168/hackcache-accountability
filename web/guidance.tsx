import React,{useState} from 'react';
import {guidanceCards} from '../domain/guidance';
import type {Language} from './i18n';

// Guidance is informational, not a submission, legal determination or eligibility check.
export function Guidance({language}:{language:Language}){
 const hi=language==='hi';
 const [expanded,setExpanded]=useState<string[]>([]);
 function toggle(id:string){setExpanded(items=>items.includes(id)?items.filter(v=>v!==id):[...items,id]);}
 return <section className="saved-account guidance-view" aria-labelledby="guidance-title">
  <p className="eyebrow">{hi?'जानकारी और मदद':'Information and help'}</p>
  <h2 id="guidance-title">{hi?'आप आगे क्या कर सकते हैं?':'What can you do next?'}</h2>
  <p className="guidance-warning">{hi?'यह सामान्य जानकारी है। आपके क्षेत्र, विभाग और पात्रता की जाँच नहीं की गई। इस वेबसाइट ने किसी सरकारी कार्यालय में आवेदन या अपील नहीं भेजी है।':'These are general sources, not personalised legal advice. Your jurisdiction and eligibility have not been checked. No government application or appeal has been submitted.'}</p>
  <div className="guidance-options">{guidanceCards.map((c,i)=><article className="guidance-option" key={c.id}>
   <div className="guidance-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</div>
   <div className="guidance-content">
    <h3>{c.question[language]}</h3>
    <p>{c.guidance[language]}</p>
    <div className="guidance-actions">
     <button type="button" className="secondary-button" aria-expanded={expanded.includes(c.id)} aria-controls={'guidance-'+c.id} onClick={()=>toggle(c.id)}>
      {expanded.includes(c.id)?(hi?'जानकारी छिपाएँ':'Hide explanation'):(hi?'और जानकारी पढ़ें':'Read more details')} <span aria-hidden="true">{expanded.includes(c.id)?'−':'+'}</span>
     </button>
     <a className="source-link" href={c.url} target="_blank" rel="noopener noreferrer">{hi?'आधिकारिक स्रोत खोलें':'Visit official source'} <span aria-hidden="true">↗</span></a>
    </div>
    {expanded.includes(c.id)&&<div className="guidance-expanded" id={'guidance-'+c.id}><h4>{hi?'इस स्रोत से क्या पता चलता है':'What the source establishes'}</h4><p>{c.establishes[language]}</p><h4>{hi?'ध्यान रखने की सीमाएँ':'Important limits'}</h4><p>{c.limits[language]}</p><small>{hi?'स्रोत जाँचा गया':'Source checked'}: {c.verified}</small></div>}
   </div>
  </article>)}</div>
 </section>;
}
