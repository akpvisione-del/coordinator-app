'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function sandbox(){const c={crypto,structuredClone,console,URLSearchParams,Date,confirm:()=>true};c.globalThis=c;vm.createContext(c);for(const file of ['pro-model','pro-ui','materials-ui','media-ui','drawing-model','drawing-ui'])vm.runInContext(fs.readFileSync('public/'+file+'.js','utf8'),c);return c;}
test('all new controllers discard late data after session reset',async()=>{
 const c=sandbox(),job=crypto.randomUUID();
 for(const [name,button,result] of [
  ['AKPPro',{pro:'load',proJob:job},{version:1,document:{...c.AKPProModel.blank('PRIVATE COMPANY QUOTE')},history:[]}],
  ['AKPMaterials',{material:'load',materialJob:job},{items:[{name:'PRIVATE SUPPLIER',id:crypto.randomUUID()}]}],
  ['AKPMedia',{media:'load',mediaJob:job},{items:[{caption:'PRIVATE PHOTO',id:crypto.randomUUID()}],next_before:null}]
 ]){
  let resolve;const controller=c[name];controller.configure({me:()=>({role:'coordinator'}),api:()=>new Promise(r=>resolve=r),changed(){}});controller.click({dataset:button});controller.reset();resolve(result);await new Promise(r=>setImmediate(r));
  assert.doesNotMatch(controller.view(job),/PRIVATE/);assert.equal(controller.dirty(),false);
 }
 let resolve;const p=new Promise(r=>resolve=r),d=c.AKPDrawing;d.configure({api:()=>p,changed(){}});const opening=d.open(job,crypto.randomUUID());d.reset();resolve({});await opening;assert.equal(d.view(job),'');assert.equal(d.dirty(),false);
});
