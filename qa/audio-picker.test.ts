import {describe,it,expect} from 'vitest';
import {supportedAudioRecording} from '../web/intake-audio';
const file=(name:string,type:string,size=1200)=>({name,type,size});
describe('recording picker rejects arbitrary evidence types before upload',()=>{
 it('accepts browser WebM/Opus and supported audio',()=>{
  expect(supportedAudioRecording(file('citizen-recording.webm','video/webm'))).toBe(true);
  expect(supportedAudioRecording(file('citizen-recording.webm','audio/webm;codecs=opus'))).toBe(true);
  expect(supportedAudioRecording(file('voice.ogg','audio/ogg; codecs=opus'))).toBe(true);
  expect(supportedAudioRecording(file('recorded.webm','video/webm;codecs=opus'))).toBe(true);
  expect(supportedAudioRecording(file('speech.mp3','audio/mpeg'))).toBe(true);
  expect(supportedAudioRecording(file('voice.ogg','audio/ogg'))).toBe(true);
 });
 it('rejects text, PDF, MP4 and spoofed types even if browser picker returns them',()=>{
  expect(supportedAudioRecording(file('notes.txt','text/plain'))).toBe(false);
  expect(supportedAudioRecording(file('recorded.pdf','application/pdf'))).toBe(false);
  expect(supportedAudioRecording(file('clip.mp4','video/mp4'))).toBe(false);
  expect(supportedAudioRecording(file('voice.webm','text/plain'))).toBe(false);
  expect(supportedAudioRecording(file('renamed.mp3','audio/webm'))).toBe(false);
  expect(supportedAudioRecording(file('notes.txt','audio/webm'))).toBe(false);
  expect(supportedAudioRecording(file('movie.mp4','audio/mp3'))).toBe(false);
  expect(supportedAudioRecording(file('fake.wav','text/plain; charset=utf-8'))).toBe(false);
 });
 it('rejects zero and oversized recordings',()=>{
  expect(supportedAudioRecording(file('voice.webm','video/webm',0))).toBe(false);
  expect(supportedAudioRecording(file('voice.webm','video/webm',8*1024*1024+1))).toBe(false);
 });
});
