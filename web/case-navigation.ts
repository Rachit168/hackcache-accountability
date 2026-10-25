// Presentation-only navigation. Never treats a missing or failed API read as a confirmed response.
export type CasePanel='overview'|'evidence'|'timeline'|'response'|'audit'|'next';
export type ResponseCheck='checking'|'available'|'missing'|'error';
export function casePanels(check:ResponseCheck):CasePanel[]{
 return check==='available'?['overview','evidence','timeline','response','audit','next']:['overview','evidence','timeline','next'];
}
export function resolveCasePanel(requested:string|null,check:ResponseCheck,deepLinkToResponse=false):CasePanel{
 const panels=casePanels(check);
 if(requested&&panels.includes(requested as CasePanel))return requested as CasePanel;
 return deepLinkToResponse&&check==='available'?'audit':'overview';
}
export function adjacentCasePanel(current:CasePanel,check:ResponseCheck,direction:-1|1):CasePanel|null{
 const panels=casePanels(check),currentIndex=panels.indexOf(current);
 if(currentIndex<0)return null;
 return panels[currentIndex+direction]??null;
}
