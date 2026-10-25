import React,{useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Language} from './i18n';
import {StaffSession,WorkflowWorkspace} from './workflow';
type StaffApi=<T=unknown>(path:string,init?:RequestInit)=>Promise<T>;
export function StaffPortal({client,active,onReady,api,language}:{client?:SupabaseClient;active:boolean;onReady:()=>void;api:StaffApi;language:Language}){
 const hi=language==='hi';const [revision,setRevision]=useState(0);function sessionReady(){setRevision(v=>v+1);onReady();}
 return <div className="staff-portal">
  <p className="eyebrow">{hi?'केवल अनुमति प्राप्त डेमो कर्मचारी':'Provisioned demo operators only'}</p>
  <h1>{hi?'नमूना कार्यालय कार्यक्षेत्र':'Fictional office workspace'}</h1>
  <p className="staff-intro">{hi?'यह नागरिक शिकायत फॉर्म नहीं है। केवल इस प्रदर्शन के लिए नियुक्त समीक्षक या कार्यालय कर्मचारी यहाँ अपना निजी सत्र खोल सकते हैं।':'This is not the citizen complaint form. Only assigned demo reviewers and fictional office operators can open their private session here.'}</p>
  <div className="staff-steps">
   <p><strong>1.</strong> {hi?'समीक्षक को आवंटित मामला दिखता है और वह कार्यालय के लिए संस्करण जारी करता है।':'An assigned reviewer sees a case and releases an office-facing version.'}</p>
   <p><strong>2.</strong> {hi?'सही कार्यालय कर्मचारी जारी हुआ संस्करण देखकर प्राप्ति और जवाब दर्ज कर सकता है।':'The assigned office operator can acknowledge and respond to the released version.'}</p>
   <p><strong>3.</strong> {hi?'नागरिक अपने निजी केस में वह जवाब देख सकता है।':'The citizen can review the recorded response in their private case.'}</p>
  </div>
  {client?<StaffSession client={client} onReady={sessionReady} language={language}/>:<p role="status">{hi?'सुरक्षित डेमो कनेक्शन खुल रहा है…':'Connecting to the private demo service…'}</p>}
  {active?<><p className="staff-active" role="status">{hi?'डेमो कर्मचारी सत्र सक्रिय है। केवल आवंटित मामले दिखेंगे।':'Demo operator session active. Only assigned cases are accessible.'}</p><WorkflowWorkspace key={revision} api={api} language={language}/></>:<p className="session-caution">{hi?'आपको आयोजक/प्रोजेक्ट ऑपरेटर से मिला निजी JSON सत्र चाहिए। नागरिक सत्र या रसीद यहाँ प्रवेश नहीं देते।':'You need a private JSON session provisioned by the project operator. A citizen session or receipt does not grant access.'}</p>}
 </div>;
}
