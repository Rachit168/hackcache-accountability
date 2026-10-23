import React,{useState} from 'react';
import {verifyRecord,type LedgerRecord} from '../domain/record-verification';
import type {Language} from './i18n';
export function RecordVerification({id,api,language}:{id:string;api:<T>(path:string)=>Promise<T>;language:Language}){
 const [busy,setBusy]=useState(false);const [result,setResult]=useState<Awaited<ReturnType<typeof verifyRecord>>>();const [error,setError]=useState(false);
 const hi=language==='hi';
 return <section className="notice"><h3>{hi?'रिकॉर्ड की जाँच':'Record verification'}</h3><button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError(false);setResult(undefined);try{setResult(await verifyRecord(await api<LedgerRecord>('/records/'+encodeURIComponent(id))));}catch{setError(true);}finally{setBusy(false);}}}>{busy?(hi?'जाँच जारी है…':'Verifying…'):(hi?'इस रिकॉर्ड की जाँच करें':'Verify this record')}</button>
 {error&&<p role="alert">{hi?'रिकॉर्ड उपलब्ध नहीं है या पहुँच की अनुमति नहीं है। फिर प्रयास करें।':'Record unavailable or access denied. Please retry.'}</p>}
 {result&&<div role="status"><p>{result.valid?(hi?'घटना शृंखला: जाँच सफल।':'Event chain: verification passed.'):(hi?'घटना शृंखला: जाँच असफल या अधूरी।':'Event chain: failed or incomplete.')} {result.failure} {result.sequence&&`${hi?'घटना':'Event'} ${result.sequence}`}</p>{result.legacy&&<p>{hi?'पुराना इतिहास माइग्रेशन के समय दर्ज आधार से शुरू होता है; पहले की सुरक्षा या क्रम प्रमाणित नहीं है।':'Older history starts with a migration-time baseline; its prior protection and ordering are unknown.'}</p>}<p>{hi?'साक्ष्य की फ़ाइलों की जाँच नहीं हुई है।':'Evidence bytes: not checked.'}</p></div>}
 <p className="field-help">{hi?'हैश आरोप या रिकॉर्डिंग की सच्चाई साबित नहीं करते। बाहरी प्रतिबद्धता के बिना विशेषाधिकार वाला संचालक पूरी शृंखला बदल या छोटी कर सकता है।':'Hashes do not prove an allegation or recording is true. Without external anchoring, a privileged operator can rewrite the entire chain or truncate it and replace its head.'}</p></section>;
}
