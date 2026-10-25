import React,{useState} from 'react';
import {Link} from 'react-router-dom';
import type {Language} from './i18n';

export function Welcome({language,signedIn,ready,onStart,busy}:{language:Language;setLanguage:(next:Language)=>void;signedIn:boolean;ready:boolean;onStart:()=>void;busy:boolean}){
 const hi=language==='hi';
 return <div className="welcome-page">
  <section className="welcome-hero" aria-labelledby="home-title">
   <div className="welcome-copy">
    <p className="eyebrow">{hi?'नागरिक की आवाज़, दर्ज जवाब':'For people who want answers'}</p>
    <h1 id="home-title">{hi?'आपकी शिकायत। आपकी आवाज़। एक स्पष्ट रिकॉर्ड।':'Your complaint. Your voice. A clearer record.'}</h1>
    <p className="welcome-summary">{hi?'जो हुआ, उसे अपने शब्दों में लिखें। ज़रूरी सबूत जोड़ें। फिर देखें कि दर्ज जवाब में आपकी कौन-सी बात शामिल है।':'Describe what happened in your own words. Attach relevant evidence. See what a recorded response addresses—and what it does not.'}</p>
    <div className="welcome-actions">
     <Link className="primary-link" to="/file">{hi?'शिकायत दर्ज करें':'File a complaint'} <span aria-hidden="true">→</span></Link>
     <Link className="quiet-link" to="/cases">{hi?'पुरानी शिकायत देखें':'Open a previous receipt'}</Link>
    </div>
    <p className="welcome-note"><strong>{hi?'हैकाथॉन डेमो':'Hackathon demo'}:</strong> {hi?'यह असली सरकारी शिकायत पोर्टल नहीं है। कोई शिकायत सरकारी कार्यालय को नहीं भेजी जाती। काल्पनिक जानकारी ही दें।':'Not a government portal. Nothing is sent to a real office. Please use fictional details only.'}</p>
   </div>
   <div className="welcome-illustration" aria-label={hi?'शिकायत दर्ज करें, रिकॉर्ड देखें और जवाब जाँचें':'Three-step illustration: record, follow, check'} role="img">
    <div className="illustration-kicker">{hi?'आपकी शिकायत का सफ़र':'Your case journey'}</div>
    <div className="illustration-step"><span className="illustration-number">01</span><div><strong>{hi?'अपनी बात बताएँ':'Tell your story'}</strong><small>{hi?'आपके शब्द और सबूत':'Your words and evidence'}</small></div><span className="illustration-symbol" aria-hidden="true">✎</span></div>
    <div className="illustration-connector"/>
    <div className="illustration-step"><span className="illustration-number">02</span><div><strong>{hi?'रिकॉर्ड सुरक्षित रखें':'Keep the record'}</strong><small>{hi?'निजी रसीद और इतिहास':'Private receipt and history'}</small></div><span className="illustration-symbol" aria-hidden="true">▤</span></div>
    <div className="illustration-connector"/>
    <div className="illustration-step"><span className="illustration-number">03</span><div><strong>{hi?'जवाब को जाँचें':'Review the reply'}</strong><small>{hi?'क्या कहा, क्या छूटा':'What was addressed or missed'}</small></div><span className="illustration-symbol" aria-hidden="true">✓</span></div>
    <p>{hi?'कोई सरकारी एकीकरण नहीं · मानव समीक्षा ज़रूरी':'Fictional workflow · Human review required'}</p>
   </div>
  </section>
  <section className="welcome-process" aria-labelledby="process-title">
   <p className="eyebrow">{hi?'यह कैसे काम करता है':'How it works'}</p>
   <h2 id="process-title">{hi?'एक आसान प्रक्रिया। ज़रूरी जानकारी पर आपका नियंत्रण।':'A simple process, with you in control.'}</h2>
   <div className="process-list">
    <article><span className="process-mark" aria-hidden="true">01</span><div><h3>{hi?'जो हुआ, लिखें':'Explain what happened'}</h3><p>{hi?'एक बार में एक सवाल। पहले घटना, फिर वे बातें जिनका जवाब चाहिए।':'One question at a time: your story, then the points you want answered.'}</p></div></article>
    <article><span className="process-mark" aria-hidden="true">02</span><div><h3>{hi?'साक्ष्य जोड़ें (ज़रूरी नहीं)':'Add evidence, if you have it'}</h3><p>{hi?'फ़ाइल या रिकॉर्डिंग जोड़ें। AI की मदद चाहें तो लें, लेकिन जमा करने से पहले पढ़ें।':'Add a file or recording. AI drafting is optional; you review everything before submitting.'}</p></div></article>
    <article><span className="process-mark" aria-hidden="true">03</span><div><h3>{hi?'रिकॉर्ड रखें और जवाब देखें':'Keep your receipt and review responses'}</h3><p>{hi?'निजी रसीद सँभालें। कोई जवाब दर्ज होने पर उसे अपने मूल मुद्दों से मिलाएँ।':'Keep your private receipt. If a response is recorded, compare it with your original concerns.'}</p></div></article>
   </div>
  </section>
  <section className="welcome-final" aria-labelledby="help-title"><div>
   <h2 id="help-title">{hi?'शिकायत दर्ज करने के लिए तैयार हैं?':'Ready to make your record?'}</h2>
   <p>{hi?'इस डेमो में असली व्यक्तिगत जानकारी न दें।':'Use only fictional personal details for this demonstration.'}</p>
   </div><Link className="primary-link" to="/file">{hi?'शुरू करें':'Get started'} <span aria-hidden="true">→</span></Link>
  </section>
  <p className="session-caution welcome-session">{hi?'आपके मामले का लिंक इसी ब्राउज़र के डेमो सत्र से जुड़ा है। अभी ईमेल से पुराने मामले वापस नहीं मिल सकते।':'Your receipt is tied to this browser’s demo identity. Email-based recovery is not available yet.'}</p>
  {!signedIn&&ready&&<div className="welcome-session-action"><button className="secondary-button" type="button" disabled={busy} onClick={onStart}>{hi?'इस ब्राउज़र में निजी डेमो सत्र शुरू करें':'Start a private demo session in this browser'}</button></div>}
 </div>;
}

