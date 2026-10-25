/** Browser file picker filters are advisory. Check the file again before treating it as an audio recording. */
export function supportedAudioRecording(file:Pick<File,'name'|'size'|'type'>):boolean{
 if(!/\.(wav|mp3|ogg|webm)$/i.test(file.name)||!file.size||file.size>8*1024*1024)return false;
 return !file.type||['audio/wav','audio/x-wav','audio/wave','audio/mpeg','audio/mp3','audio/ogg','application/ogg','audio/webm','video/webm','application/octet-stream'].includes(file.type);
}
