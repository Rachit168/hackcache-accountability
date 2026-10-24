import {z} from 'zod';
const refs=(max:number)=>z.array(z.uuid()).max(max).refine(a=>new Set(a).size===a.length);
export const disputeSchema=z.object({targetKind:z.enum(['office_response','demo_closure_claim']),targetId:z.uuid(),reason:z.string().max(4000).refine(s=>s.trim().length>=10),concernIds:refs(8),evidenceIds:refs(5)}).strict();