export function FindCase({language}:{language:Language}){
 const [reference,setReference]=useState(''),hi=language==='hi';
 const valid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference.trim());
 return <section className="lookup-page"><Link to="/" className="quiet-link">← {hi?'होम':'Home'}</Link><div className="saved-account">
  <p className="eyebrow">{hi?'निजी केस':'Private case'}</p><h1>{hi?'अपनी रसीद खोलें':'Open your saved receipt'}</h1>
  <p>{hi?'रसीद से पूरा संदर्भ नंबर डालें। वही ब्राउज़र पहचान आवश्यक है जिससे इसे दर्ज किया था।':'Enter the reference on your receipt. You must still have the browser identity that submitted it.'}</p>
  <label className="field-label" htmlFor="case-lookup">{hi?'संदर्भ नंबर':'Receipt reference'}</label><input id="case-lookup" value={reference} onChange={e=>setReference(e.target.value)} autoComplete="off" spellCheck={false} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/>
  {valid?<Link className="primary-link" to={'/cases/'+reference.trim()}>{hi?'मामला खोलें':'Open case'} →</Link>:<p className="field-help">{hi?'पूरा संदर्भ नंबर दर्ज करें।':'Enter a complete case reference to continue.'}</p>}
  <p className="session-caution">{hi?'यह ईमेल लॉगिन नहीं है। खोए सत्र की दोबारा पहुँच अभी उपलब्ध नहीं है।':'This is not email login. Lost anonymous sessions cannot currently be recovered.'}</p>
 </div></section>;
}
