import { z } from 'zod';
export const concernSchema = z.object({type:z.enum(['service','conduct','mixed']),wording:z.string().trim().min(1).max(2000)}).strict();
export const complaintSchema = z.object({narrative:z.string().trim().min(1).max(12000),office:z.literal('SAMPLE_MUNICIPAL_DESK'),category:z.literal('SAMPLE_MUNICIPAL_SERVICE'),concerns:z.array(concernSchema).min(1).max(30),declaration:z.literal(true)}).strict();
export const uuidSchema = z.string().uuid();
export type ComplaintInput = z.infer<typeof complaintSchema>;
export type Receipt = {id:string; submittedAt:string; status:'submitted'};
export type CaseRecord = Receipt & ComplaintInput;
