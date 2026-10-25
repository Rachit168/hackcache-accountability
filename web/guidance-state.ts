export function guidanceSituation(history:{action:string}[]){return history.some(e=>e.action==='response')?'response':history.some(e=>e.action==='acknowledge')?'acknowledged':'awaiting';}
