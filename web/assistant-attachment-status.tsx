import React from 'react';
import type {Language} from './i18n';

/** Distinct, padded confirmation following the optional AI attachment action.
 * Informational only: the citizen's original account and questions are unchanged.
 */
export function AssistantAttachmentStatus({language}:{language:Language}){
 const hi=language==='hi';
 return <section className="ai-attachment-confirmation" role="status" aria-label={hi?'AI सुझाव जोड़े गए':'AI suggestions attached'}>
  <div className="ai-attachment-confirmation-heading">
   <span className="ai-attachment-confirmation-mark" aria-hidden="true">✓</span>
   <strong>{hi?'AI सुझाव समीक्षा के लिए जोड़े गए':'AI suggestions attached for review'}</strong>
  </div>
  <p>{hi?'आपकी लिखी कहानी और सवाल नहीं बदले हैं। भेजने से पहले विवरण की जाँच करें और घोषणा स्वीकार करें।':'Your original story and questions remain unchanged. Review the details and confirm the declaration before submitting.'}</p>
 </section>;
}
