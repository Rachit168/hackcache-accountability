import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { complaintSchema, type CaseRecord } from '../domain/complaint';
import { initialLanguage, translate, type CopyKey, type Language } from './i18n';
import { receiptFailureState } from './receipt-state';
import { createReceiptRecovery } from './receipt-recovery';
import { attachLeaveWarning, copyExactReference, fieldErrorSummary, shouldWarnOnLeave } from './form-usability';
import type { FormError } from './form-types';
import './style.css';
import {Welcome,FindCase} from './welcome';
import { StaffSession, WorkflowWorkspace } from './workflow';
import { RecordVerification } from './record-verification';
import { EvidenceUpload } from './evidence-upload';
import {IntakeAssistant,IntakeProvenance,type IntakeDraft} from './intake-assistant';
import {EscalationTimeline} from './escalation';
import {safeFilename,fileSize} from '../domain/intake-ai';
import {casePanels,resolveCasePanel,adjacentCasePanel,type CasePanel,type ResponseCheck} from './case-navigation';
import {operatorApiFor} from './operator-api';
import {authenticatedFetch} from './api-transport';
import {visitWizard,continueWizard} from './wizard-state';
import type {EvidenceSummary} from './evidence-summary';

type Config = { ready: boolean; url?: string; publishableKey?: string };
type ConcernType = 'service' | 'conduct' | 'mixed';
type Concern = { uiId: string; type: ConcernType; wording: string };
class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
type HotData = { auth?: SupabaseClient; root?: ReturnType<typeof createRoot> };
const hotData = import.meta.hot?.data as HotData | undefined;
let auth = hotData?.auth;

async function api<T = { error?: string }>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await authenticatedFetch(path,init,async()=>(await auth?.auth.getSession())?.data.session?.access_token);
  } catch { throw new ApiError(0, 'network'); }
  if(response.ok&&response.headers.get('Content-Disposition')?.startsWith('attachment')){const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;const encoded=response.headers.get('Content-Disposition')?.split("filename*=UTF-8''")[1];link.download=safeFilename(encoded?decodeURIComponent(encoded):'evidence');link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return undefined as T;}
  if(response.ok&&response.headers.get('Content-Type')?.startsWith('audio/'))return await response.blob() as T;
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new ApiError(response.status, body.error ?? 'request');
  return body;
}

function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const t = useMemo(() => (key: CopyKey, values?: Record<string, string | number>) => translate(language, key, values), [language]);
  const [config, setConfig] = useState<Config>();
  const [signedIn, setSignedIn] = useState(false);
  const [operatorClient,setOperatorClient] = useState<SupabaseClient>();
  const [operatorSignedIn,setOperatorSignedIn] = useState(false);
  const [error, setError] = useState<CopyKey>();
  const [busy, setBusy] = useState(false);
  const [configRetry, setConfigRetry] = useState(0);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t('pageTitle');
    try { window.localStorage.setItem('janvaani-language', language); } catch { /* Language selection remains available for this page. */ }
  }, [language]);
  function retryConfig() { setError(undefined); setConfig(undefined); setSignedIn(false); setConfigRetry((attempt) => attempt + 1); }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('config');
        const value = await response.json() as Config;
        if (!active) return;
        setConfig(value);
        if (value.ready && value.url && value.publishableKey) {
          auth ??= createClient(value.url, value.publishableKey,{auth:{storageKey:'sb-'+new URL(value.url).hostname.split('.')[0]+'-auth-token'}});
          // Operator auth is isolated from the citizen's browser identity, even during SPA navigation.
          const operator=createClient(value.url,value.publishableKey,{auth:{storageKey:'janvaani-operator-session'}});
          setOperatorClient(operator);
          const officeSession=await operator.auth.getSession();
          if(active)setOperatorSignedIn(!!officeSession.data.session);
          if (hotData) hotData.auth = auth;
          const { data } = await auth.auth.getSession();
          if (active) setSignedIn(!!data.session);
        }
      } catch { if (active) setError('serviceConnectionError'); }
    })();
    return () => { active = false; };
  }, [configRetry]);

  async function signIn() {
    setBusy(true); setError(undefined);
    try { const { error: signInError } = await auth!.auth.signInAnonymously(); if (signInError) throw signInError; setSignedIn(true); }
    catch { setError('sessionStartError'); }
    finally { setBusy(false); }
  }

  const operatorApi=useMemo(()=>operatorApiFor(operatorClient,api),[operatorClient]);

  return <>
    <div className="demo-strip"><strong>{t('demo')}</strong><span>{t('fictional')}</span></div>
    <header className="site-header">
      <span className="brand"><span className="brand-mark" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 24 24" fill="none"><path d="M5 5.5h14v10H10l-5 4v-14Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8 10.5h8M8 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></span><span>Janvaani</span></span>
      <div className="header-tools"><LanguageToggle language={language} setLanguage={setLanguage} t={t} /></div>
    </header>
    <main>
      <Routes>
        <Route path="/" element={<Welcome language={language} setLanguage={setLanguage} signedIn={signedIn} ready={!!config?.ready} onStart={()=>void signIn()} busy={busy}/>} />
        <Route path="/file" element={<>
          <div className="page-heading"><p className="sample-label">{t('desk')}</p><h1>{t('fileTitle')}</h1><p>{t('fileIntro')}</p></div>
          {!config ? error ? <section className="notice" role="alert"><h2>{t('unavailable')}</h2><p>{t(error)}</p><button type="button" onClick={retryConfig}>{t('retry')}</button></section> : <p className="live-message" role="status">{t('connecting')}</p>
            : !config.ready ? <section className="notice" role="status" aria-labelledby="setup-title"><h2 id="setup-title">{t('setupTitle')}</h2><p>{t('setupBody')}</p><button type="button" onClick={retryConfig}>{t('retry')}</button></section>
              : !signedIn ? <section className="session-notice" aria-labelledby="session-title"><div><h2 id="session-title">{t('startSession')}</h2><p>{t('sessionRecovery')}</p></div><button type="button" onClick={signIn} disabled={busy}>{busy ? t('starting') : t('startSession')}</button></section>
                : <p className="session" role="status">{t('sessionActive')}</p>}
          {error && config && <p className="error" role="alert">{t(error)}</p>}
          <ComplaintForm enabled={signedIn && !!config?.ready} language={language} t={t} />
        </>} />
        <Route path="/cases" element={<FindCase language={language}/>} />
        <Route path="/cases/:id" element={<CasePage ready={!!config?.ready} signedIn={signedIn} language={language} t={t} />} />
        <Route path="/staff" element={<StaffPortal client={operatorClient} active={operatorSignedIn} onReady={()=>setOperatorSignedIn(true)} api={operatorApi} language={language}/>} />
        <Route path="/staff/:id" element={<StaffPortal client={operatorClient} active={operatorSignedIn} onReady={()=>setOperatorSignedIn(true)} api={operatorApi} language={language}/>} />
        <Route path="*" element={<section className="notice"><h1>{t('pageNotFound')}</h1><Link to="/">{t('returnWorkspace')}</Link></section>} />
      </Routes>
      <section id="privacy" className="privacy" aria-labelledby="privacy-title"><h2 id="privacy-title">{t('usingDemo')}</h2><p>{t('privacyBody')}</p></section>
    </main>
    <footer><span>Janvaani · Hack Cache</span><span>{t('footerDemo')}</span><Link to="/staff">{language==='hi'?'डेमो कर्मचारी प्रवेश':'Staff demo access'}</Link></footer>
  </>;
}

