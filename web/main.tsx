import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { complaintSchema, type CaseRecord } from '../domain/complaint';
import { initialLanguage, translate, type CopyKey, type Language } from './i18n';
import { receiptFailureState } from './receipt-state';
import './style.css';

type Config = { ready: boolean; url?: string; publishableKey?: string };
type ConcernType = 'service' | 'conduct' | 'mixed';
type Concern = { uiId: string; type: ConcernType; wording: string };
type FormError = 'narrativeError' | 'concernError' | 'declarationError';
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
          auth ??= createClient(value.url, value.publishableKey);
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
        <Route path="/cases/:id" element={<CasePage ready={!!config?.ready} signedIn={signedIn} language={language} t={t} onAuthFailure={() => { void auth?.auth.signOut(); setSignedIn(false); }} />} />
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
  const payload = { narrative, office: 'SAMPLE_MUNICIPAL_DESK', category: 'SAMPLE_MUNICIPAL_SERVICE', concerns: concerns.map(({ type, wording }) => ({ type, wording })), declaration };
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  function changed(field?: string) {
    setError(undefined);
    if (attempt) { setKey(crypto.randomUUID()); setAttempt(false); }
    if (field && fieldErrors[field]) setFieldErrors((current) => { const next = { ...current }; delete next[field]; return next; });
  }
  function updateConcern(uiId: string, update: Partial<Pick<Concern, 'type' | 'wording'>>) {
    setConcerns((items) => items.map((item) => item.uiId === uiId ? { ...item, ...update } : item));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(undefined);
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
      setFieldErrors(next); setError('reviewFields'); return;
    }
    setFieldErrors({}); setBusy(true); setAttempt(true);
    try {
      const receipt = await api<{ id: string }>('/complaints', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(parsed.data) });
      navigate(`/cases/${receipt.id}`);
    } catch { setError('submitError'); }
    finally { setBusy(false); }
  }

  return <div className="form-layout">
    <form onSubmit={submit} className="form-surface" noValidate>
      <section className="form-section" aria-labelledby="story-title">
        <h2 id="story-title">{t('storyTitle')}</h2><p className="section-intro">{t('storyIntro')}</p>
        <label className="field-label" htmlFor="narrative">{t('account')}</label>
        <textarea id="narrative" aria-describedby={`narrative-help${fieldErrors.narrative ? ' narrative-error' : ''}`} aria-invalid={!!fieldErrors.narrative} maxLength={12000} rows={6} value={narrative} onChange={(event) => { changed('narrative'); setNarrative(event.target.value); }} placeholder={t('narrativePlaceholder')} disabled={busy} />
        <p className="field-help" id="narrative-help">{t('narrativeHelp')}</p>
        {fieldErrors.narrative && <p className="field-error" id="narrative-error">{t(fieldErrors.narrative)}</p>}
        <p className="counter" aria-live="polite">{narrative.length.toLocaleString(locale)} / 12,000 {t('characters')}</p>
      </section>
      <section className="form-section" aria-labelledby="concerns-title">
        <h2 id="concerns-title">{t('issuesTitle')}</h2><p className="section-intro">{t('issuesIntro')}</p>
        {concerns.map((concern, index) => {
          const field = concern.uiId; const errorId = `${field}-error`; const wordingId = `${field}-wording`;
          return <fieldset className="concern" key={field}>
            <legend className="concern-legend"><span>{t('concern')} {index + 1}</span><label className="type-control"><span className="sr-only">{t('concernType', { n: index + 1 })}</span><select aria-label={t('concernType', { n: index + 1 })} value={concern.type} disabled={busy} onChange={(event) => { changed(); updateConcern(field, { type: event.target.value as ConcernType }); }}>
              <option value="service">{t('service')}</option><option value="conduct">{t('conduct')}</option><option value="mixed">{t('mixed')}</option>
            </select></label></legend>
            <p className="field-help type-help">{t(`${concern.type}Help` as CopyKey)}</p>
            <label className="sr-only" htmlFor={wordingId}>{t('concern')} {index + 1}: {t('account')}</label>
            <textarea id={wordingId} aria-describedby={fieldErrors[field] ? errorId : undefined} aria-invalid={!!fieldErrors[field]} rows={3} maxLength={2000} value={concern.wording} disabled={busy} onChange={(event) => { changed(field); updateConcern(field, { wording: event.target.value }); }} placeholder={t('wordingPlaceholder')} />
            {fieldErrors[field] && <p className="field-error" id={errorId}>{t(fieldErrors[field])}</p>}
            <div className="concern-actions">{concerns.length > 1 && <button type="button" className="text-button" disabled={busy} onClick={() => { changed(field); setFieldErrors((current) => { const next = { ...current }; delete next[field]; return next; }); setConcerns((items) => items.filter((item) => item.uiId !== field)); }}>{t('removeConcern')} {index + 1}</button>}</div>
          </fieldset>;
        })}
        <button className="secondary-button" type="button" disabled={busy || concerns.length >= 30} onClick={() => { changed(); setConcerns((items) => [...items, { uiId: crypto.randomUUID(), type: 'service', wording: '' }]); }}>{t('addConcern')}</button>
        <p className="field-help limit-note">{t('concernLimit')}</p>
      </section>
      <section className="form-section submit-section" aria-labelledby="review-title">
        <h2 id="review-title">{t('reviewTitle')}</h2>
        <label className="declaration" htmlFor="declaration"><input id="declaration" type="checkbox" checked={declaration} disabled={busy} aria-invalid={!!fieldErrors.declaration} aria-describedby={fieldErrors.declaration ? 'declaration-error' : undefined} onChange={(event) => { changed('declaration'); setDeclaration(event.target.checked); }} /><span>{t('declaration')}</span></label>
        {fieldErrors.declaration && <p className="field-error" id="declaration-error">{t(fieldErrors.declaration)}</p>}
        {error && <p role="alert" className="error">{t(error)}</p>}
        <div className="submit-row"><button type="submit" disabled={!enabled || busy}>{busy ? t('savingComplaint') : t('submitComplaint')}</button>{busy && <p className="live-message" role="status" aria-live="polite">{t('savingWait')}</p>}</div>
        {!enabled && <p className="field-help">{t('startSessionToSubmit')}</p>}<p className="field-help">{t('privateReceipt')}</p>
      </section>
    </form>
    <aside className="help-column" aria-label={t('sideNav')}>
      <nav className="section-nav" aria-label={t('sideNav')}><a href="#story-title">{t('sectionStory')}</a><a href="#concerns-title">{t('sectionIssues')} <span className="count-pill">{concerns.length}</span></a><a href="#review-title">{t('sectionReview')}</a></nav>
      <section className="side-status" aria-live="polite"><span className="status-dot" aria-hidden="true"/><div><strong>{t('notSubmitted')}</strong><p>{t('issueCount')}: {concerns.length}</p></div></section>
      <section className="help-block"><h2>{t('writingTipTitle')}</h2><p>{t('writingTip')}</p></section>
    </aside>
  </div>;
}

