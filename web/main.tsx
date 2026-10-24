import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { complaintSchema, type CaseRecord } from '../domain/complaint';
import { initialLanguage, translate, type CopyKey, type Language } from './i18n';
import { receiptFailureState } from './receipt-state';
import { createReceiptRecovery } from './receipt-recovery';
import { attachLeaveWarning, copyExactReference, fieldErrorSummary, shouldWarnOnLeave } from './form-usability';
import type { FormError } from './form-types';
import './style.css';
import { StaffSession, WorkflowWorkspace } from './workflow';
import { RecordVerification } from './record-verification';
import { EvidenceUpload } from './evidence-upload';
import {IntakeAssistant,IntakeProvenance,type IntakeDraft} from './intake-assistant';
import {safeFilename} from '../domain/intake-ai';

type Config = { ready: boolean; url?: string; publishableKey?: string };
type ConcernType = 'service' | 'conduct' | 'mixed';
type Concern = { uiId: string; type: ConcernType; wording: string };
class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
type HotData = { auth?: SupabaseClient; root?: ReturnType<typeof createRoot> };
const hotData = import.meta.hot?.data as HotData | undefined;
let auth = hotData?.auth;

async function api<T = { error?: string }>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await auth?.auth.getSession();
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.data.session?.access_token ?? ''}`, ...init.headers },
    });
  } catch { throw new ApiError(0, 'network'); }
  if(response.ok&&response.headers.get('Content-Disposition')?.startsWith('attachment')){const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;const encoded=response.headers.get('Content-Disposition')?.split("filename*=UTF-8''")[1];link.download=safeFilename(encoded?decodeURIComponent(encoded):'evidence');link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return undefined as T;}
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new ApiError(response.status, body.error ?? 'request');
  return body;
}

function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const t = useMemo(() => (key: CopyKey, values?: Record<string, string | number>) => translate(language, key, values), [language]);
  const [config, setConfig] = useState<Config>();
  const [signedIn, setSignedIn] = useState(false);
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
          auth ??= createClient(value.url, value.publishableKey,{auth:{storageKey:window.location.pathname.startsWith('/staff')?'janvaani-operator-session':'sb-'+new URL(value.url).hostname.split('.')[0]+'-auth-token'}});
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

  return <>
    <div className="demo-strip"><strong>{t('demo')}</strong><span>{t('fictional')}</span></div>
    <header className="site-header">
      <Link to="/" className="brand" aria-label={t('brandHome')}><span className="brand-mark" aria-hidden="true">ज</span><span>Janvaani</span></Link>
      <div className="header-tools"><nav aria-label={t('workspace')}><Link to="/">{t('workspace')}</Link><a href="#privacy">{t('privacy')}</a></nav><LanguageToggle language={language} setLanguage={setLanguage} t={t} /></div>
    </header>
    <main>
      <Routes>
        <Route path="/" element={<>
          <div className="page-heading"><p className="sample-label">{t('desk')}</p><h1>{t('fileTitle')}</h1><p>{t('fileIntro')}</p></div>
          {!config ? error ? <section className="notice" role="alert"><h2>{t('unavailable')}</h2><p>{t(error)}</p><button type="button" onClick={retryConfig}>{t('retry')}</button></section> : <p className="live-message" role="status">{t('connecting')}</p>
            : !config.ready ? <section className="notice" role="status" aria-labelledby="setup-title"><h2 id="setup-title">{t('setupTitle')}</h2><p>{t('setupBody')}</p><button type="button" onClick={retryConfig}>{t('retry')}</button></section>
              : !signedIn ? <section className="session-notice" aria-labelledby="session-title"><div><h2 id="session-title">{t('startSession')}</h2><p>{t('sessionRecovery')}</p></div><button type="button" onClick={signIn} disabled={busy}>{busy ? t('starting') : t('startSession')}</button></section>
                : <p className="session" role="status">{t('sessionActive')}</p>}
          {error && config && <p className="error" role="alert">{t(error)}</p>}
          <ComplaintForm enabled={signedIn && !!config?.ready} language={language} t={t} />
        </>} />
        <Route path="/cases/:id" element={<CasePage ready={!!config?.ready} signedIn={signedIn} language={language} t={t} />} />
        <Route path="/staff" element={<><StaffSession client={auth} onReady={()=>window.location.reload()} language={language}/>{signedIn&&<WorkflowWorkspace api={api} language={language}/>}</>} />
        <Route path="/staff/:id" element={<><StaffSession client={auth} onReady={()=>window.location.reload()} language={language}/>{signedIn&&<WorkflowWorkspace api={api} language={language}/>}</>} />
        <Route path="*" element={<section className="notice"><h1>{t('pageNotFound')}</h1><Link to="/">{t('returnWorkspace')}</Link></section>} />
      </Routes>
      <section id="privacy" className="privacy" aria-labelledby="privacy-title"><h2 id="privacy-title">{t('usingDemo')}</h2><p>{t('privacyBody')}</p></section>
    </main>
    <footer><span>Janvaani · Hack Cache</span><span>{t('footerDemo')}</span></footer>
  </>;
}

type Translator = (key: CopyKey, values?: Record<string, string | number>) => string;
function LanguageToggle({ language, setLanguage, t }: { language: Language; setLanguage: (language: Language) => void; t: Translator }) {
  return <fieldset className="language-toggle"><legend>{t('language')}</legend><label><input type="radio" name="language" value="en" checked={language === 'en'} onChange={() => setLanguage('en')} /><span lang="en">{t('english')}</span></label><label><input type="radio" name="language" value="hi" checked={language === 'hi'} onChange={() => setLanguage('hi')} /><span lang="hi">{t('hindi')}</span></label></fieldset>;
}

function ComplaintForm({ enabled, language, t }: { enabled: boolean; language: Language; t: Translator }) {
  const navigate = useNavigate();
  const [narrative, setNarrative] = useState('');
  const [concerns, setConcerns] = useState<Concern[]>(() => [
    { uiId: crypto.randomUUID(), type: 'service', wording: '' }, { uiId: crypto.randomUUID(), type: 'conduct', wording: '' },
  ]);
  const [declaration, setDeclaration] = useState(false);
  const [error, setError] = useState<CopyKey>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, FormError>>({});
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [attempt, setAttempt] = useState(false);
  const [evidenceIds,setEvidenceIds]=useState<string[]>([]);
  const [evidenceReady,setEvidenceReady]=useState(true);
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
    event.preventDefault(); setError(undefined);
    if(!evidenceReady)return;
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
      setFieldErrors(next); setError('reviewFields'); setSummaryFocus((value) => value + 1); return;
    }
    setFieldErrors({}); setBusy(true); setAttempt(true);
    try {
      const review=intakeDraft?await api<{id:string}>('/intake/'+intakeDraft+'/review',{method:'POST',headers:{'Idempotency-Key':reviewKey.current},body:JSON.stringify(parsed.data)}):undefined;
      const receipt = await api<{ id: string }>('/complaints', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({...parsed.data,...(review?{intakeReviewId:review.id}:{})}) });
      submitted.current = true;
      navigate(`/cases/${receipt.id}`);
    } catch { setError('submitError'); }
    finally { setBusy(false); }
  }

  return <div className="form-layout">
    <aside className="help-column" aria-label={t('sideNav')}>
      <nav className="section-nav" aria-label={t('sideNav')}><a href="#story-title">{t('sectionStory')}</a><a href="#concerns-title">{t('sectionIssues')} <span className="count-pill">{concerns.length}</span></a><a href="#review-title">{t('sectionReview')}</a></nav>
      <section className="side-status" aria-live="polite"><span className="status-dot" aria-hidden="true"/><div><strong>{t('notSubmitted')}</strong><p>{t('issueCount')}: {concerns.length}</p></div></section>
      <section className="help-block"><h2>{t('writingTipTitle')}</h2><p>{t('writingTip')}</p></section>
    </aside>
    <form onSubmit={submit} className="form-surface" noValidate>
      {error === 'reviewFields' && summaryItems.length > 0 && <section ref={summaryRef} className="error-summary" role="alert" aria-labelledby="error-summary-title" tabIndex={-1}>
        <h2 id="error-summary-title">{t('reviewFields')}</h2><ul>{summaryItems.map((item) => <li key={item.field}><a href={`#${item.targetId}`} onClick={(event) => { event.preventDefault(); const control = document.getElementById(item.targetId); control?.focus(); control?.scrollIntoView({ behavior: 'auto', block: 'center' }); }}>{item.labelKey === 'concern' ? `${t(item.labelKey)} ${item.concernNumber}` : t(item.labelKey)}: {t(item.error)}</a></li>)}</ul>
      </section>}
      <section className="form-section" aria-labelledby="story-title">
        <h2 id="story-title">{t('storyTitle')}</h2><p className="section-intro">{t('storyIntro')}</p>
        <label className="field-label" htmlFor="narrative">{t('account')}</label>
        <textarea id="narrative" aria-describedby={`narrative-help${fieldErrors.narrative ? ' narrative-error' : ''}`} aria-invalid={!!fieldErrors.narrative} maxLength={12000} rows={6} value={narrative} onChange={(event) => { changed('narrative'); setNarrative(event.target.value); }} placeholder={t('narrativePlaceholder')} disabled={busy||attempt} />
        <p className="field-help" id="narrative-help">{t('narrativeHelp')}</p>
        {fieldErrors.narrative && <p className="field-error" id="narrative-error">{t(fieldErrors.narrative)}</p>}
        <p className="counter" aria-live="polite">{narrative.length.toLocaleString(locale)} / 12,000 {t('characters')}</p>
      </section>
      <section className="form-section" aria-labelledby="concerns-title">
        <h2 id="concerns-title">{t('issuesTitle')}</h2><p className="section-intro">{t('issuesIntro')}</p>
        {concerns.map((concern, index) => {
          const field = concern.uiId; const errorId = `${field}-error`; const wordingId = `${field}-wording`;
          return <fieldset className="concern" key={field}>
            <legend className="concern-legend"><span>{t('concern')} {index + 1}</span><label className="type-control"><span className="sr-only">{t('concernType', { n: index + 1 })}</span><select aria-label={t('concernType', { n: index + 1 })} value={concern.type} disabled={busy||attempt} onChange={(event) => { changed(); updateConcern(field, { type: event.target.value as ConcernType }); }}>
              <option value="service">{t('service')}</option><option value="conduct">{t('conduct')}</option><option value="mixed">{t('mixed')}</option>
            </select></label></legend>
            <p className="field-help type-help">{t(`${concern.type}Help` as CopyKey)}</p>
            <label className="sr-only" htmlFor={wordingId}>{t('concern')} {index + 1}: {t('account')}</label>
            <textarea id={wordingId} aria-describedby={fieldErrors[field] ? errorId : undefined} aria-invalid={!!fieldErrors[field]} rows={3} maxLength={2000} value={concern.wording} disabled={busy||attempt} onChange={(event) => { changed(field); updateConcern(field, { wording: event.target.value }); }} placeholder={t('wordingPlaceholder')} />
            {fieldErrors[field] && <p className="field-error" id={errorId}>{t(fieldErrors[field])}</p>}
            <div className="concern-actions">{concerns.length > 1 && <button type="button" className="text-button" disabled={busy||attempt} onClick={() => { changed(field); setFieldErrors((current) => { const next = { ...current }; delete next[field]; return next; }); setConcerns((items) => items.filter((item) => item.uiId !== field)); }}>{t('removeConcern')} {index + 1}</button>}</div>
          </fieldset>;
        })}
        <button className="secondary-button" type="button" disabled={busy || attempt || concerns.length >= 30} onClick={() => { changed(); setConcerns((items) => [...items, { uiId: crypto.randomUUID(), type: 'service', wording: '' }]); }}>{t('addConcern')}</button>
        <p className="field-help limit-note">{t('concernLimit')}</p>
      </section>
      <EvidenceUpload api={api} language={language} disabled={!enabled||busy||attempt} onChange={(ids,ready)=>{changed();setEvidenceIds(ids);setEvidenceReady(ready);}}/>
      <IntakeAssistant api={api} language={language} text={narrative} evidenceIds={allEvidenceIds} disabled={!enabled||busy||attempt||!evidenceReady} onSource={id=>{changed();setAssistantIds(old=>[...new Set([...old,id])]);}} onApply={(draft:IntakeDraft)=>{changed();setIntakeDraft(draft.id);reviewKey.current=crypto.randomUUID();setNarrative(draft.body.report.allegation.value);setConcerns(draft.body.report.concerns.map(c=>({uiId:crypto.randomUUID(),type:c.type,wording:c.field.value})));setDeclaration(false);}}/>
      {intakeDraft&&<p role="status">{language==='hi'?'AI संस्करण चुना गया है। अपने सुधार करें और भेजने से पहले घोषणा की पुष्टि करें।':'AI revision selected. Make your corrections and confirm the declaration before submission. Citizen additions and edits carry no invented AI citations.'}</p>}
      {!evidenceReady&&<p role="status">{language==='hi'?'भेजने से पहले सभी चुनी गई फ़ाइलें अपलोड करें या हटाएँ।':'Upload or remove every selected file before submission.'}</p>}
      <section className="form-section submit-section" aria-labelledby="review-title">
        <h2 id="review-title">{t('reviewTitle')}</h2>
        <label className="declaration" htmlFor="declaration"><input id="declaration" type="checkbox" checked={declaration} disabled={busy||attempt} aria-invalid={!!fieldErrors.declaration} aria-describedby={fieldErrors.declaration ? 'declaration-error' : undefined} onChange={(event) => { changed('declaration'); setDeclaration(event.target.checked); }} /><span>{t('declaration')}</span></label>
        {fieldErrors.declaration && <p className="field-error" id="declaration-error">{t(fieldErrors.declaration)}</p>}
        {error && <p role="alert" className="error">{t(error)}</p>}
        <div className="submit-row"><button type="submit" disabled={!enabled || busy || !evidenceReady}>{busy ? t('savingComplaint') : t('submitComplaint')}</button>{busy && <p className="live-message" role="status" aria-live="polite">{t('savingWait')}</p>}</div>
        {!enabled && <p className="field-help">{t('startSessionToSubmit')}</p>}<p className="field-help">{t('privateReceipt')}</p>
      </section>
    </form>
  </div>;
}

