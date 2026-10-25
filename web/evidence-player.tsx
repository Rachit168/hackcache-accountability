import React,{useEffect,useState} from 'react';
import type {Language} from './i18n';
export function EvidencePlayer({id,api,language}:{id:string;api:<T>(path:string)=>Promise<T>;language:Language}){
 const [url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(false);const hi=language==='hi';
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
 async function load(){setBusy(true);setError(false);try{const blob=await api<Blob>('/evidence/'+id+'/playback');if(!(blob instanceof Blob)||!blob.size||blob.size>8*1024*1024)throw Error();setUrl(URL.createObjectURL(blob));}catch{setError(true);}finally{setBusy(false);}}
 return <div className="evidence-player">{url?<audio controls src={url} aria-label={hi?'संलग्न रिकॉर्डिंग सुनें':'Listen to attached recording'}/>:<button type="button" className="secondary-button" disabled={busy} onClick={()=>void load()}>{busy?(hi?'रिकॉर्डिंग खुल रही है…':'Loading recording…'):(hi?'रिकॉर्डिंग सुनें':'Listen to recording')}</button>}{error&&<p role="alert">{hi?'रिकॉर्डिंग नहीं खुली या पहुँच अस्वीकृत है। फिर प्रयास करें या निजी डाउनलोड चुनें।':'Recording unavailable or access denied. Retry or use private download.'}</p>}</div>;
}
