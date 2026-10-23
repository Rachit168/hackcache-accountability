import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { complaintSchema, type CaseRecord } from '../domain/complaint';
import './style.css';

type Config = { ready: boolean; url?: string; publishableKey?: string };
type Concern = { type: 'service' | 'conduct' | 'mixed'; wording: string };
let auth: SupabaseClient | undefined;

async function api(path: string, init: RequestInit = {}) {
  const session = await auth?.auth.getSession();
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.data.session?.access_token ?? ''}`,
      ...init.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'The request could not be completed.');
  return body;
}

function App() {
  const [config, setConfig] = useState<Config>();
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [configRetry, setConfigRetry] = useState(0);

  function retryConfig() {
    setError('');
    setConfig(undefined);
    setSignedIn(false);
    setConfigRetry((attempt) => attempt + 1);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Configuration request failed.');
        const value = await response.json() as Config;
        if (!active) return;
        setConfig(value);
        if (value.ready && value.url && value.publishableKey) {
          auth = createClient(value.url, value.publishableKey);
          const { data } = await auth.auth.getSession();
          if (active) setSignedIn(!!data.session);
        }
      } catch {
        if (active) setError('The demo service could not be reached. Check your connection, then try again.');
      }
    })();
    return () => { active = false; };
  }, [configRetry]);

  async function signIn() {
    setBusy(true);
    setError('');
    try {
      const { error: signInError } = await auth!.auth.signInAnonymously();
      if (signInError) throw signInError;
      setSignedIn(true);
    } catch {
      setError('A demo session could not be started. Please try again later.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="demo-strip">Hackathon demo <span>· Fictional data only · No government submission</span></div>
    <header className="site-header">
      <Link to="/" className="brand" aria-label="Janvaani home"><span className="brand-mark" aria-hidden="true">ज</span><span>Janvaani</span></Link>
      <nav aria-label="Main navigation"><Link to="/">Your workspace</Link><a href="#privacy">Privacy</a></nav>
    </header>
    <main>
      <Routes>
        <Route path="/" element={<>
          <div className="page-heading">
            <p className="sample-label">Fictional Municipal Service Desk</p>
            <h1>File a complaint</h1>
            <p>Describe what happened and list the issues you want addressed.</p>
          </div>
          {!config ? error ? <section className="notice" role="alert"><h2>Demo service unavailable</h2><p>{error}</p><button type="button" onClick={retryConfig}>Try again</button></section> : <p className="live-message" role="status">Connecting to the demo service…</p>
            : !config.ready ? <section className="notice" role="status" aria-labelledby="setup-title">
              <h2 id="setup-title">Submission is temporarily unavailable</h2>
              <p>This demo is not connected yet. Your entries will not be saved until submission is available.</p>
              <button type="button" onClick={retryConfig}>Try again</button>
            </section>
              : !signedIn ? <section className="session-notice" aria-labelledby="session-title">
                <div><h2 id="session-title">Start a demo session</h2><p>Access to a saved receipt depends on keeping this browser session. Recovery is unavailable in this demo.</p></div>
                <button type="button" onClick={signIn} disabled={busy}>{busy ? 'Starting session…' : 'Start demo session'}</button>
              </section>
                : <p className="session" role="status">Demo session active. Your entries are not saved until you submit.</p>}
          {error && config && <p className="error" role="alert">{error}</p>}
          <ComplaintForm enabled={signedIn && !!config?.ready} />
        </>} />
        <Route path="/cases/:id" element={<CasePage ready={!!config?.ready} signedIn={signedIn} />} />
        <Route path="*" element={<section className="notice"><h1>Page not found</h1><Link to="/">Return to your workspace</Link></section>} />
      </Routes>
      <section id="privacy" className="privacy" aria-labelledby="privacy-title">
        <h2 id="privacy-title">Using this demo</h2>
        <p>Use fictional details only. Submitting creates a private demo receipt and does not contact a government office. Do not enter real personal or sensitive information.</p>
      </section>
    </main>
    <footer><span>Janvaani · Hack Cache</span><span>Fictional data only</span></footer>
  </>;
}

const typeHelp: Record<Concern['type'], string> = {
  service: 'A request about a service, decision, delay or missing information.',
  conduct: 'A concern about someone’s conduct. Describe it as an allegation or request for review.',
  mixed: 'Use this when the service issue and conduct concern belong together.',
};

function ComplaintForm({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate();
  const [narrative, setNarrative] = useState('');
  const [concerns, setConcerns] = useState<Concern[]>([
    { type: 'service', wording: '' },
    { type: 'conduct', wording: '' },
  ]);
  const [declaration, setDeclaration] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [attempt, setAttempt] = useState(false);
  const payload = { narrative, office: 'SAMPLE_MUNICIPAL_DESK', category: 'SAMPLE_MUNICIPAL_SERVICE', concerns, declaration };

  function changed(field?: string) {
    setError('');
    if (attempt) {
      setKey(crypto.randomUUID());
      setAttempt(false);
    }
    if (field && fieldErrors[field]) {
      setFieldErrors((current) => { const next = { ...current }; delete next[field]; return next; });
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const parsed = complaintSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'narrative') next.narrative = 'Add an account of what happened.';
        if (issue.path[0] === 'concerns' && typeof issue.path[1] === 'number') {
          next[`concern-${issue.path[1]}`] = 'Add the wording for this concern.';
        }
        if (issue.path[0] === 'declaration') next.declaration = 'Confirm the fictional-data declaration before submitting.';
      }
      setFieldErrors(next);
      setError('Review the highlighted fields before submitting.');
      return;
    }
    setFieldErrors({});
    setBusy(true);
    setAttempt(true);
    try {
      const receipt = await api('/complaints', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify(parsed.data),
      });
      navigate(`/cases/${receipt.id}`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="form-layout">
    <form onSubmit={submit} className="form-surface" noValidate>
      <section className="form-section" aria-labelledby="story-title">
        <h2 id="story-title">What happened</h2>
        <p className="section-intro">Write what happened, where and when, and what response you need. Use fictional details only.</p>
        <label className="field-label" htmlFor="narrative">Your account</label>
        <textarea id="narrative" aria-describedby={`narrative-help${fieldErrors.narrative ? ' narrative-error' : ''}`} aria-invalid={!!fieldErrors.narrative} maxLength={12000} rows={6} value={narrative} onChange={(event) => { changed('narrative'); setNarrative(event.target.value); }} placeholder="For example: I visited the fictional permit desk on sample day 4…" disabled={busy} />
        <p className="field-help" id="narrative-help">Include the details needed to understand the event. Avoid real personal information.</p>
        {fieldErrors.narrative && <p className="field-error" id="narrative-error">{fieldErrors.narrative}</p>}
        <p className="counter" aria-live="polite">{narrative.length.toLocaleString()} / 12,000 characters</p>
      </section>

      <section className="form-section" aria-labelledby="concerns-title">
        <h2 id="concerns-title">Issues to address</h2>
        <p className="section-intro">List each issue separately so the saved record keeps your wording and order.</p>
        {concerns.map((concern, index) => {
          const field = `concern-${index}`;
          return <fieldset className="concern" key={index}>
            <legend>Concern {index + 1}</legend>
            <label className="field-label" htmlFor={`${field}-type`}>Type</label>
            <select id={`${field}-type`} aria-label={`Type for concern ${index + 1}`} value={concern.type} disabled={busy} onChange={(event) => { changed(); setConcerns((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as Concern['type'] } : item)); }}>
              <option value="service">Service request</option><option value="conduct">Conduct concern</option><option value="mixed">Mixed concern</option>
            </select>
            <p className="field-help">{typeHelp[concern.type]}</p>
            <label className="field-label" htmlFor={`${field}-wording`}>Your wording</label>
            <textarea id={`${field}-wording`} aria-describedby={fieldErrors[field] ? `${field}-error` : undefined} aria-invalid={!!fieldErrors[field]} rows={3} maxLength={2000} value={concern.wording} disabled={busy} onChange={(event) => { changed(field); setConcerns((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, wording: event.target.value } : item)); }} placeholder="Describe the issue you want addressed." />
            {fieldErrors[field] && <p className="field-error" id={`${field}-error`}>{fieldErrors[field]}</p>}
            <div className="concern-actions">{concerns.length > 1 && <button type="button" className="text-button" disabled={busy} onClick={() => { changed(); setConcerns((items) => items.filter((_, itemIndex) => itemIndex !== index)); }}>Remove concern {index + 1}</button>}</div>
          </fieldset>;
        })}
        <button className="secondary-button" type="button" disabled={busy || concerns.length >= 30} onClick={() => { changed(); setConcerns((items) => [...items, { type: 'service', wording: '' }]); }}>Add another concern</button>
        <p className="field-help limit-note">Up to 30 concerns. Service requests concern an outcome or information; conduct concerns ask for review of behaviour.</p>
      </section>

      <section className="form-section submit-section" aria-labelledby="review-title">
        <h2 id="review-title">Review and submit</h2>
        <label className="declaration" htmlFor="declaration">
          <input id="declaration" type="checkbox" checked={declaration} disabled={busy} aria-invalid={!!fieldErrors.declaration} aria-describedby={fieldErrors.declaration ? 'declaration-error' : undefined} onChange={(event) => { changed('declaration'); setDeclaration(event.target.checked); }} />
          <span>This is fictional demonstration data. I have reviewed the account and each concern.</span>
        </label>
        {fieldErrors.declaration && <p className="field-error" id="declaration-error">{fieldErrors.declaration}</p>}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="submit-row">
          <button type="submit" disabled={!enabled || busy}>{busy ? 'Saving complaint…' : 'Submit complaint'}</button>
          {busy && <p className="live-message" role="status" aria-live="polite">Saving your complaint. Please wait.</p>}
        </div>
        {!enabled && <p className="field-help">Start a demo session to enable submission. Your entries have not been saved.</p>}
        <p className="field-help">Submitting creates a private demo receipt. It does not contact a government office.</p>
      </section>
    </form>
    <aside className="help-column" aria-label="Writing guidance">
      <section className="help-block"><h2>Writing guidance</h2><p>Keep the account in your own words. Separate issues when they need different responses.</p><ul><li>Use dates or places only if they are fictional.</li><li>Do not include real names or contact details.</li><li>Submitting does not send this to an office.</li></ul></section>
      <section className="help-block"><h2>Before you leave</h2><p>Entries are not saved as a draft. After submission, access to your receipt depends on this browser session. Recovery is unavailable in the demo.</p></section>
    </aside>
  </div>;
}

const concernTypeLabel: Record<Concern['type'], string> = {
  service: 'Service request',
  conduct: 'Conduct concern',
  mixed: 'Mixed concern',
};

function CasePage({ ready, signedIn }: { ready: boolean; signedIn: boolean }) {
  const { id } = useParams();
  const [record, setRecord] = useState<CaseRecord>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!ready || !signedIn) return;
    let active = true;
    api(`/complaints/${id}`).then((value) => { if (active) setRecord(value); }).catch((caught) => { if (active) setError((caught as Error).message); });
    return () => { active = false; };
  }, [id, ready, signedIn]);

  if (!ready || !signedIn) return <section className="notice"><h1>Open this receipt in your demo session</h1><p>This private receipt requires the browser session used to submit it. Recovery is unavailable in this demo.</p><Link to="/">Go to File a complaint</Link></section>;
  if (error) return <section className="notice" role="alert"><h1>Receipt unavailable</h1><p>This receipt could not be found in your session.</p><Link to="/">Return to File a complaint</Link></section>;
  if (!record) return <p className="live-message" role="status" aria-live="polite">Loading saved complaint…</p>;

  return <article className="receipt" aria-labelledby="receipt-title">
    <div className="receipt-heading"><p className="sample-label">Fictional Municipal Service Desk</p><h1 id="receipt-title">Complaint submitted</h1><span className="status">{record.status}</span></div>
    <dl className="receipt-meta">
      <div><dt>Complaint reference</dt><dd className="reference">{record.id}</dd></div>
      <div><dt>Submitted</dt><dd><time dateTime={record.submittedAt}>{new Date(record.submittedAt).toLocaleString()}</time></dd></div>
      <div><dt>Office</dt><dd>Fictional Municipal Service Desk</dd></div>
    </dl>
    <section className="saved-account" aria-labelledby="account-title">
      <h2 id="account-title">Your original account</h2>
      <p className="preserve">{record.narrative}</p>
      <h2 className="concerns-heading">Issues recorded</h2>
      <ol className="saved-concerns">{record.concerns.map((concern, index) => <li key={`${index}-${concern.type}`}>
        <div className="saved-concern-label"><span>Concern {index + 1}</span><span>{concernTypeLabel[concern.type]}</span></div>
        <p className="preserve">{concern.wording}</p>
      </li>)}</ol>
    </section>
    <p className="receipt-limit">This receipt confirms what was saved in the demo. No government office has received it.</p>
    <div className="receipt-actions"><button type="button" onClick={() => window.print()}>Print or save receipt</button><Link className="secondary-link" to="/">Start another complaint</Link></div>
  </article>;
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>);