type StaffApi=<T=unknown>(path:string,init?:RequestInit)=>Promise<T>;
function StaffPortal({client,active,onReady,api,language}:{client?:SupabaseClient;active:boolean;onReady:()=>void;api:StaffApi;language:Language}){
 const hi=language==='hi';
 return <div className="staff-portal">
  <p className="eyebrow">{hi?'केवल अनुमति प्राप्त डेमो कर्मचारी':'Provisioned demo operators only'}</p>
  <h1>{hi?'नमूना कार्यालय कार्यक्षेत्र':'Fictional office workspace'}</h1>
  <p className="staff-intro">{hi?'यह नागरिक शिकायत फॉर्म नहीं है। केवल इस प्रदर्शन के लिए नियुक्त समीक्षक या कार्यालय कर्मचारी यहाँ अपना निजी सत्र खोल सकते हैं।':'This is not the citizen complaint form. Only assigned demo reviewers and fictional office operators can open their private session here.'}</p>
  <div className="staff-steps">
   <p><strong>1.</strong> {hi?'समीक्षक को आवंटित मामला दिखता है और वह कार्यालय के लिए संस्करण जारी करता है।':'An assigned reviewer sees a case and releases an office-facing version.'}</p>
   <p><strong>2.</strong> {hi?'सही कार्यालय कर्मचारी जारी हुआ संस्करण देखकर प्राप्ति और जवाब दर्ज कर सकता है।':'The assigned office operator can acknowledge and respond to the released version.'}</p>
   <p><strong>3.</strong> {hi?'नागरिक अपने निजी केस में वह जवाब देख सकता है।':'The citizen can review the recorded response in their private case.'}</p>
  </div>
  {client?<StaffSession client={client} onReady={onReady} language={language}/>:<p role="status">{hi?'सुरक्षित डेमो कनेक्शन खुल रहा है…':'Connecting to the private demo service…'}</p>}
  {active?<><p className="staff-active" role="status">{hi?'डेमो कर्मचारी सत्र सक्रिय है। केवल आवंटित मामले दिखेंगे।':'Demo operator session active. Only assigned cases are accessible.'}</p><WorkflowWorkspace api={api} language={language}/></>:<p className="session-caution">{hi?'आपको आयोजक/प्रोजेक्ट ऑपरेटर से मिला निजी JSON सत्र चाहिए। नागरिक सत्र या रसीद यहाँ प्रवेश नहीं देते।':'You need a private JSON session provisioned by the project operator. A citizen session or receipt does not grant access.'}</p>}
 </div>;
}

