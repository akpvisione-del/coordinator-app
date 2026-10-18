// Compare baseline 32a51e1 to the isolated v02 stylesheet on identical app/data.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {openBrowser} from './lib/browser-pipe.mjs';
import {visualFixture,IDs} from './lib/visual-fixture.mjs';
const out=resolve(process.env.AKP_VISUAL_OUT||'artifacts/visual-sprint-02');await mkdir(out,{recursive:true});
const fixture=await visualFixture();let browser;const manifest=[];
try{
 browser=await openBrowser();await browser.command('Network.enable');await browser.command('Network.setBlockedURLs',{urls:['https://*']});
 for(const width of [390,1280])for(const theme of ['light','dark'])for(const role of ['coordinator','worker']){
  if(process.env.AKP_VISUAL_CASE&&process.env.AKP_VISUAL_CASE!==[role,width,theme].join('-'))continue;
  fixture.setRole(role);fixture.setEmpty(false);fixture.setUnavailable(false);
  await browser.command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await browser.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'reduce'}]});
  await browser.command('Page.navigate',{url:fixture.url+'/?visual='+width+theme+role});
  await browser.waitFor("document.querySelector('#appView')?.hidden===false && document.querySelector('.job-card,.f04a-kpi')");
  await browser.evaluate(`localStorage.setItem('akp_theme',${JSON.stringify(theme)});document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
  const views=role==='coordinator'?['overview','jobs','detail','team','chat','schedule']:['jobs','detail','chat','schedule'];
  for(const view of views){
   if(view==='detail'){
    await browser.evaluate("document.querySelector('#sideNav [data-nav=jobs]').click()");await browser.waitFor("document.querySelector('[data-job]')");
    await browser.evaluate("document.querySelector('[data-job]').click()");await browser.waitFor("document.querySelector('.f04a-detail-section')");
   }else{
    await browser.evaluate(`document.querySelector('#sideNav [data-nav=${view}]').click()`);
    if(view==='chat'){await browser.waitFor("document.querySelector('[data-chat-open]')");await browser.evaluate("document.querySelector('[data-chat-open]').click()");await browser.waitFor("document.querySelector('.chat-message')");}
    else await browser.waitFor(view==='jobs'?"document.querySelector('.job-card')":view==='team'?"document.querySelector('#teamSearch')":view==='schedule'?"document.querySelector('.schedule-grid')":"document.querySelector('.f04a-kpi')");
   }
   await browser.evaluate(view==='jobs'?"document.querySelector('.jobs-grid').scrollIntoView({block:'start',behavior:'instant'})":'window.scrollTo(0,0)');
   for(const version of ['before','after']){
    await browser.evaluate(`document.querySelector('link[href="/akp-premium-v02.css"]').disabled=${version==='before'}`);
    if(version==='after')await browser.waitFor("getComputedStyle(document.querySelector('#appView')).getPropertyValue('--v-radius').trim()==='20px'");
    await browser.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    const metrics=await browser.evaluate(`(()=>{const app=document.querySelector('#appView'),main=document.querySelector('#mainContent'),grid=document.querySelector('.jobs-grid'),style=getComputedStyle(app);return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,mainOverflow:main.scrollWidth>main.clientWidth+1,background:style.backgroundColor,text:style.color,columns:grid?getComputedStyle(grid).gridTemplateColumns.split(' ').length:null,finance:main.textContent.includes('Przychód netto')||main.textContent.includes('12 400'),touch:[...main.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim().slice(0,50),height:e.getBoundingClientRect().height})).filter(e=>e.height<43)}})()`);
    if(version==='after'){
     assert.ok(metrics.scrollWidth<=width,`${role} ${view} ${theme} ${width} overflow ${JSON.stringify(metrics)}`);
     assert.equal(metrics.mainOverflow,false,`${view} main overflow`);
     if(role==='worker')assert.equal(metrics.finance,false,'worker finance leak');
     if(view==='jobs')assert.ok(metrics.columns>=(width===390?2:3),'job columns '+JSON.stringify({role,theme,width,version,metrics}));
    }
    if(version==='after'){
     const contrast=await browser.evaluate(`(()=>{
      const rgba=s=>{const n=s.match(/[\\d.]+/g)?.map(Number)||[];return [n[0]||0,n[1]||0,n[2]||0,n[3]??1]};
      const over=(a,b)=>{const alpha=a[3]+b[3]*(1-a[3]);return [0,1,2].map(i=>(a[i]*a[3]+b[i]*b[3]*(1-a[3]))/(alpha||1)).concat(alpha)};
      const light=c=>{const v=c.slice(0,3).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]};
      const selectors=['.page-hero h1','.job-title','.line-main>strong','.chat-message>p','.schedule-grid h2','label','.btn.primary','.tag'];
      return [...document.querySelectorAll(selectors.map(x=>'#mainContent '+x).join(','))].filter(e=>e.getClientRects().length&&!e.disabled).map(e=>{
       let bg=[0,0,0,0];for(let p=e;p;p=p.parentElement){bg=over(bg,rgba(getComputedStyle(p).backgroundColor));if(bg[3]>=.999)break;}bg=over(bg,[255,255,255,1]);
       const fg=over(rgba(getComputedStyle(e).color),bg),a=light(fg),b=light(bg);return {text:e.textContent.trim().slice(0,50),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      });
     })()`);
     metrics.minimumContrast=Math.min(...contrast.map(c=>c.ratio));
     assert.ok(contrast.every(c=>c.ratio>=4.5),JSON.stringify({role,view,theme,width,low:contrast.filter(c=>c.ratio<4.5)}));
     assert.equal(metrics.touch.length,0,'small touch targets '+JSON.stringify(metrics.touch));
    }
    const file=[role,view,width,theme,version].join('-')+'.png';
    const screenshot=await browser.command('Page.captureScreenshot',{format:'png'});await writeFile(join(out,file),Buffer.from(screenshot.data,'base64'));
    manifest.push({role,view,width,theme,version,file,...metrics});
   }
  }
  fixture.setEmpty(true);
  await browser.evaluate("document.querySelector('#sideNav [data-nav=jobs]').click();document.querySelector('[data-action=refresh]').click()");
  await browser.waitFor("document.querySelector('.jobs-grid') && !document.querySelector('.job-card')");
  assert.ok(await browser.evaluate("document.querySelector('.jobs-grid').textContent.trim().length>10"),'missing empty list');
  fixture.setUnavailable(true);
  await browser.evaluate("document.querySelector('#sideNav [data-nav=chat]').click()");
  await browser.waitFor("document.querySelector('#mainContent [role=alert]')?.textContent.includes('chwilowo')");
  assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'error overflow');
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#mainContent button')).transitionDuration"),'0s','reduced motion');
  if(role==='worker')assert.equal(fixture.requests.some(r=>/\/team|\/dashboard|\/sources|\/audit/.test(r)),false,'worker privileged request');
  console.log(`Visual ${role} ${width}px ${theme} PASS (${views.length} views, before/after)`);
 }
 await writeFile(join(out,'manifest.json'),JSON.stringify({baseline:'32a51e1',note:'Identical real application and synthetic data; before disables only the new scoped stylesheet.',results:manifest},null,2));
}finally{if(browser)await browser.close();await fixture.close();}
