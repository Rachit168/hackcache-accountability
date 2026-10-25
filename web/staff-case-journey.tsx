import React from 'react';
import type {Language} from './i18n';
import {staffCaseJourney,type StaffJourneyView,type StaffCaseTab} from './staff-case-progress';

export function StaffCaseJourney({view,language,onNavigate}:{view:StaffJourneyView;language:Language;onNavigate:(tab:StaffCaseTab)=>void}){
 const summary=staffCaseJourney(view,language);
 if(!summary)return null;
 const hi=language==='hi';
 return <section className="staff-journey" aria-labelledby="staff-journey-title">
  <div className="staff-journey-heading">
   <div><p className="eyebrow">{hi?'इस मामले के अगले कदम':'Your work on this case'}</p><h3 id="staff-journey-title">{summary.next}</h3><p>{summary.explanation}</p></div>
   <button type="button" onClick={()=>onNavigate(summary.target)}>{summary.action} <span aria-hidden="true">→</span></button>
  </div>
  <ol className="staff-journey-steps" aria-label={hi?'रिकॉर्ड की गई प्रक्रिया':'Recorded case process'}>{summary.steps.map((s,i)=><li key={s.id} className={s.done?'done':s.current?'current':'future'} aria-current={s.current?'step':undefined}>
   <span className="staff-journey-marker" aria-hidden="true">{s.done?'✓':i+1}</span>
   <div><strong>{s.label}</strong><small>{s.done?(hi?'दर्ज':'Recorded'):s.current?(hi?'अगला':'Next'):(hi?'बाद में':'Not yet')}</small></div>
  </li>)}</ol>
  <p className="field-help">{hi?'केवल इस मामले के असली दर्ज कार्य दिखते हैं। कोई वास्तविक सरकारी प्रक्रिया, कानूनी समय-सीमा या सत्यापित समाधान नहीं।':'This shows only recorded actions in the fictional case workflow, not a real government process, legal deadline or verified resolution.'}</p>
 </section>;
}
