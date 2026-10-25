import React from 'react';
import type {Language} from './i18n';

export type RoleQueue={kind:string;cases?:{id:string}[]};

export function isAuthorizedRoleQueue(view:RoleQueue):boolean{
 return (view.kind==='reviewer'||view.kind==='office')&&Array.isArray(view.cases);
}

/** All wording is derived from the authenticated server's scoped queue.
 * There is no client-side role selection, global case count or fabricated SLA.
 */
export function StaffRoleSummary({view,language}:{view:RoleQueue;language:Language}){
 if(!isAuthorizedRoleQueue(view))return null;
 const hi=language==='hi',reviewer=view.kind==='reviewer';
 return <section className="staff-role-summary" aria-label={hi?'सर्वर से सत्यापित कर्मचारी भूमिका':'Server-authorized staff role'}>
  <div className="staff-role-summary-top">
   <div><p className="eyebrow">{hi?'सर्वर से सत्यापित भूमिका':'Server-authorized workspace'}</p>
   <h2>{reviewer?(hi?'समीक्षक कार्यक्षेत्र':'Reviewer workspace'):(hi?'कार्यालय कार्यक्षेत्र':'Office workspace')}</h2></div>
   <span className="staff-role-pill">{reviewer?(hi?'समीक्षक':'Reviewer'):(hi?'कार्यालय कर्मी':'Office staff')}</span>
  </div>
  <p>{reviewer?(hi?'आप केवल अपने लिए आवंटित शिकायतें देख सकते हैं। मूल साक्ष्य जाँचें, कार्यालय संस्करण तैयार करें और उसे जारी करें।':'Only explicitly assigned cases appear here. Review the original complaint and evidence, then prepare and release the approved office-facing version.'):(hi?'आपको केवल अपने कार्यालय को जारी संस्करण दिखेंगे। पहले प्राप्ति स्वीकार करें, फिर लिखित जवाब दें।':'Only versions released to your assigned fictional office appear here. Acknowledge the released version before submitting a written response.')}</p>
  {!view.cases?.length&&<p className="staff-role-empty">{reviewer?(hi?'भूमिका सक्रिय है, लेकिन अभी कोई मामला आवंटित नहीं है। केवल प्रोजेक्ट प्रशासक किसी मौजूदा शिकायत को इस समीक्षक को सौंप सकता है।':'Your reviewer role is active, but no case has been assigned. A project administrator must assign an existing complaint before it appears here.'):(hi?'कार्यालय भूमिका सक्रिय है। जब समीक्षक आपके कार्यालय को संस्करण जारी करेगा, तब मामला दिखाई देगा।':'Your office role is active. Cases appear only after a reviewer releases a version to your department.')}</p>}
 </section>;
}
