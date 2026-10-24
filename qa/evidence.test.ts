import {describe,it,expect} from 'vitest';
import {validatedType,evidenceLimits,fingerprint,boundedBytes} from '../server/evidence';
import {verifyDisplayed,type RecordBundle} from '../domain/record-verification';
export const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
describe('evidence content and bounded bytes',()=>{
 it('accepts supported structural signatures without trusting file extensions or MIME',()=>{
  expect(validatedType(png)).toBe('image/png');expect(validatedType(Buffer.from([255,216,255,224,0,2,255,217]))).toBe('image/jpeg');
  expect(validatedType(Buffer.from('%PDF-1.4\nfictional\n%%EOF'))).toBe('application/pdf');expect(validatedType(Buffer.from('काल्पनिक evidence 😀'))).toBe('text/plain');
  const wav=Buffer.alloc(44);wav.write('RIFF');wav.writeUInt32LE(36,4);wav.write('WAVEfmt ',8);wav.write('data',36);expect(validatedType(wav)).toBe('audio/wav');
  expect(validatedType(Buffer.from([255,251,144,0,0]))).toBe('audio/mpeg');expect(validatedType(Buffer.concat([Buffer.from('OggS'),Buffer.from([0]),Buffer.from('OpusHead')]))).toBe('audio/ogg');
  expect(validatedType(Buffer.concat([Buffer.from('1a45dfa3','hex'),Buffer.from('webm')]))).toBe('video/webm');
  const mp4=Buffer.alloc(32);mp4.writeUInt32BE(16);mp4.write('ftypisom',4);mp4.writeUInt32BE(8,16);mp4.write('moov',20);mp4.writeUInt32BE(8,24);mp4.write('mdat',28);expect(validatedType(mp4)).toBe('video/mp4');
 });
 it('rejects unsupported binary, markup, empty and oversized data',()=>{for(const b of [Buffer.alloc(0),Buffer.alloc(100),Buffer.from('<script>active</script>'),Buffer.alloc(evidenceLimits.fileBytes+1)])expect(()=>validatedType(b)).toThrow();});
 it('detects a changed retrieved byte and refuses excessive download allocation',async()=>{const changed=Buffer.from(png);changed[20]^=1;expect(fingerprint(changed)).not.toBe(fingerprint(png));await expect(boundedBytes(new Response(new Uint8Array(evidenceLimits.fileBytes+1)))).rejects.toThrow('bound');});
});
describe('display consistency',()=>{
 function bundle():RecordBundle{const payload={narrative:'मूल 😀',concerns:[{type:'service',wording:'one'},{type:'conduct',wording:'two'}]};return {version:1,caseId:'fixture',events:[{caseId:'fixture',sequence:1,actor:'fixture',time:'fixture',action:'submitted',payloadText:JSON.stringify({payload}),previousHash:'',hash:''}],count:1,head:'',displayed:structuredClone(payload),evidence:[]};}
 it('compares displayed narrative and ordered concerns to committed content',()=>{const r=bundle();expect(verifyDisplayed(r).valid).toBe(true);r.displayed.narrative+=' changed';expect(verifyDisplayed(r).valid).toBe(false);const s=bundle();s.displayed.concerns.reverse();expect(verifyDisplayed(s).valid).toBe(false);});
 it('rejects an uncommitted manifest and only checks fields in a legacy baseline',()=>{const r=bundle();r.events[0].action='migration_baseline';r.events[0].payloadText=JSON.stringify({case:{payload:r.displayed}});expect(verifyDisplayed(r).valid).toBe(true);r.evidence=[{id:'forged'} as never];expect(verifyDisplayed(r).failure).toBe('evidence-manifest');});
});
