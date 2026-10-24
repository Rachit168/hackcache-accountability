import {Worker} from 'node:worker_threads';
// Isolate untrusted PDF parsing with a deadline and a worker heap ceiling.
export function extractPdf(bytes:Buffer):Promise<{location:string;text:string}[]>{
 return new Promise((resolve,reject)=>{
  const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');(async()=>{const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:new Uint8Array(workerData),useSystemFonts:false,maxImageSize:0});try{const pdf=await task.promise;if(pdf.numPages>15)throw Error('page limit');let total=0;const out=[];for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const text=(await page.getTextContent()).items.map(v=>'str'in v?v.str:'').join(' ');total+=text.length;if(total>30000)throw Error('text limit');out.push({location:'page '+n,text});}parentPort.postMessage(out);}finally{await task.destroy();}})().catch(()=>process.exit(1));`,{eval:true,workerData:bytes,resourceLimits:{maxOldGenerationSizeMb:128}});
  let done=false;const finish=(value?:{location:string;text:string}[])=>{if(done)return;done=true;clearTimeout(timer);void worker.terminate();value?resolve(value):reject(Object.assign(Error('PDF extraction failed or exceeded bounds'),{intakeCode:'PDF_EXTRACTION_UNAVAILABLE'}));};
  const timer=setTimeout(()=>finish(),15000);worker.once('message',v=>finish(v));worker.once('error',()=>finish());worker.once('exit',()=>finish());
 });
}
