import { complaintLimits } from '../domain/complaint.js';

// At most 6 bytes per UTF-16 unit: JSON may encode a unit as \uXXXX.
// Multiplying the entire empty envelope by 6 also covers escaped keys and
// fixed string values, and conservatively overcounts punctuation/booleans.
const envelope = {
  narrative: '', office: 'SAMPLE_MUNICIPAL_DESK', category: 'SAMPLE_MUNICIPAL_SERVICE',
  concerns: Array.from({ length: complaintLimits.concerns }, () => ({ type: 'service', wording: '' })),
  declaration: true,
};
export const maximumCompactComplaintBytes = 6 * (
  complaintLimits.narrative + complaintLimits.concerns * complaintLimits.concernWording
  + Buffer.byteLength(JSON.stringify(envelope), 'utf8')
);
export const complaintRequestLimitBytes = 512 * 1024;
if (maximumCompactComplaintBytes > complaintRequestLimitBytes) {
  throw new Error('Complaint schema exceeds the configured request transport bound.');
}
// Arbitrary JSON whitespace/padding is not unbounded: the transport still caps
// the entire decoded body. Field validity alone does not bypass that cap.
