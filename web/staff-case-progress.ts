import type {Language} from './i18n';

export type StaffCaseTab='case'|'evidence'|'actions'|'history';
export type StaffJourneyView={
 kind:string;
 versions?:{id:string}[];
 history?:{versionId:string;action:string}[];
};
export type StaffJourneyStep={id:'received'|'released'|'acknowledged'|'answered';label:string;done:boolean;current:boolean};
export type StaffJourney={
 role:'reviewer'|'office';
 steps:StaffJourneyStep[];
 next:string;
 explanation:string;
 action:string;
 target:StaffCaseTab;
};

export function staffCaseJourney(view:StaffJourneyView,language:Language):StaffJourney|null{
 if(view.kind!=='reviewer'&&view.kind!=='office')return null;
 const hi=language==='hi';
 const latest=view.versions?.at(-1);
 const latestEvents=(view.history??[]).filter(h=>h.versionId===latest?.id);
 const released=!!latest;
 const acknowledged=latestEvents.some(h=>h.action==='acknowledge');
 const answered=latestEvents.some(h=>h.action==='response');
 if(view.kind==='reviewer'){
  const steps:StaffJourneyStep[]=[
   {id:'received',label:hi?'निजी शिकायत सौंप दी गई':'Assigned private complaint',done:true,current:false},
   {id:'released',label:hi?'कार्यालय संस्करण जारी':'Office version released',done:released,current:!released},
   {id:'answered',label:hi?'कार्यालय जवाब दर्ज':'Office reply recorded',done:answered,current:released&&!answered}
  ];
  if(!released)return {role:'reviewer',steps,next:hi?'कार्यालय के लिए अलग संस्करण तैयार करें':'Prepare a separate office-facing version',explanation:hi?'मूल शिकायत और निजी साक्ष्य की जाँच करें। केवल मंज़ूर किया गया संस्करण कार्यालय को मिलेगा।':'Review the citizen’s original account and private evidence first. Only an approved version reaches the office.',action:hi?'समीक्षा शुरू करें':'Review and prepare',target:'actions'};
  if(!answered)return {role:'reviewer',steps,next:hi?'कार्यालय कार्रवाई का रिकॉर्ड देखें':'Watch for a recorded office action',explanation:hi?'कार्यालय को संस्करण जारी है। जवाब अभी इस संस्करण के लिए दर्ज नहीं है।':'The outgoing version is released. No reply is recorded against this version yet.',action:hi?'इतिहास देखें':'View history',target:'history'};
  return {role:'reviewer',steps,next:hi?'जवाब की जाँच करें':'Check the recorded office reply',explanation:hi?'जवाब दर्ज है, लेकिन इससे समस्या हल होने की पुष्टि नहीं होती।':'A reply is recorded; this does not verify that the issue was resolved.',action:hi?'साक्ष्य और जवाब जाँचें':'Review evidence and reply',target:'evidence'};
 }
 const steps:StaffJourneyStep[]=[
  {id:'released',label:hi?'कार्यालय को संस्करण मिला':'Released version received',done:released,current:!released},
  {id:'acknowledged',label:hi?'प्राप्ति दर्ज':'Receipt acknowledged',done:acknowledged,current:released&&!acknowledged},
  {id:'answered',label:hi?'लिखित जवाब दर्ज':'Written response recorded',done:answered,current:acknowledged&&!answered}
 ];
 if(!released)return {role:'office',steps,next:hi?'मंज़ूर संस्करण की प्रतीक्षा':'Await a released version',explanation:hi?'इस विभाग के लिए अभी कोई जारी संस्करण नहीं दिखता।':'No office-facing version is currently recorded for this case.',action:hi?'रिकॉर्ड देखें':'Review record',target:'history'};
 if(!acknowledged)return {role:'office',steps,next:hi?'इस संस्करण की प्राप्ति स्वीकार करें':'Acknowledge this released version',explanation:hi?'केवल आपके विभाग को जारी जानकारी दिखती है। पहले प्राप्ति दर्ज करें।':'You can see only the material released to your department. Acknowledge receipt before replying.',action:hi?'प्राप्ति दर्ज करें':'Acknowledge receipt',target:'actions'};
 if(!answered)return {role:'office',steps,next:hi?'इस संस्करण पर लिखित जवाब दें':'Write a response to this version',explanation:hi?'प्राप्ति स्वीकार है। जवाब विशिष्ट सवालों को संबोधित करे और केवल दावा किए गए काम बताए।':'Receipt is recorded. Address the released questions and describe only work actually claimed, not verified resolution.',action:hi?'जवाब लिखें':'Write response',target:'actions'};
 return {role:'office',steps,next:hi?'अपने दर्ज जवाब की समीक्षा करें':'Review the recorded response',explanation:hi?'जवाब दर्ज है। समाधान या नागरिक की सहमति सत्यापित नहीं हुई।':'A response exists. Resolution and citizen agreement remain unverified.',action:hi?'इतिहास देखें':'View response history',target:'history'};
}

/** Browsing a historic office version changes only the displayed server-authorized
 * version. It never grants access, changes a submitted command or changes the
 * status summary of the latest released version.
 */
export function displayedWorkflowVersions<T extends {id:string}>(
 kind:string,versions:readonly T[]|undefined,selection:string,
):T[]{
 if(!versions)return [];
 if(kind!=='office')return [...versions];
 const chosen=selection==='latest'?versions.at(-1)?.id:selection;
 return versions.filter(version=>version.id===chosen);
}

/** Determine the single pending operation for a version actually returned by
 * the server. History is scoped by version ID, never by case-wide last action.
 * A response means the office action is recorded, not that the case is resolved.
 */
export function nextOfficeVersionAction(
 versionId:string,history:readonly {versionId:string;action:string}[]|undefined
):'acknowledge'|'response'|'complete'{
 const events=(history??[]).filter(event=>event.versionId===versionId);
 if(events.some(event=>event.action==='response'))return 'complete';
 return events.some(event=>event.action==='acknowledge')?'response':'acknowledge';
}
