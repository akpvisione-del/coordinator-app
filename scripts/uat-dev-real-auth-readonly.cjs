// AKP Commander — manually authorized, READ-ONLY verification against a DEV preview.
// Run privately with an EXISTING test session; never send a cookie/token to chat,
// CI logs, a repository, an issue, or Google Drive. Does not create users or write data.
'use strict';
const assert=require('node:assert/strict');

function verifyTarget(value){
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.pathname!=='/')throw Error('Only a clean HTTPS origin is supported.');
  if(!/^deploy-preview-[0-9]+--coordinator-a\.netlify\.app$/i.test(u.hostname))throw Error('Only the existing AKP Netlify DEV deploy preview is allowed; production blocked.');
  return u.origin;
}
async function run({origin,cookie,role,fetcher=fetch}){
  const host=verifyTarget(origin);
  if(!cookie||/\r|\n/.test(cookie))throw Error('An existing private test-session cookie is required.');
  if(!['coordinator','worker'].includes(role))throw Error('AKP_UAT_ROLE must be coordinator or worker.');
  let calls=0;
  async function get(path){
    assert.ok(/^\/api\/(me|jobs|reports|dashboard|team|audit|sources)(\b|\?|$)/.test(path),'Unsupported read endpoint');
    calls++;
    const response=await fetcher(host+path,{
      method:'GET',
      headers:{Cookie:cookie,'Cache-Control':'no-store'},
      redirect:'manual',signal:AbortSignal.timeout(12000)
    });
    assert.ok(![301,302,303,307,308].includes(response.status),'Unexpected redirect');
    let data=null;
    if(response.ok){data=await response.json();}
    return {status:response.status,data};
  }
  const me=await get('/api/me');
  assert.equal(me.status,200,'Real Auth check failed; no credentials printed');
  assert.equal(me.data?.role,role,'Real Auth role does not match selected test context');

  const list=await get('/api/jobs');
  assert.equal(list.status,200,'Jobs read failed');
  assert.ok(Array.isArray(list.data?.items),'Invalid jobs response');
  const jobs=list.data.items;
  if(role==='worker'){
    for(const job of jobs){
      for(const key of ['revenue_net','crew_cost','source']){
        assert.equal(Object.hasOwn(job,key),false,'Worker payload contains protected field '+key);
      }
    }
    for(const endpoint of ['/api/dashboard','/api/team','/api/audit','/api/sources']){
      const denied=await get(endpoint);
      assert.equal(denied.status,403,'Worker must be denied '+endpoint);
    }
  }else{
    for(const path of ['/api/dashboard','/api/team','/api/audit','/api/sources']){
      assert.equal((await get(path)).status,200,'Coordinator permission rejected for '+path);
    }
  }
  const reports=await get('/api/reports');
  assert.equal(reports.status,200);
  const limited=role==='worker'&&jobs.length===0;
  return {status:limited?'PARTIAL_NO_ASSIGNED_JOBS':'PASS_READ_ONLY',role,requests:calls,jobCount:jobs.length,writes:0,auth:'REAL_SESSION',rls:'HTTP_GET_CHECKED'};
}
if(require.main===module){
  (async()=>{
    try{
      const result=await run({
        origin:process.env.AKP_UAT_ORIGIN||'',
        cookie:process.env.AKP_UAT_COOKIE||'',
        role:process.env.AKP_UAT_ROLE||''
      });
      // No customer names, references, tokens, session IDs, emails or addresses.
      console.log(JSON.stringify(result));
      if(result.status!=='PASS_READ_ONLY')process.exitCode=2;
    }catch(e){
      console.error('AKP LIVE DEV UAT BLOCKED:',e.message);
      process.exitCode=1;
    }
  })();
}
module.exports={verifyTarget,run};
