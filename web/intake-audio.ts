/** The file picker filter is advisory. Inspect the extension and declared MIME
 * before staging audio; the backend still validates the actual bytes.
 */
const recordingMime:Record<string,ReadonlySet<string>>={
 wav:new Set(['audio/wav','audio/x-wav','audio/wave','audio/vnd.wave']),
 mp3:new Set(['audio/mpeg','audio/mp3','audio/x-mpeg']),
 ogg:new Set(['audio/ogg','application/ogg']),
 webm:new Set(['audio/webm','video/webm']),
};
export function supportedAudioRecording(file:Pick<File,'name'|'size'|'type'>):boolean{
 const extension=/\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
 if(!extension||!recordingMime[extension]||!file.size||file.size>8*1024*1024)return false;
 // MediaRecorder commonly reports `audio/webm;codecs=opus` or `audio/ogg;codecs=opus`.
 // Only the media type participates in MIME matching, not optional parameters.
 const mime=file.type.split(';',1)[0].trim().toLowerCase();
 return !mime||mime==='application/octet-stream'||recordingMime[extension].has(mime);
}
