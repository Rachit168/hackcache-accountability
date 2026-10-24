import React,{useRef,useState} from 'react';
import type {Language} from './i18n';
import {fileSize} from '../domain/intake-ai';
type Item={key:string;file:File;state:'selected'|'uploading'|'ready'|'failed';id?:string};
type Api=<T>(path:string,init?:RequestInit)=>Promise<T>;
const MAX_FILES=5,MAX_BYTES=8*1024*1024,MAX_TOTAL=30*1024*1024;
const allowed=/\.(?:jpe?g|png|pdf|txt|wav|mp3|ogg|webm|mp4)$/i;
export function EvidenceUpload({api,language,disabled,onChange}:{api:Api;language:Language;disabled:boolean;onChange:(ids:string[],ready:boolean)=>void}){
 const [items,setItems]=useState<Item[]>([]),[issue,setIssue]=useState<'limits'|'format'|null>(null);
 const itemsRef=useRef<Item[]>([]),processing=useRef(false),hi=language==='hi';
 function publish(next:Item[]){itemsRef.current=next;setItems(next);onChange(next.flatMap(v=>v.state==='ready'&&v.id?[v.id]:[]),next.every(v=>v.state==='ready'));}
 function change(key:string,updates:Partial<Item>){publish(itemsRef.current.map(v=>v.key===key?{...v,...updates}:v));}
 async function upload(item:Item){
  change(item.key,{state:'uploading'});
  try{
   const result=await api<{id:string}>('/evidence',{method:'POST',headers:{'Content-Type':'application/octet-stream','Idempotency-Key':item.key,'X-Evidence-Name':encodeURIComponent(item.file.name)},body:item.file});
   if(!result?.id)throw Error('Unconfirmed upload');
   if(itemsRef.current.some(v=>v.key===item.key))change(item.key,{id:result.id,state:'ready'});
  }catch{if(itemsRef.current.some(v=>v.key===item.key))change(item.key,{state:'failed'});}
 }
 async function flush(){
  if(processing.current)return;
  processing.current=true;
  try{while(true){const next=itemsRef.current.find(v=>v.state==='selected');if(!next)break;await upload(next);}}
  finally{processing.current=false;}
 }
 function select(files:File[]){
  if(!files.length)return;
  const current=itemsRef.current;
  const unique=files.filter(f=>!current.some(v=>v.file.name===f.name&&v.file.size===f.size&&v.file.lastModified===f.lastModified));
  if(!unique.length){setIssue(null);return;}
  if(unique.some(f=>!allowed.test(f.name))){setIssue('format');return;}
  if(current.length+unique.length>MAX_FILES||unique.some(f=>!f.size||f.size>MAX_BYTES)||current.reduce((n,v)=>n+v.file.size,0)+unique.reduce((n,f)=>n+f.size,0)>MAX_TOTAL){setIssue('limits');return;}
  setIssue(null);publish([...current,...unique.map(file=>({key:crypto.randomUUID(),file,state:'selected' as const}))]);void flush();
 }
 const working=items.some(v=>v.state==='uploading'||v.state==='selected');
 const success=items.filter(v=>v.state==='ready').length;
 return <section className="form-section" aria-labelledby="evidence-upload-title">
  <h2 id="evidence-upload-title">{hi?'निजी साक्ष्य (वैकल्पिक)':'Private evidence (optional)'}</h2>
  <p className="section-intro">{hi?'फ़ाइल चुनते ही निजी अपलोड शुरू होगा।':'Select a file to start its private upload automatically.'}</p>
  <p className="field-help">{hi?'अधिकतम 5 फ़ाइलें, कुल 30 MiB, प्रत्येक 8 MiB। JPG/PNG, PDF/TXT, WAV/MP3/Ogg, WebM/MP4। केवल काल्पनिक डेटा दें।':'Up to 5 files, 30 MiB total, 8 MiB each. JPG/PNG, PDF/TXT, WAV/MP3/Ogg, WebM/MP4. Fictional data only.'}</p>
  <p className="field-help">{hi?'फ़ाइल अपलोड सत्यता या सुरक्षा प्रमाणित नहीं करता। वीडियो के दृश्य भाग का AI विश्लेषण नहीं होगा।':'An upload does not establish authenticity or safety. AI processing does not analyse video images.'}</p>
  <label className="upload-picker"><strong>{hi?'फ़ाइल चुनें या रिकॉर्डिंग जोड़ें':'Choose files or add a recording'}</strong><span>{hi?'अपने फ़ोन या कंप्यूटर से चुनें':'Select from your phone or computer'}</span>
   <input type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.txt,.wav,.mp3,.ogg,.webm,.mp4,audio/*,video/webm,video/mp4" disabled={disabled||working} onChange={event=>{select(Array.from(event.currentTarget.files??[]));event.currentTarget.value='';}}/>
  </label>
  {issue&&<p role="alert" className="field-error">{issue==='format'?(hi?'फ़ाइल का प्रकार समर्थित नहीं है।':'Unsupported file type.'):(hi?'फ़ाइलों की संख्या या आकार सीमा से अधिक है।':'File count or size exceeds limits.')}</p>}
  <p role="status" className="field-help" aria-live="polite">{working?(hi?'निजी अपलोड जारी है। पूरा होने दें।':'Uploading privately. Complete uploads before continuing.'):success?(hi?String(success)+' फ़ाइलें तैयार हैं।':String(success)+' uploaded file(s) ready.'):(hi?'अभी कोई साक्ष्य नहीं जोड़ा।':'No evidence added yet.')}</p>
  {!!items.length&&<ul className="evidence-list">{items.map(item=><li className="evidence-file" key={item.key}>
   <div className="evidence-file-main"><strong className="preserve">{item.file.name}</strong><span>{fileSize(item.file.size)}</span></div>
   <span role="status" className={'upload-state upload-'+item.state}>{({selected:hi?'प्रतीक्षा में':'Queued',uploading:hi?'अपलोड जारी है…':'Uploading…',ready:hi?'अपलोड की पुष्टि हुई':'Upload confirmed',failed:hi?'अपलोड असफल या अपुष्ट':'Upload failed or unconfirmed'})[item.state]}</span>
   <div className="evidence-actions">{item.state==='failed'&&<button type="button" className="secondary-button" disabled={disabled||working} onClick={()=>{change(item.key,{state:'selected'});void flush();}}>{hi?'उसी अपलोड का पुनः प्रयास':'Retry same upload'}</button>}
    <button type="button" className="text-button" disabled={disabled||working} onClick={()=>{publish(itemsRef.current.filter(v=>v.key!==item.key));setIssue(null);}}>{hi?'हटाएँ':'Remove'}</button></div>
  </li>)}</ul>}
 </section>;
}
