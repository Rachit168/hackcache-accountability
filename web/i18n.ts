export type Language = 'en' | 'hi';
export type CopyKey = keyof typeof copy.en;

const englishCopy = {
    pageTitle: 'Janvaani · Citizen complaint workspace', demo: 'Hackathon demo', fictional: 'Fictional data only · No government submission', brandHome: 'Janvaani home',
    workspace: 'Your workspace', privacy: 'Privacy', language: 'Language', english: 'English', hindi: 'हिंदी',
    desk: 'Fictional Municipal Service Desk', fileTitle: 'File a complaint', fileIntro: 'Describe what happened and list the issues you want addressed.',
    unavailable: 'Demo service unavailable', retry: 'Try again', connecting: 'Connecting to the demo service…',
    setupTitle: 'Submission is temporarily unavailable', setupBody: 'This demo is not connected yet. Your entries will not be saved until submission is available.',
    startSession: 'Start a demo session', sessionRecovery: 'Saved receipts belong to this browser identity. Keep this session; starting a new one cannot restore them.',
    starting: 'Starting session…', sessionStartError: 'A demo session could not be started. Please try again later.',
    sessionActive: 'Demo session active. Your entries are not saved until you submit.',
    serviceConnectionError: 'The demo service could not be reached. Check your connection, then try again.',
    storyTitle: 'What happened', storyIntro: 'Write what happened, where and when, and what response you need. Use fictional details only.',
    account: 'Tell us what happened', narrativePlaceholder: 'For example: I visited the fictional permit desk on sample day 4…',
    narrativeHelp: 'Include the details needed to understand the event. Avoid real personal information.', characters: 'characters',
    issuesTitle: 'Issues to address', issuesIntro: 'List each issue separately so the saved record keeps your wording and order.',
    concern: 'Concern', concernType: 'Type for concern {n}', service: 'Service request', conduct: 'Conduct concern', mixed: 'Mixed concern',
    serviceHelp: 'A request about a service, decision, delay or missing information.',
    conductHelp: 'A concern about someone’s conduct. Describe it as an allegation or request for review.',
    mixedHelp: 'Use this when the service issue and conduct concern belong together.',
    wordingPlaceholder: 'Describe the issue you want addressed.', removeConcern: 'Remove concern', addConcern: 'Add another concern',
    concernLimit: 'Up to 30 concerns. Service requests concern an outcome or information; conduct concerns ask for review of behaviour.',
    reviewTitle: 'Review and submit', declaration: 'This is fictional demonstration data. I have reviewed the account and each concern.',
    savingComplaint: 'Saving complaint…', submitComplaint: 'Submit complaint', savingWait: 'Saving your complaint. Please wait.',
    startSessionToSubmit: 'Start a demo session to enable submission. Your entries have not been saved.',
    privateReceipt: 'Submitting creates a private demo receipt. It does not contact a government office.',
    reviewFields: 'Review the highlighted fields before submitting.', narrativeError: 'Add an account of what happened.',
    concernError: 'Add the wording for this concern.', declarationError: 'Confirm the fictional-data declaration before submitting.',
    submitError: 'The request could not be completed. Please try again.',
    sideNav: 'Form sections', sectionStory: 'What happened', sectionIssues: 'Issues to address', sectionReview: 'Review and submit',
    issueCount: 'Issues listed', notSubmitted: 'Not submitted', writingTipTitle: 'Writing tip',
    writingTip: 'Keep the account in your own words. Separate issues when they need different responses.',
    receiptAccess: 'Open this receipt in your demo session', receiptAccessBody: 'This private receipt requires the browser identity used to submit it. A new demo session cannot restore access.',
    goFile: 'Go to File a complaint', notFoundTitle: 'Receipt not found', notFoundBody: 'This reference does not match a receipt available in this demo session.',
    receiptErrorTitle: 'Receipt could not be loaded', receiptErrorBody: 'The demo service could not load this receipt. Check your connection and retry.',
    authErrorTitle: 'Refresh this demo session',
    authRecoveryAction: 'Refresh saved session and retry', authRecoveryWorking: 'Refreshing saved session…', authRecoveryFailed: 'The saved session could not be refreshed. Your current session was kept. Check your connection and try again.', authRecoveryTimeout: 'Recovery took too long. Your current session was kept; you can try again when the service responds.', authRecoveryUnavailable: 'This browser could not confirm the original session. A new session will not restore access to this receipt.', authRecoveryReceiptFailed: 'The same session refreshed, but the private receipt still could not be loaded. Your session was kept. Try again or check the service.',
    loadingReceipt: 'Loading saved complaint…', receiptTitle: 'Complaint submitted', status: 'Status', reference: 'Complaint reference', submitted: 'Submitted', office: 'Office',
    originalAccount: 'Your original account', recordedIssues: 'Issues recorded', receiptLimit: 'This receipt confirms what was saved in the demo. No government office has received it.',
    print: 'Print or save receipt', another: 'Start another complaint', pageNotFound: 'Page not found', returnWorkspace: 'Return to your workspace',
    usingDemo: 'Using this demo', privacyBody: 'Use fictional details only. Submitting creates a private demo receipt and does not contact a government office. Do not enter real personal or sensitive information.',
    footerDemo: 'Fictional data only', receiptStatusSubmitted: 'Submitted', loadReceipt: 'Retry loading receipt', copyReference: 'Copy reference', referenceCopied: 'Reference copied.', referenceCopyFailed: 'Could not copy. Select the reference text to copy it. The reference alone does not grant access.',
} as const;