type Translator = (key: CopyKey, values?: Record<string, string | number>) => string;
function LanguageToggle({ language, setLanguage, t }: { language: Language; setLanguage: (language: Language) => void; t: Translator }) {
  return <fieldset className="language-toggle"><legend>{t('language')}</legend><label><input type="radio" name="language" value="en" checked={language === 'en'} onChange={() => setLanguage('en')} /><span lang="en">{t('english')}</span></label><label><input type="radio" name="language" value="hi" checked={language === 'hi'} onChange={() => setLanguage('hi')} /><span lang="hi">{t('hindi')}</span></label></fieldset>;
}

function ComplaintForm({ enabled, language, t }: { enabled: boolean; language: Language; t: Translator }) {
  const navigate = useNavigate();
  const [progress,setProgress]=useState({current:0,furthest:0});const step=progress.current;const setStep=(next:number|((step:number)=>number))=>setProgress(p=>visitWizard(p,typeof next==='function'?next(p.current):next));
  const [narrative, setNarrative] = useState('');
  const [concerns, setConcerns] = useState<Concern[]>(() => [
    { uiId: crypto.randomUUID(), type: 'service', wording: '' },
  ]);
  const [declaration, setDeclaration] = useState(false);
  const [error, setError] = useState<CopyKey>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, FormError>>({});
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [attempt, setAttempt] = useState(false);
  const [evidenceIds,setEvidenceIds]=useState<string[]>([]);
  const [evidenceReady,setEvidenceReady]=useState(true);const [assistantReady,setAssistantReady]=useState(true);const [evidenceFiles,setEvidenceFiles]=useState<EvidenceSummary[]>([]);const [assistantFiles,setAssistantFiles]=useState<EvidenceSummary[]>([]);
  const [assistantIds,setAssistantIds]=useState<string[]>([]);
  const [intakeDraft,setIntakeDraft]=useState<string>();
  const reviewKey=useRef(crypto.randomUUID());
  const allEvidenceIds=[...new Set([...evidenceIds,...assistantIds])];
  const [summaryFocus, setSummaryFocus] = useState(0);
  const summaryRef = useRef<HTMLElement>(null);
  const submitted = useRef(false);
  const payload = { narrative, office: 'SAMPLE_MUNICIPAL_DESK', category: 'SAMPLE_MUNICIPAL_SERVICE', concerns: concerns.map(({ type, wording }) => ({ type, wording })), declaration, ...(allEvidenceIds.length?{evidenceIds:allEvidenceIds}:{}) };
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  const summaryItems = fieldErrorSummary(fieldErrors, concerns);
  const shouldWarn = shouldWarnOnLeave(narrative, concerns, declaration, submitted.current);
  useEffect(() => {
    if (!shouldWarn) return;
    return attachLeaveWarning(window);
  }, [shouldWarn]);
  useEffect(() => { if (summaryFocus) summaryRef.current?.focus(); }, [summaryFocus]);
  function changed(field?: string) {
    setError((current) => current === 'reviewFields' ? current : undefined);
    if (attempt) { setKey(crypto.randomUUID()); setAttempt(false); }
    if (field && fieldErrors[field]) {
      const next = { ...fieldErrors }; delete next[field];
      setFieldErrors(next);
      if (Object.keys(next).length === 0) setError(undefined);
    }
  }
  function updateConcern(uiId: string, update: Partial<Pick<Concern, 'type' | 'wording'>>) {
    setConcerns((items) => items.map((item) => item.uiId === uiId ? { ...item, ...update } : item));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if(step!==3){nextStep();return;}
    setError(undefined);
    if(!evidenceReady||!assistantReady)return;
    const parsed = complaintSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, FormError> = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'narrative') next.narrative = 'narrativeError';
        if (issue.path[0] === 'concerns' && typeof issue.path[1] === 'number') {
          const target = concerns[issue.path[1]];
          if (target) next[target.uiId] = 'concernError';
        }
        if (issue.path[0] === 'declaration') next.declaration = 'declarationError';
      }
      setFieldErrors(next); setError('reviewFields'); setSummaryFocus((value) => value + 1); setStep(next.narrative?0:concerns.some(c=>next[c.uiId])?1:3); return;
    }
    setFieldErrors({}); setBusy(true); setAttempt(true);
    try {
      const review=intakeDraft?await api<{id:string}>('/intake/'+intakeDraft+'/review',{method:'POST',headers:{'Idempotency-Key':reviewKey.current},body:JSON.stringify(parsed.data)}):undefined;
      const receipt = await api<{ id: string }>('/complaints', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({...parsed.data,...(review?{intakeReviewId:review.id}:{})}) });
      submitted.current = true;
      navigate(`/cases/${receipt.id}`);
    } catch (caught) { setError('submitError'); if(caught instanceof ApiError && [400,403,409,413,422].includes(caught.status)){setAttempt(false);setKey(crypto.randomUUID());} }
    finally { setBusy(false); }
  }

  function nextStep(){
    if(step===0&&!narrative.trim()){setFieldErrors(v=>({...v,narrative:'narrativeError'}));document.getElementById('narrative')?.focus();return;}
    if(step===1){const missing=concerns.filter(c=>!c.wording.trim());if(missing.length){setFieldErrors(v=>({...v,...Object.fromEntries(missing.map(c=>[c.uiId,'concernError' as const]))}));document.getElementById(missing[0].uiId+'-wording')?.focus();return;}}
    if(step===2&&(!evidenceReady||!assistantReady))return;
    setProgress(p=>continueWizard(p,true));window.scrollTo({top:0,behavior:'instant'});
  }
  const stepNames=language==='hi'?['घटना का विवरण','मुख्य मुद्दे','साक्ष्य और AI','समीक्षा व भेजें']:['Your story','Issues to address','Evidence & assistance','Review & submit'];
  return <div className="form-layout wizard-layout">
    <aside className="help-column" aria-label={t('sideNav')}>
      <nav className="wizard-progress" aria-label={language==='hi'?'शिकायत के चरण':'Complaint steps'}><ol>{stepNames.map((name,i)=><li key={name} aria-current={step===i?'step':undefined}><button type="button" disabled={busy||attempt||i>progress.furthest} className={i===step?'current':i<=progress.furthest?'complete':''} onClick={()=>setStep(i)}><span className="step-number">{i+1}</span><span>{name}</span></button></li>)}</ol></nav>
      <section className="side-status" aria-live="polite"><span className="status-dot" aria-hidden="true"/><div><strong>{t('notSubmitted')}</strong><p>{t('issueCount')}: {concerns.length}</p></div></section>
      <section className="help-block"><h2>{t('writingTipTitle')}</h2><p>{t('writingTip')}</p></section>
    </aside>
    <form onSubmit={submit} className="form-surface" data-wizard-step={step} noValidate><div className="wizard-stage-heading"><p>{language==='hi'?`चरण ${step+1} / 4`:`Step ${step+1} of 4`}</p><h2>{stepNames[step]}</h2><span>{language==='hi'?'आपकी जानकारी भेजने तक सहेजी नहीं जाएगी।':'Your entries are not saved until submission.'}</span></div>
      {error === 'reviewFields' && summaryItems.length > 0 && <section ref={summaryRef} className="error-summary" role="alert" aria-labelledby="error-summary-title" tabIndex={-1}>
        <h2 id="error-summary-title">{t('reviewFields')}</h2><ul>{summaryItems.map((item) => <li key={item.field}><a href={`#${item.targetId}`} onClick={(event) => { event.preventDefault(); const control = document.getElementById(item.targetId); control?.focus(); control?.scrollIntoView({ behavior: 'auto', block: 'center' }); }}>{item.labelKey === 'concern' ? `${t(item.labelKey)} ${item.concernNumber}` : t(item.labelKey)}: {t(item.error)}</a></li>)}</ul>
      </section>}
      <section className="form-section" data-wizard-stage="0" aria-labelledby="story-title">
        <h2 id="story-title">{t('storyTitle')}</h2><p className="section-intro">{t('storyIntro')}</p>
        <label className="field-label" htmlFor="narrative">{t('account')}</label>
        <textarea id="narrative" aria-describedby={`narrative-help${fieldErrors.narrative ? ' narrative-error' : ''}`} aria-invalid={!!fieldErrors.narrative} maxLength={12000} rows={6} value={narrative} onChange={(event) => { changed('narrative'); setNarrative(event.target.value); }} placeholder={t('narrativePlaceholder')} disabled={busy||attempt} />
        <p className="field-help" id="narrative-help">{t('narrativeHelp')}</p>
        {fieldErrors.narrative && <p className="field-error" id="narrative-error">{t(fieldErrors.narrative)}</p>}
        <p className="counter" aria-live="polite">{narrative.length.toLocaleString(locale)} / 12,000 {t('characters')}</p>
      </section>
      <section className="form-section" data-wizard-stage="1" aria-labelledby="concerns-title">
        <h2 id="concerns-title">{language==='hi'?'आप किन सवालों का जवाब चाहते हैं?':'What do you want answered?'}</h2><p className="section-intro">{t('issuesIntro')}</p>
        {concerns.map((concern, index) => {
          const field = concern.uiId; const errorId = `${field}-error`; const wordingId = `${field}-wording`;
          return <fieldset className="concern" key={field}>
            <legend className="concern-legend"><span>{language==='hi'?'मुद्दा':'Issue'} {index+1}</span></legend>
            <div className="issue-type"><p className="field-label" id={field+'-type'}>{language==='hi'?'इस मुद्दे के बारे में बताएँ':'What is this about?'}</p>
             <div className="choice-row" role="radiogroup" aria-labelledby={field+'-type'}>{([
              ['service',language==='hi'?'सेवा या देरी':'Service or delay'],
              ['conduct',language==='hi'?'व्यवहार':'Staff behaviour'],
              ['mixed',language==='hi'?'दोनों':'Both']
             ] as [ConcernType,string][]).map(([kind,label])=><label className="choice-pill" key={kind}>
              <input type="radio" name={'type-'+field} value={kind} checked={concern.type===kind} disabled={busy||attempt} onChange={()=>{changed();updateConcern(field,{type:kind});}}/><span>{label}</span>
             </label>)}</div>
            </div>
            <p className="field-help type-help">{t(`${concern.type}Help` as CopyKey)}</p>
            <label className="field-label" htmlFor={wordingId}>{language==='hi'?'इस मुद्दे को अपने शब्दों में लिखें':'Describe this issue in your own words'}</label>
            <textarea id={wordingId} aria-describedby={fieldErrors[field] ? errorId : undefined} aria-invalid={!!fieldErrors[field]} rows={3} maxLength={2000} value={concern.wording} disabled={busy||attempt} onChange={(event) => { changed(field); updateConcern(field, { wording: event.target.value }); }} placeholder={t('wordingPlaceholder')} />
            {fieldErrors[field] && <p className="field-error" id={errorId}>{t(fieldErrors[field])}</p>}
            <div className="concern-actions">{concerns.length > 1 && <button type="button" className="remove-concern" disabled={busy||attempt} onClick={() => { changed(field); setFieldErrors((current) => { const next = { ...current }; delete next[field]; return next; }); setConcerns((items) => items.filter((item) => item.uiId !== field)); }}><span aria-hidden="true">×</span> {t('removeConcern')} {index + 1}</button>}</div>
          </fieldset>;
        })}
        <button className="secondary-button" type="button" disabled={busy || attempt || concerns.length >= 30} onClick={() => { changed(); setConcerns((items) => [...items, { uiId: crypto.randomUUID(), type: 'service', wording: '' }]); }}><span aria-hidden="true">＋</span> {t('addConcern')}</button>
        <p className="field-help limit-note">{t('concernLimit')}</p>
      </section>
      <div className="wizard-evidence" data-wizard-stage="2"><EvidenceUpload api={api} language={language} disabled={!enabled||busy||attempt} onChange={(ids,ready,files)=>{changed();setEvidenceIds(ids);setEvidenceReady(ready);setEvidenceFiles(files);}}/>
      <IntakeAssistant api={api} language={language} text={narrative} evidenceIds={allEvidenceIds} disabled={!enabled||busy||attempt||!evidenceReady} onReadinessChange={setAssistantReady} onSource={(id,file)=>{changed();setAssistantIds(old=>[...new Set([...old,id])]);if(file)setAssistantFiles(old=>[...old.filter(f=>f.id!==id),file]);}} onApply={(draft:IntakeDraft)=>{changed();setIntakeDraft(draft.id);reviewKey.current=crypto.randomUUID();setNarrative(draft.body.report.allegation.value);setConcerns(draft.body.report.concerns.map(c=>({uiId:crypto.randomUUID(),type:c.type,wording:c.field.value})));setDeclaration(false);}}/>
      {assistantFiles.length>0&&<section className="confirmed-recordings"><h3>{language==='hi'?'निजी रूप से अपलोड की गई रिकॉर्डिंग':'Privately uploaded recordings'}</h3><ul>{assistantFiles.map(file=><li className="evidence-file" key={file.id}><span className="preserve">{file.name}</span> · {fileSize(file.bytes)} <span>{language==='hi'?'अपलोड की पुष्टि हुई':'Upload confirmed'}</span><button type="button" className="danger-button" disabled={busy||attempt} onClick={()=>{changed();setAssistantIds(ids=>ids.filter(id=>id!==file.id));setAssistantFiles(files=>files.filter(f=>f.id!==file.id));}}>{language==='hi'?'हटाएँ':'Remove'}</button></li>)}</ul></section>}
      {intakeDraft&&<p role="status">{language==='hi'?'AI संस्करण चुना गया है। अपने सुधार करें और भेजने से पहले घोषणा की पुष्टि करें।':'AI revision selected. Make your corrections and confirm the declaration before submission. Citizen additions and edits carry no invented AI citations.'}</p>}
      {!evidenceReady&&<p role="status">{language==='hi'?'भेजने से पहले सभी चुनी गई फ़ाइलें अपलोड करें या हटाएँ।':'Upload or remove every selected file before submission.'}</p>}
      </div><section className="form-section submit-section" data-wizard-stage="3" aria-labelledby="review-title"><div className="review-recap"><h3>{language==='hi'?'भेजने से पहले जाँचें':'Check before submitting'}</h3><section><h4>{language==='hi'?'आपका विवरण':'Your account'}</h4><p className="preserve">{narrative}</p><button type="button" className="secondary-button" onClick={()=>setStep(0)}>{language==='hi'?'विवरण संपादित करें':'Edit account'}</button></section><section><h4>{language==='hi'?'जवाब चाहने वाले मुद्दे':'Issues requiring answers'}</h4><ol>{concerns.map(c=><li key={c.uiId} className="preserve">{c.wording}</li>)}</ol><button type="button" className="secondary-button" onClick={()=>setStep(1)}>{language==='hi'?'मुद्दे संपादित करें':'Edit issues'}</button></section><section><h4>{language==='hi'?'पुष्ट निजी फ़ाइलें और रिकॉर्डिंग':'Confirmed private evidence and recordings'}</h4>{!allEvidenceIds.length?<p>{language==='hi'?'कोई फ़ाइल संलग्न नहीं है। केवल लिखित शिकायत भेज सकते हैं।':'No files attached. Written-only submission is supported.'}</p>:<ul>{[...evidenceFiles,...assistantFiles].filter(f=>allEvidenceIds.includes(f.id)).map(f=><li key={f.id}>{f.name} · {f.bytes} B · {language==='hi'?'अपलोड की पुष्टि हुई':'Upload confirmed'}</li>)}</ul>}<button type="button" className="secondary-button" onClick={()=>setStep(2)}>{language==='hi'?'फ़ाइलें और सहायता देखें':'Edit evidence or assistance'}</button></section><section><h4>{language==='hi'?'वैकल्पिक सहायता':'Optional assistance'}</h4><p>{intakeDraft?(language==='hi'?'आपने सहायता वाला मसौदा चुना है। ऊपर के शब्दों की जाँच करें; वे आपके सुधारों सहित भेजे जाएँगे। मूल स्रोत और AI संस्करण अलग सुरक्षित रहते हैं।':'You applied an assisted draft. Review your edited words above; original sources and the AI version are retained separately. This is not a verified finding.'):(language==='hi'?'कोई सहायता वाला मसौदा लागू नहीं किया गया। यह आपका लिखा विवरण है।':'No assisted draft has been applied. This is your authored account.')}</p></section></div>
        <h2 id="review-title">{t('reviewTitle')}</h2>
        <label className="declaration" htmlFor="declaration"><input id="declaration" type="checkbox" checked={declaration} disabled={busy||attempt} aria-invalid={!!fieldErrors.declaration} aria-describedby={fieldErrors.declaration ? 'declaration-error' : undefined} onChange={(event) => { changed('declaration'); setDeclaration(event.target.checked); }} /><span>{t('declaration')}</span></label>
        {fieldErrors.declaration && <p className="field-error" id="declaration-error">{t(fieldErrors.declaration)}</p>}
        {error && <p role="alert" className="error">{t(error)}</p>}
        <div className="submit-row"><button type="submit" disabled={!enabled || busy || !evidenceReady || !assistantReady}>{busy ? t('savingComplaint') : t('submitComplaint')}</button>{busy && <p className="live-message" role="status" aria-live="polite">{t('savingWait')}</p>}</div>
        {!enabled && <p className="field-help">{t('startSessionToSubmit')}</p>}<p className="field-help">{t('privateReceipt')}</p>
      </section><nav className="wizard-actions" aria-label={language==='hi'?'चरण नेविगेशन':'Step navigation'}>{step>0&&<button type="button" className="secondary-button" disabled={busy||attempt} onClick={()=>{setStep(v=>Math.max(0,v-1));window.scrollTo({top:0,behavior:'instant'});}}>{language==='hi'?'पिछला':'Back'}</button>}{step<3&&<button type="button" disabled={busy||attempt||step===2&&(!evidenceReady||!assistantReady)} onClick={nextStep}>{language==='hi'?'आगे बढ़ें':'Continue'} <span aria-hidden="true">→</span></button>}</nav>
    </form>
  </div>;
}

