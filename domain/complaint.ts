import { z } from 'zod';
export const complaintLimits = { narrative: 12000, concernWording: 2000, concerns: 30 } as const;
// Bound raw UTF-16 length before trimming, so padding cannot bypass field bounds.
export const concernSchema = z.object({type:z.enum(['service','conduct','mixed']),wording:z.string().max(complaintLimits.concernWording).trim().min(1)}).strict();
export const complaintSchema = z.object({narrative:z.string().max(complaintLimits.narrative).trim().min(1),office:z.literal('SAMPLE_MUNICIPAL_DESK'),category:z.literal('SAMPLE_MUNICIPAL_SERVICE'),concerns:z.array(concernSchema).min(1).max(complaintLimits.concerns),declaration:z.literal(true),evidenceIds:z.array(z.string().uuid()).max(5).optional(),intakeReviewId:z.string().uuid().optional()}).strict();
export const uuidSchema = z.string().uuid();
export type ComplaintInput = z.infer<typeof complaintSchema>;
export type Receipt = {id:string; submittedAt:string; status:'submitted'};
export type CaseRecord = Receipt & ComplaintInput;
