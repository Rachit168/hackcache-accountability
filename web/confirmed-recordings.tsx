import React from 'react';
import type {Language} from './i18n';
import type {EvidenceSummary} from './evidence-summary';
import {fileSize} from '../domain/intake-ai';

export function ConfirmedRecordings({
 files,language,disabled,onRemove,
}:{files:EvidenceSummary[];language:Language;disabled:boolean;onRemove:(id:string)=>void}){
 if(!files.length)return null;
 const hi=language==='hi';
 return <section className="confirmed-recordings" aria-labelledby="confirmed-recordings-title">
  <h3 id="confirmed-recordings-title">{hi?'निजी रूप से अपलोड की गई रिकॉर्डिंग':'Privately uploaded recordings'}</h3>
  <ul className="confirmed-recordings-list">{files.map(file=>
   <li className="confirmed-recording" key={file.id}>
    <div className="confirmed-recording-details">
     <strong className="confirmed-recording-name">{file.name}</strong>
     <span className="confirmed-recording-meta">{fileSize(file.bytes)} · {hi?'अपलोड की पुष्टि हुई':'Upload confirmed'}</span>
    </div>
    <button type="button" className="danger-button" disabled={disabled}
     aria-label={hi?`रिकॉर्डिंग हटाएँ: ${file.name}`:`Remove recording: ${file.name}`}
     onClick={()=>onRemove(file.id)}>{hi?'हटाएँ':'Remove'}</button>
   </li>)}</ul>
 </section>;
}
