import React,{useState} from 'react';
import {guidanceCards} from '../domain/guidance';
import type {Language} from './i18n';

// Guidance is informational, not a submission, legal determination or eligibility check.
export function Guidance({language,situation='awaiting'}:{language:Language;situation?:'awaiting'|'acknowledged'|'response'}){
 const hi=language==='hi';
 const [expanded,setExpanded]=useState<string[]>([]);
 function toggle(id:string){setExpanded(items=>items.includes(id)?items.filter(v=>v!==id):[...items,id]);}
 return <section className="saved-account guidance-view" aria-labelledby="guidance-title">
  <p className="eyebrow">{hi?'जानकारी और मदद':'Information and help'}</p>
  <h2 id="guidance-title">{hi?'आप आगे क्या कर सकते हैं?':'What can you do next?'}</h2>
  <p className="guidance-warning">{hi?'यह सामान्य जानकारी है। आपके क्षेत्र, विभाग और पात्रता की जाँच नहीं की गई। इस वेबसाइट ने किसी सरकारी कार्यालय में आवेदन या अपील नहीं भेजी है।':'These are general sources, not personalised legal advice. Your jurisdiction and eligibility have not been checked. No government application or appeal has been submitted.'}</p>
  <section className="next-step-checklist"><h3>{hi?'इस रिकॉर्ड से शुरुआत करें':'Start with this record'}</h3><p>{situation==='response'?(hi?'कार्यालय का जवाब दर्ज है। “कार्यालय जवाब” में उसका सटीक संस्करण पढ़ें, फिर हर मूल मुद्दे से तुलना करें। असहमति हो तो अपने शब्दों में आंतरिक आपत्ति दर्ज कर सकते हैं।':'An office response is recorded. Read its exact version under Office reply and compare each original issue. If you disagree, you can record an internal dispute in your own words.'):situation==='acknowledged'?(hi?'केवल प्राप्ति-स्वीकृति दर्ज है, ठोस जवाब नहीं। सारांश में “नया जवाब देखें” से दोबारा जाँचें। प्राप्ति-स्वीकृति समाधान नहीं है।':'An acknowledgement is recorded, but no substantive response. Use Check for a new reply in Overview. Acknowledgement does not establish resolution.'):(hi?'इस रिकॉर्ड में ठोस कार्यालय जवाब नहीं है। सारांश में “नया जवाब देखें” से दोबारा जाँचें; डेमो किसी सरकारी कार्यालय को स्वतः याद नहीं दिलाता।':'No substantive office response is recorded here. Use Check for a new reply in Overview; this demo sends no automatic government reminder.')}</p><ol><li>{hi?'मूल विवरण और हर मुद्दे की जाँच करें। अगला इच्छित कदम अपने शब्दों में लिख लें।':'Review your original account and each issue. Write down the next action you want in your own words.'}</li><li>{hi?'नीचे के निजी पैकेज में केवल आवश्यक साक्ष्य चुनें। मूल फ़ाइलें सुरक्षित रखें; अनावश्यक निजी जानकारी साझा न करें।':'Select only needed evidence in the private package below. Keep originals safe and avoid sharing unnecessary private information.'}</li><li>{hi?'बाहरी सहायता से पहले अपना राज्य/जिला और सेवा पहचानें। नीचे के आधिकारिक स्रोत से सही कार्यालय, प्रक्रिया और आवश्यक दस्तावेज़ की पुष्टि पूछें।':'Before seeking external help, identify your state/district and service. Use the official sources below to ask which office, procedure and documents apply.'}</li></ol><p className="field-help">{hi?'ये जनवाणी के संगठन-सुझाव हैं, आधिकारिक सूची या पात्रता का निर्णय नहीं। आपका क्षेत्राधिकार अभी अज्ञात है।':'These are Janvaani organisation suggestions, not an official checklist or eligibility decision. Your jurisdiction remains unknown.'}</p></section>
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
    <div className="guidance-expanded" id={'guidance-'+c.id} hidden={!expanded.includes(c.id)}><h4>{hi?'इस स्रोत से क्या पता चलता है':'What the source establishes'}</h4><p>{c.establishes[language]}</p><h4>{hi?'ध्यान रखने की सीमाएँ':'Important limits'}</h4><p>{c.limits[language]}</p><small>{hi?'स्रोत जाँचा गया':'Source checked'}: {c.verified}</small></div>
   </div>
  </article>)}</div>
 </section>;
}