function CasePage({ ready, signedIn, language, t }: { ready: boolean; signedIn: boolean; language: Language; t: Translator }) {
  const { id } = useParams();
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
  return <article className="receipt" aria-labelledby="receipt-title">
    <div className="receipt-heading"><p className="sample-label">{t('desk')}</p><h1 id="receipt-title">{t('receiptTitle')}</h1><span className="status">{t('receiptStatusSubmitted')}</span></div>
    <dl className="receipt-meta"><div><dt>{t('reference')}</dt><dd className="reference" id="case-reference">{loadedRecord.id}</dd></div><div><dt>{t('submitted')}</dt><dd><time dateTime={loadedRecord.submittedAt}>{new Date(loadedRecord.submittedAt).toLocaleString(locale)}</time></dd></div><div><dt>{t('office')}</dt><dd>{t('desk')}</dd></div></dl>
    <section className="saved-account" aria-labelledby="account-title"><h2 id="account-title">{t('originalAccount')}</h2><p className="preserve">{loadedRecord.narrative}</p><h2 className="concerns-heading">{t('recordedIssues')}</h2>
      <ol className="saved-concerns">{loadedRecord.concerns.map((concern, index) => <li key={`${index}-${concern.type}`}><div className="saved-concern-label"><span>{t('concern')} {index + 1}</span><span>{t(concern.type)}</span></div><p className="preserve">{concern.wording}</p></li>)}</ol>
    </section>
    <p className="receipt-limit">{t('receiptLimit')}</p><div className="receipt-actions"><button type="button" onClick={() => void copyReference()}>{t('copyReference')}</button><button type="button" onClick={() => window.print()}>{t('print')}</button><Link className="secondary-link" to="/">{t('another')}</Link></div>
    {copyState !== 'idle' && <p className="copy-feedback" role="status" aria-live="polite">{t(copyState === 'success' ? 'referenceCopied' : 'referenceCopyFailed')}</p>}
    <RecordVerification api={api} language={language} id={loadedRecord.id}/>
    <IntakeProvenance api={api} language={language} id={loadedRecord.id}/>
    <WorkflowWorkspace api={api} language={language} caseId={id}/>
  </article>;
}

const root = hotData?.root ?? createRoot(document.getElementById('root')!);
if (hotData) hotData.root = root;
root.render(<BrowserRouter><App /></BrowserRouter>);