function CasePage({ ready, signedIn, language, t, onAuthFailure }: { ready: boolean; signedIn: boolean; language: Language; t: Translator; onAuthFailure: () => void }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<CaseRecord>();
  const [state, setState] = useState<'loading' | 'ready' | 'not-found' | 'unavailable' | 'auth-error'>('loading');
  const [loadedId, setLoadedId] = useState<string>();
  const [retry, setRetry] = useState(0);
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
  if (visibleState === 'auth-error') return <section className="notice" role="alert"><h1>{t('authErrorTitle')}</h1><p>{t('authErrorBody')}</p><button type="button" onClick={() => { onAuthFailure(); navigate('/'); }}>{t('restartSession')}</button></section>;
  if (!signedIn) return <section className="notice"><h1>{t('receiptAccess')}</h1><p>{t('receiptAccessBody')}</p><Link to="/">{t('goFile')}</Link></section>;
  if (visibleState === 'not-found') return <section className="notice" role="alert"><h1>{t('notFoundTitle')}</h1><p>{t('notFoundBody')}</p><Link to="/">{t('goFile')}</Link></section>;
  if (visibleState === 'unavailable') return <section className="notice" role="alert"><h1>{t('receiptErrorTitle')}</h1><p>{t('receiptErrorBody')}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>{t('loadReceipt')}</button></section>;
  if (!record || visibleState !== 'ready') return <p className="live-message" role="status" aria-live="polite">{t('loadingReceipt')}</p>;
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  return <article className="receipt" aria-labelledby="receipt-title">
    <div className="receipt-heading"><p className="sample-label">{t('desk')}</p><h1 id="receipt-title">{t('receiptTitle')}</h1><span className="status">{t('receiptStatusSubmitted')}</span></div>
    <dl className="receipt-meta"><div><dt>{t('reference')}</dt><dd className="reference">{record.id}</dd></div><div><dt>{t('submitted')}</dt><dd><time dateTime={record.submittedAt}>{new Date(record.submittedAt).toLocaleString(locale)}</time></dd></div><div><dt>{t('office')}</dt><dd>{t('desk')}</dd></div></dl>
    <section className="saved-account" aria-labelledby="account-title"><h2 id="account-title">{t('originalAccount')}</h2><p className="preserve">{record.narrative}</p><h2 className="concerns-heading">{t('recordedIssues')}</h2>
      <ol className="saved-concerns">{record.concerns.map((concern, index) => <li key={`${index}-${concern.type}`}><div className="saved-concern-label"><span>{t('concern')} {index + 1}</span><span>{t(concern.type)}</span></div><p className="preserve">{concern.wording}</p></li>)}</ol>
    </section>
    <p className="receipt-limit">{t('receiptLimit')}</p><div className="receipt-actions"><button type="button" onClick={() => window.print()}>{t('print')}</button><Link className="secondary-link" to="/">{t('another')}</Link></div>
  </article>;
}

const root = hotData?.root ?? createRoot(document.getElementById('root')!);
if (hotData) hotData.root = root;
root.render(<BrowserRouter><App /></BrowserRouter>);
