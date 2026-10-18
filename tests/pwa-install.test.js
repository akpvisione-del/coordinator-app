'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('public/pwa-install.js','utf8');
function setup(installed=false){
 const events={},buttons=[{addEventListener(_,fn){this.click=fn}}];
 const dialog={open:false,showModal(){this.open=true},close(){this.open=false}},help={};
 const match={matches:installed,addEventListener(){}};
 vm.runInNewContext(code,{document:{querySelectorAll:()=>buttons,getElementById:id=>id==='akpInstallDialog'?dialog:help},window:{matchMedia:()=>match,addEventListener:(name,fn)=>events[name]=fn},navigator:{userAgent:'Android Chrome',platform:'Linux'}});
 return {events,button:buttons[0],dialog,help};
}
test('installation guidance works without native prompt and never auto-installs',async()=>{const s=setup();assert.equal(s.dialog.open,false);await s.button.click();assert.equal(s.dialog.open,true);assert.match(s.help.textContent,/menu przeglądarki/)});
test('installed standalone app hides installation action',()=>{assert.equal(setup(true).button.hidden,true)});
test('native prompt runs only after a click and accepted event hides controls',async()=>{
 const s=setup();let calls=0,prevented=false;
 s.events.beforeinstallprompt({preventDefault(){prevented=true},async prompt(){calls++},userChoice:Promise.resolve({outcome:'accepted'})});
 assert.equal(prevented,true);assert.equal(calls,0);await s.button.click();assert.equal(calls,1);assert.equal(s.button.disabled,false);
 s.events.appinstalled();assert.equal(s.button.hidden,true);
});
test('dismissed native prompt can show manual installation guidance on next click',async()=>{const s=setup();s.events.beforeinstallprompt({preventDefault(){},async prompt(){},userChoice:Promise.resolve({outcome:'dismissed'})});await s.button.click();await s.button.click();assert.equal(s.dialog.open,true)});
test('manifest launch stays on existing domain and all icon resources exist',()=>{
 const m=JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'));
 assert.equal(m.start_url,'/login');assert.equal(m.display,'standalone');assert.equal(m.prefer_related_applications,false);
 for(const size of [192,512]){const icon=m.icons.find(i=>i.sizes===`${size}x${size}`);assert.ok(icon);assert.ok(fs.existsSync('public'+icon.src))}
 assert.ok(fs.readFileSync('netlify.toml','utf8').includes("manifest-src 'self'"));
 assert.doesNotMatch(code,/fetch\(|localStorage|sessionStorage|\/api\//);
 assert.match(code,/navigator\.serviceWorker\.register\('\/sw\.js'/);
 assert.match(code,/window\.isSecureContext === true/);
});
