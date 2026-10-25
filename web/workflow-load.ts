import type {Language} from './i18n';
export function workflowLoadMessage(error:unknown,language:Language):string{
 const e=error as {status?:number;authCode?:string};const hi=language==='hi';
 if(e?.authCode==='NO_SESSION')return hi?'कोई कर्मचारी सत्र नहीं है। अपना निजी कर्मचारी सत्र खोलें।':'No authenticated staff session. Open your private operator session.';
 if(e?.status===401)return hi?'कर्मचारी सत्र अमान्य या समाप्त है। अपना कर्मचारी सत्र फिर खोलें।':'The staff session is invalid or expired. Reopen your operator session.';
 if(e?.status===403)return hi?'पहचान की पुष्टि हुई, लेकिन इस कार्यक्षेत्र की अनुमति नहीं है। ऑपरेटर से आवंटन जाँचें।':'You are signed in but not authorised for this workspace. Ask the operator to check the assignment.';
 return hi?'सेवा से अभी संपर्क नहीं हुआ। अपनी पहचान बदले बिना फिर प्रयास करें।':'The service is temporarily unavailable. Retry without changing identity.';
}