function CasePage({ ready, signedIn, language, t }: { ready: boolean; signedIn: boolean; language: Language; t: Translator }) {
  const { id } = useParams();
  const [caseParams,setCaseParams] = useSearchParams();
  const [responseCheck,setResponseCheck]=useState<ResponseCheck>('checking');
  const availablePanels=casePanels(responseCheck);
  const activePanel=resolveCasePanel(caseParams.get('section'),responseCheck,caseParams.has('auditResponse'));
  const switchPanel=(panel:CasePanel)=>{const params=new URLSearchParams(caseParams);params.set('section',panel);setCaseParams(params);window.scrollTo({top:0,behavior:'instant'});};
  const [record, setRecord] = useState<CaseRecord>();
  const [state, setState] = useState<'loading' | 'ready' | 'not-found' | 'unavailable' | 'auth-error'>('loading');
  const [loadedId, setLoadedId] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const recoveryLock = useRef(false);
  const [recoveryMessage, setRecoveryMessage] = useState<'authRecoveryFailed' | 'authRecoveryTimeout' | 'authRecoveryUnavailable' | 'authRecoveryReceiptFailed'>('authRecoveryFailed');
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'failure'>('idle');
  const recovery = useMemo(() => createReceiptRecovery<CaseRecord>({
    getIdentity: async () => {
      const { data, error } = await auth!.auth.getSession();
      if (error) throw error;
      return data.session?.user.id;
    },
    refreshIdentity: async () => {
      const { data, error } = await auth!.auth.refreshSession();
      if (error) throw error;
      return data.session?.user.id;
    },
    retryReceipt: () => api<CaseRecord>(`/complaints/${encodeURIComponent(id ?? '')}`),
  }), [id]);
  useEffect(() => {
    setRecord(undefined); setState('loading'); setLoadedId(undefined);
    if (!ready || !signedIn || !id) return;
    let active = true;
    api<CaseRecord>(`/complaints/${encodeURIComponent(id)}`).then((value) => { if (active) { setRecord(value); setState('ready'); setLoadedId(id); } }).catch((caught: unknown) => {
      if (!active) return;
      const status = caught instanceof ApiError ? caught.status : 0;
      setState(receiptFailureState(status)); setLoadedId(id);
    });
    return () => { active = false; };
  }, [id, ready, signedIn, retry]);
  useEffect(()=>{
    let active=true;
    setResponseCheck('checking');
    if(!ready||!signedIn||!id)return;
    api<{responses:{id:string}[]}>('/audit/'+encodeURIComponent(id)).then(value=>{
      if(active)setResponseCheck(value.responses?.length?'available':'missing');
    }).catch(()=>{if(active)setResponseCheck('error');});
    return ()=>{active=false;};
  },[id,ready,signedIn,retry]);
  const visibleState = loadedId === id ? state : 'loading';
  if (!ready) return <section className="notice"><h1>{t('receiptAccess')}</h1><p>{t('receiptAccessBody')}</p><Link to="/">{t('goFile')}</Link></section>;
  async function recoverReceipt() {
    if (recoveryLock.current) return;
    recoveryLock.current = true; setRecovering(true); setRecoveryMessage('authRecoveryFailed');
    try {
      const result = await recovery();
      if (result.kind === 'recovered') { setRecord(result.value); setState('ready'); setLoadedId(id); }
      else if (result.kind === 'timed-out') { setRecoveryMessage('authRecoveryTimeout'); setState('auth-error'); }
      else if (result.kind === 'identity-unavailable' || result.kind === 'identity-changed') { setRecoveryMessage('authRecoveryUnavailable'); setState('auth-error'); }
      else if (result.kind === 'receipt-failed') {
        if (result.status === 401) { setRecoveryMessage('authRecoveryReceiptFailed'); setState('auth-error'); }
        else setState(receiptFailureState(result.status));
      }
      else setState('auth-error');
    } finally { recoveryLock.current = false; setRecovering(false); }
  }
  if (visibleState === 'auth-error') return <section className="notice" role="alert"><h1>{t('authErrorTitle')}</h1><p>{t(recoveryMessage)}</p><button type="button" onClick={() => { void recoverReceipt(); }} disabled={recovering}>{recovering ? t('authRecoveryWorking') : t('authRecoveryAction')}</button></section>;
  if (!signedIn) return <section className="notice"><h1>{t('receiptAccess')}</h1><p>{t('receiptAccessBody')}</p><Link to="/">{t('goFile')}</Link></section>;
  if (visibleState === 'not-found') return <section className="notice" role="alert"><h1>{t('notFoundTitle')}</h1><p>{t('notFoundBody')}</p><Link to="/">{t('goFile')}</Link></section>;
  if (visibleState === 'unavailable') return <section className="notice" role="alert"><h1>{t('receiptErrorTitle')}</h1><p>{t('receiptErrorBody')}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>{t('loadReceipt')}</button></section>;
  if (!record || visibleState !== 'ready') return <p className="live-message" role="status" aria-live="polite">{t('loadingReceipt')}</p>;
  const loadedRecord = record;
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  async function copyReference() {
    const copied = await copyExactReference(loadedRecord.id, async (value) => {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(value);
    });
    setCopyState(copied ? 'success' : 'failure');
  }
  return <article className="receipt case-dashboard" aria-labelledby="receipt-title">
    <div className="receipt-heading"><p className="sample-label">{language==='hi'?'आपका निजी केस':'Your private case'} · {t('desk')}</p><h1 id="receipt-title">{language==='hi'?'शिकायत की जानकारी':'Your complaint'}</h1><span className="status">{t('receiptStatusSubmitted')}</span><p className="receipt-lead">{language==='hi'?'यह मामला केवल काल्पनिक प्रदर्शन में दर्ज है। हर भाग को अलग खोलें।':'This case is recorded in the fictional demo only. Choose what you want to review below.'}</p></div>
    <dl className="receipt-meta"><div><dt>{t('reference')}</dt><dd className="reference" id="case-reference">{loadedRecord.id}</dd></div><div><dt>{t('submitted')}</dt><dd><time dateTime={loadedRecord.submittedAt}>{new Date(loadedRecord.submittedAt).toLocaleString(locale)}</time></dd></div><div><dt>{t('office')}</dt><dd>{t('desk')}</dd></div></dl>
    <nav className="case-tabs" aria-label={language==='hi'?'केस का मेनू':'Case navigation'}>{availablePanels.map(key=><button key={key} type="button" className={activePanel===key?'active':''} aria-current={activePanel===key?'page':undefined} onClick={()=>switchPanel(key)}>{({
 overview:language==='hi'?'सारांश':'Overview',
 evidence:language==='hi'?'साक्ष्य':'Evidence',
 timeline:language==='hi'?'प्रगति':'Progress',
 response:language==='hi'?'कार्यालय जवाब':'Office reply',
 audit:language==='hi'?'जवाब की जाँच':'Check reply',
 next:language==='hi'?'अगले कदम':'Next steps'
} as Record<CasePanel,string>)[key]}</button>)}</nav>
    {activePanel==='overview'&&<section className="case-status-panel" aria-labelledby="case-progress-title"><h2 id="case-progress-title">{language==='hi'?'अभी आपके मामले की स्थिति':'Your case at a glance'}</h2>
     <ol className="case-progress"><li className="complete"><span>✓</span><div><strong>{language==='hi'?'शिकायत दर्ज':'Record created'}</strong><small>{language==='hi'?'निजी रसीद उपलब्ध':'Private receipt available'}</small></div></li>
     <li className={responseCheck==='available'?'complete':''}><span>{responseCheck==='available'?'✓':'2'}</span><div><strong>{language==='hi'?'कार्यालय का जवाब':'Office response'}</strong><small>{responseCheck==='available'?(language==='hi'?'जवाब दर्ज है':'A response is recorded'):responseCheck==='missing'?(language==='hi'?'अभी जवाब दर्ज नहीं':'Not recorded yet'):responseCheck==='error'?(language==='hi'?'स्थिति नहीं जाँची जा सकी':'Could not verify status'):(language==='hi'?'स्थिति देखी जा रही है':'Checking status')}</small></div></li>
     <li className={responseCheck==='available'?'ready':''}><span>3</span><div><strong>{language==='hi'?'जवाब देखें और तुलना करें':'Read and compare'}</strong><small>{responseCheck==='available'?(language==='hi'?'अब जवाब खोल सकते हैं':'Available now'):(language==='hi'?'जवाब दर्ज होने पर खुलेगा':'Available after a recorded response')}</small></div></li></ol>
     {(responseCheck==='error'||responseCheck==='missing')&&<p>{language==='hi'?'यह जाँचता है कि कोई नया कार्यालय जवाब दर्ज हुआ है या नहीं।':'This checks whether a new office response has been recorded.'}</p>}
     {(responseCheck==='error'||responseCheck==='missing')&&<button type="button" className="secondary-button" onClick={()=>setRetry(v=>v+1)}>{language==='hi'?'नया जवाब देखें':'Check for a new reply'}</button>}
    </section>}
    {activePanel==='overview'&&<section className="saved-account" aria-labelledby="account-title"><h2 id="account-title">{t('originalAccount')}</h2><p className="preserve">{loadedRecord.narrative}</p><h2 className="concerns-heading">{t('recordedIssues')}</h2>
      <ol className="saved-concerns">{loadedRecord.concerns.map((concern, index) => <li key={`${index}-${concern.type}`}><div className="saved-concern-label"><span>{t('concern')} {index + 1}</span><span>{t(concern.type)}</span></div><p className="preserve">{concern.wording}</p></li>)}</ol>
    </section>}
    {activePanel==='overview'&&<><p className="receipt-limit">{t('receiptLimit')}</p><div className="receipt-actions"><button type="button" onClick={() => void copyReference()}>{t('copyReference')}</button><button type="button" onClick={() => window.print()}>{t('print')}</button><Link className="secondary-link" to="/file">{t('another')}</Link></div>
    {copyState !== 'idle' && <p className="copy-feedback" role="status" aria-live="polite">{t(copyState === 'success' ? 'referenceCopied' : 'referenceCopyFailed')}</p>}</>}
    {activePanel==='evidence'&&<><RecordVerification api={api} language={language} id={loadedRecord.id}/><IntakeProvenance api={api} language={language} id={loadedRecord.id}/></>}
    {activePanel==='timeline'&&<EscalationTimeline key={loadedRecord.id} api={api} language={language} id={loadedRecord.id}/>}
    {(activePanel==='response'||activePanel==='audit'||activePanel==='next')&&<WorkflowWorkspace api={api} language={language} caseId={id} panel={activePanel}/>} 
    <nav className="case-next-actions" aria-label={language==='hi'?'अगला भाग':'Next section'}>{adjacentCasePanel(activePanel,responseCheck,-1)&&<button type="button" className="secondary-button" onClick={()=>{const prev=adjacentCasePanel(activePanel,responseCheck,-1);if(prev)switchPanel(prev);}}>{language==='hi'?'← पिछला':'← Previous'}</button>}{adjacentCasePanel(activePanel,responseCheck,1)&&<button type="button" onClick={()=>{const next=adjacentCasePanel(activePanel,responseCheck,1);if(next)switchPanel(next);}}>{language==='hi'?'अगला भाग →':'Next section →'}</button>}</nav>
  </article>;
}

const root = hotData?.root ?? createRoot(document.getElementById('root')!);
if (hotData) hotData.root = root;
root.render(<BrowserRouter><App /></BrowserRouter>);
