// Read-only tracked/reachable-history scan. Reports categories and object IDs, never values.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {parse} from 'dotenv';
const git=(...args)=>execFileSync('git',args,{maxBuffer:32*1024*1024});
const env=fs.existsSync('.env')?parse(fs.readFileSync('.env')):{};
const protectedValues=[];
for(const [key,value] of Object.entries(env)){
 if(/PASSWORD|DATABASE_URL|API_KEY|SECRET|TOKEN/.test(key)&&value.length>=12)protectedValues.push(value);
 if(/DATABASE_URL/.test(key))try{const p=decodeURIComponent(new URL(value).password);if(p.length>=12)protectedValues.push(p);}catch{}
}
const findings=[];const pathFindings=new Set();const reviewedFixtures=[];
// These exact immutable blobs were inspected: example project credentials in local-only tests.
// A changed fixture has a new object ID and must be reviewed again.
const fictionalCredentialBlobs=new Set(['1aa88f7dc541436d1c172bd618eeb05a826a1dd7','e10b1d203644d58975b4cc454b987b90410f832d']);
const commits=git('rev-list','--all').toString().trim().split('\n').filter(Boolean);
for(const commit of commits)for(const path of git('ls-tree','-r','--name-only',commit).toString().trim().split('\n')){
 if(/(^|\/)(?:node_modules|dist|\.cache|artifacts|coverage)(\/|$)|(^|\/)\.env(?:\.|$)|\.(?:p12|pfx|key)$|(?:session|credential)[^/]*\.json$/i.test(path)&&path!=='.env.example')pathFindings.add(path);
}
let blobs=0;let bytes=0;
const objects=new Map(git('rev-list','--objects','--all').toString().trim().split('\n').map(row=>[row.split(' ')[0],row]));
for(const row of git('ls-files','--stage').toString().trim().split('\n')){const m=row.match(/^\d+ ([a-f0-9]+) \d\t(.+)$/);if(m)objects.set(m[1],m[1]+' '+m[2]);}
for(const row of objects.values()){
 const [oid,...parts]=row.split(' ');const path=parts.join(' ');
 if(git('cat-file','-t',oid).toString().trim()!=='blob')continue;
 const content=git('cat-file','blob',oid);blobs++;bytes+=content.length;const text=content.toString('utf8');
 const categories=[];
 if(protectedValues.some(value=>content.includes(Buffer.from(value))))categories.push('EXACT_PRIVATE_CONFIGURATION_VALUE');
 if(/sk-or-v1-[A-Za-z0-9]{24,}|sb_secret_[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))categories.push('SECRET_TOKEN_OR_PRIVATE_KEY');
 for(const token of text.matchAll(/eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g))try{const body=JSON.parse(Buffer.from(token[0].split('.')[1],'base64url'));if(body.role!=='anon')categories.push('NON_PUBLIC_JWT');}catch{}
 if(/postgres(?:ql)?:\/\/[^\s"'`]+:[^\s"'`]+@/.test(text))categories.push('EMBEDDED_DATABASE_CREDENTIAL_CANDIDATE');
 if(categories.length===1&&categories[0]==='EMBEDDED_DATABASE_CREDENTIAL_CANDIDATE'&&fictionalCredentialBlobs.has(oid))reviewedFixtures.push({oid,path,reason:'Reviewed fictional example project URL; no real secret'});
 else if(categories.length)findings.push({oid,path,categories:[...new Set(categories)]});
}
for(const commit of commits){const message=git('show','-s','--format=%B',commit).toString();if(protectedValues.some(value=>message.includes(value))||/sk-or-v1-[A-Za-z0-9]{24,}|sb_secret_[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(message))findings.push({oid:commit,path:'COMMIT_MESSAGE',categories:['COMMIT_MESSAGE_SECRET_CANDIDATE']});}
const report={scope:'All tracked paths in every reachable commit, reachable blobs, staged/index blobs and commit messages; exact current private values plus token/key/credential patterns. Not proof of absence of every possible unknown secret or real personal data.',commits:commits.length,blobs,bytes,suspiciousPaths:[...pathFindings],reviewedFixtures,findings};
console.log(JSON.stringify(report,null,2));process.exitCode=findings.length||pathFindings.size?1:0;
