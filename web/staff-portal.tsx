import React,{useState} from 'react';
import {Link} from 'react-router-dom';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Language} from './i18n';
import {StaffSession,WorkflowWorkspace} from './workflow';
import {signInStaff,verifyStaffSession,type StaffLoginResult} from './staff-login-state';
type StaffApi=<T=unknown>(path:string,init?:RequestInit)=>Promise<T>;
export const nextStaffSessionRevision=(revision:number)=>revision+1;

export function StaffPortal({client,active,onReady,onSignedOut,api,language}:{client?:SupabaseClient;active:boolean;onReady:()=>void;onSignedOut?:()=>void;api:StaffApi;language:Language}){
 const hi=language==='hi';const isCaseView=typeof window!=='undefined'&&/^\/staff\/[^/]+/.test(window.location.pathname);
 const [revision,setRevision]=useState(0);const [email,setEmail]=useState('');const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const [guide,setGuide]=useState(false);const [authIssue,setAuthIssue]=useState<StaffLoginResult['status']>();
 function sessionReady(){setRevision(nextStaffSessionRevision);setMessage('');setAuthIssue(undefined);onReady();}
 const authorizationMessage=(status:StaffLoginResult['status'])=>{
  switch(status){
   case 'invalid-credentials':return hi?'ईमेल या पासवर्ड सही नहीं है। अधिकृत कर्मचारी खाते से फिर प्रयास करें।':'Email or password was not accepted. Retry with your provisioned staff credentials.';
   case 'not-provisioned':return hi?'ईमेल/पासवर्ड मान्य थे, लेकिन इस खाते को समीक्षक या कार्यालय की भूमिका नहीं दी गई है। प्रोजेक्ट प्रशासक से भूमिका तय करवाएँ।':'Your credentials were accepted, but this account has no authorized reviewer or office role. Ask the project administrator to provision its role.';
   case 'service-unavailable':return hi?'सत्र मिला, लेकिन सर्वर से भूमिका की पुष्टि नहीं हुई। फिर जाँचें; नया खाता या भूमिका नहीं बनाई गई।':'Signed in, but staff authorization could not be confirmed. Retry the role check without creating a new identity.';
   case 'session-missing':return hi?'मान्य कर्मचारी सत्र नहीं मिला। ईमेल और पासवर्ड से फिर प्रवेश करें।':'No valid staff session is available. Sign in again with your credentials.';
   default:return '';
  }
 };
 async function importedSessionReady(){
  if(!client)throw Error('NO_CLIENT');
  const outcome=await verifyStaffSession(client.auth,()=>api('/workflow'));
  if(outcome.status==='authorized'){setAuthIssue(undefined);sessionReady();return;}
  setAuthIssue(outcome.status);setMessage(authorizationMessage(outcome.status));onSignedOut?.();
  throw Error('UNAUTHORIZED_STAFF_SESSION');
 }
 async function login(e:React.FormEvent){
  e.preventDefault();if(!client||busy)return;setBusy(true);setMessage('');setAuthIssue(undefined);
  try{
   const outcome=await signInStaff(client.auth,email,password,()=>api('/workflow'));
   setPassword('');
   if(outcome.status==='authorized'){sessionReady();return;}
   setAuthIssue(outcome.status);setMessage(authorizationMessage(outcome.status));onSignedOut?.();
  }catch{setAuthIssue('service-unavailable');setMessage(authorizationMessage('service-unavailable'));}
  finally{setBusy(false);}
 }
 async function retryAuthorization(){
  if(!client||busy)return;setBusy(true);setMessage('');
  try{
   const outcome=await verifyStaffSession(client.auth,()=>api('/workflow'));
   if(outcome.status==='authorized'){setAuthIssue(undefined);sessionReady();return;}
   setAuthIssue(outcome.status);setMessage(authorizationMessage(outcome.status));onSignedOut?.();
  }catch{setAuthIssue('service-unavailable');setMessage(authorizationMessage('service-unavailable'));}
  finally{setBusy(false);}
 }
 async function logout(){
  if(!client||busy)return;setBusy(true);setMessage('');
  try{const result=await client.auth.signOut();if(result.error)throw result.error;setRevision(nextStaffSessionRevision);onSignedOut?.();}
  catch{setMessage(hi?'साइन आउट नहीं हो सका। पुनः प्रयास करें।':'Could not sign out. Try again.');}
  finally{setBusy(false);}
 }
 return <div className="staff-portal">
  <p className="eyebrow">{hi?'सुरक्षित कर्मचारी कार्यक्षेत्र · काल्पनिक प्रदर्शन':'Restricted staff workspace · fictional demonstration'}</p>
  <div className="staff-heading"><div><h1>{hi?'कर्मचारी कार्यक्षेत्र':'Staff workspace'}</h1><p className="staff-intro">{hi?'नियुक्त समीक्षक और संबंधित कार्यालय कर्मी ही अपने अधिकार वाले मामले देख सकते हैं।':'Only appointed reviewers and office staff can open their server-authorized cases.'}</p></div>
  {active&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>void logout()}>{hi?'सुरक्षित साइन आउट':'Sign out securely'}</button>}</div>
  {message&&<p role="alert" className="error">{message}</p>}
  {!active&&authIssue==='service-unavailable'&&<button type="button" className="secondary-button staff-auth-retry" disabled={busy} onClick={()=>void retryAuthorization()}>{hi?'कर्मचारी भूमिका फिर जाँचें':'Retry staff role check'}</button>}
  {!active?<section className="staff-login" aria-labelledby="staff-login-title">
   <div className="staff-login-explain"><p className="eyebrow">{hi?'सिर्फ़ अधिकृत कर्मचारी':'Authorized staff only'}</p><h2 id="staff-login-title">{hi?'कर्मचारी खाते से साइन इन करें':'Sign in with your staff account'}</h2>
   <p>{hi?'इस पोर्टल पर नागरिक शिकायत संख्या या साधारण नागरिक सत्र से प्रवेश नहीं मिलेगा। खाते का अधिकार सर्वर पर तय किया जाता है।':'A complaint number or citizen session cannot authorize this portal. Your role and case permissions are checked on the server.'}</p>
   <div className="staff-login-symbol" aria-hidden="true">◎ <span>→</span> ▣ <span>→</span> ✓</div></div>
   <form className="staff-login-form" onSubmit={e=>void login(e)}>
    <label htmlFor="staff-email">{hi?'कर्मचारी ईमेल':'Staff email'}</label><input id="staff-email" type="email" autoComplete="username" required value={email} disabled={busy||!client} onChange={e=>setEmail(e.target.value)}/>
    <label htmlFor="staff-password">{hi?'पासवर्ड':'Password'}</label><input id="staff-password" type="password" autoComplete="current-password" required value={password} disabled={busy||!client} onChange={e=>setPassword(e.target.value)}/>
    <button type="submit" disabled={!client||busy}>{busy?(hi?'प्रवेश जाँचा जा रहा है…':'Checking access…'):(hi?'कार्यस्थल खोलें':'Open staff workspace')}</button>
    <p className="field-help">{hi?'कर्मचारी खाते प्रोजेक्ट प्रशासक द्वारा अलग से बनाए और अधिकृत किए जाते हैं।':'Staff accounts must be provisioned and assigned by the project administrator. There is no public sign-up.'}</p>
   </form>
   {import.meta.env.DEV&&<details className="staff-local-tool"><summary>{hi?'केवल स्थानीय परीक्षण: पुराना सत्र फ़ाइल':'Local development only: legacy test session file'}</summary><StaffSession client={client} onReady={importedSessionReady} language={language}/></details>}
  </section>:<>
   <nav className="staff-navigation" aria-label={hi?'कर्मचारी नेविगेशन':'Staff navigation'}>
    <Link to="/staff" aria-current={!isCaseView?'page':undefined}>{hi?'मेरा इनबॉक्स':'My case inbox'}</Link>
    <button type="button" className={guide?'active':''} onClick={()=>setGuide(v=>!v)} aria-expanded={guide}>{hi?'काम करने की प्रक्रिया':'Workflow guide'}</button>
   </nav>
   {guide&&<section className="staff-guide"><h2>{hi?'जिम्मेदारी और प्रक्रिया':'Responsibilities and workflow'}</h2>
    <div className="staff-guide-grid"><article><span>01</span><h3>{hi?'पहचान और अनुमति':'Identity & access'}</h3><p>{hi?'केवल सर्वर द्वारा आवंटित मामलों को खोलें।':'Open only the cases assigned by the server. No browser-selected roles.'}</p></article><article><span>02</span><h3>{hi?'मानवीय समीक्षा':'Human review'}</h3><p>{hi?'समीक्षक मूल रिकॉर्ड जाँचकर अलग कार्यालय संस्करण जारी करता है।':'The assigned reviewer checks evidence and releases a separate office-facing version.'}</p></article><article><span>03</span><h3>{hi?'कार्यालय कार्रवाई':'Office action'}</h3><p>{hi?'कार्यालय प्राप्ति स्वीकार करता है और जवाब देता है; जवाब समाधान का प्रमाण नहीं।':'The office acknowledges and responds; a response is not proof of resolution.'}</p></article></div>
   </section>}
   <div className="staff-permission-note" role="status">{hi?'सत्र मिला है। नीचे सूची और अनुमति सर्वर द्वारा जाँची जाएगी।':'Session present. The server verifies your role and case access below.'}</div>
   <WorkflowWorkspace key={revision} api={api} language={language}/>
  </>}
 </div>;
}
