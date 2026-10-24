import {createHash} from 'node:crypto';
export const evidenceLimits={files:5,fileBytes:8*1024*1024,totalBytes:30*1024*1024};
export function fingerprint(bytes:Uint8Array){return createHash('sha256').update(bytes).digest('hex');}
export function validatedType(b:Buffer):string {
 if(!b.length||b.length>evidenceLimits.fileBytes)throw Object.assign(Error('Invalid size'),{code:'22023'});
 let type:string|undefined;
 if(b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&b.length>=45&&b.toString('ascii',12,16)==='IHDR'&&b.toString('ascii',b.length-8,b.length-4)==='IEND')type='image/png';
 else if(b[0]===255&&b[1]===216&&b[2]===255&&b[b.length-2]===255&&b[b.length-1]===217)type='image/jpeg';
 else if(b.toString('ascii',0,5)==='%PDF-'&&b.subarray(-1024).includes(Buffer.from('%%EOF')))type='application/pdf';
 else if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WAVE'&&b.length>=44&&b.readUInt32LE(4)+8===b.length&&b.includes(Buffer.from('fmt '))&&b.includes(Buffer.from('data')))type='audio/wav';
 else if(b.toString('ascii',0,4)==='OggS'&&b[4]===0&&(b.subarray(0,512).includes(Buffer.from('OpusHead'))||b.subarray(0,512).includes(Buffer.from('vorbis'))))type='audio/ogg';
 else if(b.length>4&&b[0]===255&&(b[1]&0xe0)===0xe0&&(b[1]&6)!==0&&(b[2]&0xf0)!==0xf0&&(b[2]&0x0c)!==0x0c)type='audio/mpeg';
 else if(b.subarray(0,4).equals(Buffer.from('1a45dfa3','hex'))&&b.subarray(0,4096).includes(Buffer.from('webm')))type='video/webm';
 else if(b.length>=24&&b.toString('ascii',4,8)==='ftyp'){
  let pos=0;const boxes:string[]=[];while(pos+8<=b.length){const size=b.readUInt32BE(pos);if(size<8||pos+size>b.length)break;boxes.push(b.toString('ascii',pos+4,pos+8));pos+=size;}
  if(pos===b.length&&boxes.includes('moov')&&boxes.includes('mdat')&&/isom|mp4[12]|avc1|M4V /.test(b.toString('ascii',8,Math.min(40,b.length))))type='video/mp4';
 }
 if(!type){try{const text=new TextDecoder('utf-8',{fatal:true}).decode(b);if(!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)&&!/^\s*</.test(text)&&!b.includes(0))type='text/plain';}catch{ /* unsupported binary */ }}
 if(!type)throw Object.assign(Error('Unsupported content'),{code:'22023'});return type;
}
export async function boundedBytes(response:Response):Promise<Buffer>{
 if(!response.ok||!response.body)throw Error('Storage unavailable');
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>evidenceLimits.fileBytes)throw Error('Storage size bound');chunks.push(value);}return Buffer.concat(chunks);}finally{await reader.cancel().catch(()=>{});}
}
export function privateStorage(url:string,key:string,token:string){
 const base=url+'/storage/v1/object/';const headers={apikey:key,Authorization:'Bearer '+token};
 return {
  read:async(path:string)=>boundedBytes(await fetch(base+'authenticated/hc-evidence/'+path,{headers,signal:AbortSignal.timeout(20000)})),
  upload:async(path:string,bytes:Buffer,type:string)=>fetch(base+'hc-evidence/'+path,{method:'POST',headers:{...headers,'Content-Type':type,'x-upsert':'false'},body:new Uint8Array(bytes),signal:AbortSignal.timeout(20000)}),
 };
}