const hindiCopy = {
    pageTitle: 'जनवाणी · नागरिक शिकायत कार्यक्षेत्र', demo: 'हैकाथॉन डेमो', fictional: 'केवल काल्पनिक जानकारी · सरकारी कार्यालय में नहीं भेजा जाएगा', brandHome: 'जनवाणी होम',
    workspace: 'आपका कार्यक्षेत्र', privacy: 'गोपनीयता', language: 'भाषा', english: 'English', hindi: 'हिंदी',
    desk: 'काल्पनिक नगर सेवा केंद्र', fileTitle: 'शिकायत दर्ज करें', fileIntro: 'बताएँ कि क्या हुआ और किन मुद्दों पर कार्रवाई चाहिए।',
    unavailable: 'डेमो सेवा उपलब्ध नहीं है', retry: 'फिर कोशिश करें', connecting: 'डेमो सेवा से जुड़ रहे हैं…',
    setupTitle: 'अभी शिकायत भेजना संभव नहीं है', setupBody: 'यह डेमो अभी जुड़ा नहीं है। भेजने की सुविधा उपलब्ध होने तक आपकी जानकारी सहेजी नहीं जाएगी।',
    startSession: 'डेमो सत्र शुरू करें', sessionRecovery: 'सहेजी गई रसीदें इसी ब्राउज़र पहचान से जुड़ी हैं। यह सत्र बनाए रखें; नया सत्र पुरानी रसीदें वापस नहीं ला सकता।',
    starting: 'सत्र शुरू हो रहा है…', sessionStartError: 'डेमो सत्र शुरू नहीं हो सका। कृपया बाद में फिर कोशिश करें।',
    sessionActive: 'डेमो सत्र चालू है। भेजने तक आपकी जानकारी सहेजी नहीं जाएगी।',
    serviceConnectionError: 'डेमो सेवा तक पहुँचा नहीं जा सका। इंटरनेट जाँचकर फिर कोशिश करें।',
    storyTitle: 'क्या हुआ', storyIntro: 'क्या हुआ, कहाँ और कब हुआ, और आपको कैसी कार्रवाई चाहिए—यह लिखें। केवल काल्पनिक जानकारी दें।',
    account: 'घटना का विवरण', narrativePlaceholder: 'उदाहरण: मैं नमूना दिन 4 को काल्पनिक परमिट केंद्र गया था…',
    narrativeHelp: 'घटना समझने के लिए ज़रूरी जानकारी दें। असली निजी जानकारी न लिखें।', characters: 'अक्षर',
    issuesTitle: 'जिन मुद्दों पर कार्रवाई चाहिए', issuesIntro: 'हर मुद्दा अलग लिखें ताकि सहेजे गए रिकॉर्ड में आपका मूल क्रम और भाषा बनी रहे।',
    concern: 'मुद्दा', concernType: 'मुद्दा {n} का प्रकार', service: 'सेवा अनुरोध', conduct: 'व्यवहार संबंधी चिंता', mixed: 'मिश्रित मुद्दा',
    serviceHelp: 'सेवा, निर्णय, देरी या जानकारी न मिलने से जुड़ा अनुरोध।',
    conductHelp: 'किसी के व्यवहार से जुड़ी चिंता। इसे आरोप या समीक्षा के अनुरोध के रूप में लिखें।',
    mixedHelp: 'जब सेवा का मुद्दा और व्यवहार संबंधी चिंता एक-दूसरे से जुड़ी हों, तब चुनें।',
    wordingPlaceholder: 'जिस मुद्दे पर कार्रवाई चाहिए, उसका विवरण दें।', removeConcern: 'मुद्दा हटाएँ', addConcern: 'एक और मुद्दा जोड़ें',
    concernLimit: 'अधिकतम 30 मुद्दे। सेवा अनुरोध किसी नतीजे या जानकारी से जुड़ा होता है; व्यवहार संबंधी चिंता में समीक्षा का अनुरोध करें।',
    reviewTitle: 'जाँचें और भेजें', declaration: 'यह काल्पनिक डेमो जानकारी है। मैंने घटना का विवरण और हर मुद्दा जाँच लिया है।',
    savingComplaint: 'शिकायत सहेजी जा रही है…', submitComplaint: 'शिकायत भेजें', savingWait: 'शिकायत सहेजी जा रही है। कृपया प्रतीक्षा करें।',
    startSessionToSubmit: 'भेजने की सुविधा चालू करने के लिए डेमो सत्र शुरू करें। आपकी जानकारी सहेजी नहीं गई है।',
    privateReceipt: 'भेजने पर निजी डेमो रसीद बनेगी। यह किसी सरकारी कार्यालय में नहीं जाएगी।',
    reviewFields: 'भेजने से पहले हाइलाइट किए गए फ़ील्ड जाँचें।', narrativeError: 'घटना का विवरण लिखें।',
    concernError: 'इस मुद्दे का विवरण लिखें।', declarationError: 'भेजने से पहले काल्पनिक जानकारी की पुष्टि करें।',
    submitError: 'अनुरोध पूरा नहीं हो सका। कृपया फिर कोशिश करें।',
    sideNav: 'फ़ॉर्म के भाग', sectionStory: 'क्या हुआ', sectionIssues: 'मुद्दे', sectionReview: 'जाँचें और भेजें',
    issueCount: 'दर्ज मुद्दे', notSubmitted: 'अभी नहीं भेजा', writingTipTitle: 'लिखने का सुझाव',
    writingTip: 'घटना अपने शब्दों में लिखें। जिन मुद्दों पर अलग कार्रवाई चाहिए, उन्हें अलग लिखें।',
    receiptAccess: 'डेमो सत्र में यह रसीद खोलें', receiptAccessBody: 'इस निजी रसीद के लिए शिकायत भेजते समय वाली ब्राउज़र पहचान चाहिए। नया डेमो सत्र पहुँच वापस नहीं ला सकता।',
    goFile: 'शिकायत दर्ज करें', notFoundTitle: 'रसीद नहीं मिली', notFoundBody: 'इस संदर्भ से इस डेमो सत्र में उपलब्ध कोई रसीद नहीं मिली।',
    receiptErrorTitle: 'रसीद लोड नहीं हो सकी', receiptErrorBody: 'डेमो सेवा यह रसीद लोड नहीं कर सकी। इंटरनेट जाँचकर फिर कोशिश करें।',
    authErrorTitle: 'डेमो सत्र रीफ़्रेश करें',
    authRecoveryAction: 'सहेजा सत्र रीफ़्रेश करके फिर कोशिश करें', authRecoveryWorking: 'सहेजा सत्र रीफ़्रेश हो रहा है…', authRecoveryFailed: 'सहेजा सत्र रीफ़्रेश नहीं हो सका। आपका मौजूदा सत्र बना हुआ है। इंटरनेट जाँचकर फिर कोशिश करें।', authRecoveryTimeout: 'सत्र वापस पाने में बहुत समय लगा। आपका मौजूदा सत्र बना हुआ है; सेवा उपलब्ध होने पर फिर कोशिश करें।', authRecoveryUnavailable: 'यह ब्राउज़र मूल सत्र की पुष्टि नहीं कर सका। नया सत्र इस रसीद की पहुँच वापस नहीं लाएगा।', authRecoveryReceiptFailed: 'उसी सत्र को रीफ़्रेश किया गया, फिर भी निजी रसीद लोड नहीं हो सकी। आपका सत्र बना हुआ है। फिर कोशिश करें या सेवा जाँचें।',
    loadingReceipt: 'सहेजी गई शिकायत लोड हो रही है…', receiptTitle: 'शिकायत भेज दी गई', status: 'स्थिति', reference: 'शिकायत संदर्भ', submitted: 'भेजने का समय', office: 'कार्यालय',
    originalAccount: 'आपका मूल विवरण', recordedIssues: 'दर्ज मुद्दे', receiptLimit: 'यह रसीद डेमो में सहेजी गई जानकारी की पुष्टि करती है। इसे किसी सरकारी कार्यालय ने प्राप्त नहीं किया है।',
    print: 'रसीद प्रिंट या सहेजें', another: 'एक और शिकायत दर्ज करें', pageNotFound: 'पृष्ठ नहीं मिला', returnWorkspace: 'अपने कार्यक्षेत्र पर लौटें',
    usingDemo: 'इस डेमो के बारे में', privacyBody: 'केवल काल्पनिक जानकारी दें। भेजने पर निजी डेमो रसीद बनेगी और किसी सरकारी कार्यालय से संपर्क नहीं होगा। असली निजी या संवेदनशील जानकारी न लिखें।',
    footerDemo: 'केवल काल्पनिक जानकारी', receiptStatusSubmitted: 'भेज दी गई', loadReceipt: 'रसीद फिर लोड करें', copyReference: 'संदर्भ कॉपी करें', referenceCopied: 'संदर्भ कॉपी हो गया।', referenceCopyFailed: 'कॉपी नहीं हो सका। कॉपी करने के लिए संदर्भ का टेक्स्ट चुनें। केवल संदर्भ से पहुँच नहीं मिलती।',
} satisfies Record<keyof typeof englishCopy, string>;

const copy = { en: englishCopy, hi: hindiCopy };

export function translate(language: Language, key: CopyKey, values?: Record<string, string | number>): string {
  let value: string = copy[language][key];
  for (const [name, replacement] of Object.entries(values ?? {})) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

export function initialLanguage(): Language {
  try {
    const saved = window.localStorage.getItem('janvaani-language');
    if (saved === 'en' || saved === 'hi') return saved;
  } catch { /* Storage may be blocked; use the browser locale instead. */ }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('hi') ? 'hi' : 'en';
}
