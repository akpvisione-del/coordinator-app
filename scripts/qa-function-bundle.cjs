// Synthetic authenticated PDF request from a relocated esbuild/Netlify-style ZIP.
// The only external request is npm's pinned build tool; the function provider is mocked.
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'akp03-bundle-'));
try{
 const build=spawnSync('npm',['exec','--yes','--package=esbuild@0.25.12','--cache','/tmp/akp-npm-cache','--','esbuild','netlify/functions/api.js','--bundle','--platform=node','--external:pdfkit','--outfile='+path.join(dir,'api.cjs')],{cwd:root,encoding:'utf8'});
 if(build.status!==0)throw Error(build.stderr||'bundle failed');
 fs.mkdirSync(path.join(dir,'netlify/functions/fonts'),{recursive:true});fs.copyFileSync(path.join(root,'netlify/functions/fonts/DejaVuSans.ttf'),path.join(dir,'netlify/functions/fonts/DejaVuSans.ttf'));
 const worker=`const fs=require('node:fs'),assert=require('node:assert/strict');
 const M=require(${JSON.stringify(path.join(root,'public/pro-model'))});
 process.env.SUPABASE_URL='https://synthetic.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='synthetic';process.env.APP_ORIGIN='https://test.invalid';
 const document=M.blank('Wycena demonstracyjna — zażółć gęślą jaźń');
 document.company={name:'Firma Fikcyjna AKP',address:'ul. Przykładowa 1, Miasto Testowe',tax_id:'0000000000',email:'demo@example.test'};document.customer.name='Klient demonstracyjny';
 document.variants[0].lines=[{id:crypto.randomUUID(),name:'Montaż zabudowy — próba',unit:'m²',quantity:'2.5',rate:'100',discount:'10',vat:'23'}];document.notes='Dokument podglądowy. Wyłącznie fikcyjne dane. Termin realizacji do uzgodnienia.';
 const id='11111111-1111-4111-8111-111111111111';
 global.fetch=async(url)=>new Response(JSON.stringify(url.includes('/auth/v1/user')?{id,app_metadata:{akp_role:'coordinator'}}:url.includes('akp_profiles')?[{user_id:id,role:'coordinator',display_name:'DEMO',is_active:true}]:{version:1,document,history:[]}),{status:200});
 (async()=>{const r=await require('./api.cjs').handler({path:'/api/jobs/44444444-4444-4444-8444-444444444444/quote/pdf',httpMethod:'GET',headers:{cookie:'akp_access=synthetic'}});assert.equal(r.statusCode,200);assert.equal(r.isBase64Encoded,true);const pdf=Buffer.from(r.body,'base64');assert.equal(pdf.subarray(0,5).toString(),'%PDF-');fs.mkdirSync(${JSON.stringify(path.join(root,'artifacts/supersprint-03'))},{recursive:true});fs.writeFileSync(${JSON.stringify(path.join(root,'artifacts/supersprint-03/WYCENA_DEMO.pdf'))},pdf);console.log('NETLIFY_BUNDLE_PDF_PASS: relocated bundle, embedded Polish font, real PDF');})();`;
 fs.writeFileSync(path.join(dir,'smoke.cjs'),worker);
 const r=spawnSync(process.execPath,['smoke.cjs'],{cwd:dir,env:{...process.env,NODE_PATH:path.join(root,'node_modules')},encoding:'utf8'});process.stdout.write(r.stdout);if(r.status!==0)throw Error(r.stderr||'bundle request failed');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
