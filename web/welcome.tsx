import React,{useState} from 'react';
import {Link} from 'react-router-dom';
import type {Language} from './i18n';

export function Welcome({language,setLanguage,signedIn,ready,onStart,busy}:{language:Language;setLanguage:(next:Language)=>void;signedIn:boolean;ready:boolean;onStart:()=>void;busy:boolean}){
 const hi=language==='hi';
 return <div className="welcome-page">
  <section className="welcome-hero">
   <div className="welcome-intro"><p className="eyebrow">{hi?'आपकी आवाज़, आपके शब्दों में':'Your voice, in your own words'}</p>
    <h1>{hi?'अपनी बात दर्ज करें। हर जवाब पर नज़र रखें।':'Your concern deserves a clear answer.'}</h1>
    <p>{hi?'जनवाणी मूल बात, मुद्दे और साक्ष्य को जोड़ता है, ताकि पता चले कि जवाब में क्या बताया गया और क्या छूट गया।':'Janvaani keeps your original concerns and evidence together, so you can see what a response addresses and what it leaves unanswered.'}</p>
    <p className="demo-caution"><strong>{hi?'केवल हैकाथॉन प्रदर्शन':'Hackathon demonstration'}</strong> · {hi?'असली शिकायतें सरकारी कार्यालय में नहीं जातीं। केवल काल्पनिक जानकारी दें।':'No government office receives submissions. Use fictional details only.'}</p>
   </div>
   <div className="welcome-start">
    <p className="eyebrow">{hi?'पहले अपनी भाषा चुनें':'First, choose your language'}</p>
    <div className="welcome-language" role="group" aria-label={hi?'भाषा चुनें':'Choose a language'}>
     <button type="button" className={hi?'selected':''} onClick={()=>setLanguage('hi')}>हिंदी <span>Hindi</span></button>
     <button type="button" className={!hi?'selected':''} onClick={()=>setLanguage('en')}>English <span>अंग्रेज़ी</span></button>
    </div>
    <h2>{hi?'आप क्या करना चाहते हैं?':'What would you like to do?'}</h2>
    <Link className="primary-link" to="/file">{hi?'नई शिकायत दर्ज करें':'File a complaint'} <span aria-hidden="true">→</span></Link>
    <Link className="quiet-link" to="/cases">{hi?'पिछली रसीद खोलें':'Open a previous receipt'} <span aria-hidden="true">→</span></Link>
    {!signedIn&&ready&&<button className="secondary-button" type="button" disabled={busy} onClick={onStart}>{hi?'निजी डेमो सत्र शुरू करें':'Start a private demo session'}</button>}
    <p className="session-caution">{hi?'डेमो सत्र इसी ब्राउज़र में रहता है। ब्राउज़र डेटा मिटाने पर पुराने मामले वापस नहीं मिलेंगे।':'This demo identity stays in this browser. Clearing its data may permanently prevent access to existing cases.'}</p>
   </div>
  </section>
  <section className="welcome-features" aria-label={hi?'सुविधाएँ':'Capabilities'}>
   <article className="feature-panel"><span>01</span><h3>{hi?'मूल शब्द सुरक्षित':'Keep your own words'}</h3><p>{hi?'मूल शिकायत और पुष्टि किए गए साक्ष्य साथ रहते हैं।':'Your submitted story and confirmed evidence stay linked.'}</p></article>
   <article className="feature-panel"><span>02</span><h3>{hi?'जवाब की जाँच':'Check the reply'}</h3><p>{hi?'हर मुद्दे का जवाब से मिलान देखें। AI सुझाव असत्यापित होते हैं।':'See a concern-by-concern comparison. AI suggestions are unverified.'}</p></article>
   <article className="feature-panel"><span>03</span><h3>{hi?'अगला कदम':'Take the next step'}</h3><p>{hi?'निजी आपत्ति दर्ज करें और केस की प्रति डाउनलोड करें।':'Record your disagreement and download a private case package.'}</p></article>
  </section>
  <p className="staff-entry">{hi?'समीक्षक या नमूना कार्यालय कर्मी हैं?':'Demo reviewer or fictional office operator?'} <Link to="/staff">{hi?'कर्मचारी कार्यक्षेत्र':'Staff workspace'}</Link></p>
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
