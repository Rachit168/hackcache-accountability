export type WizardProgress={current:number;furthest:number};
export function visitWizard(progress:WizardProgress,target:number):WizardProgress{return Number.isInteger(target)&&target>=0&&target<=progress.furthest?{...progress,current:target}:progress;}
export function continueWizard(progress:WizardProgress,valid:boolean):WizardProgress{if(!valid||progress.current>=3)return progress;const current=progress.current+1;return {current,furthest:Math.max(current,progress.furthest)};}
