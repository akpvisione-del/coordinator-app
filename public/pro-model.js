/* Shared estimate contract. Decimal strings in storage; integer arithmetic in cents. */
'use strict';
(function(root){
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const units=['szt.','m','m²','m³','kg','l','kpl.','godz.'];
 function invalid(message){throw Object.assign(new Error(message),{status:422});}
 function keys(o,list){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!list.includes(k)))invalid('Nieprawidłowy kontrakt wyceny.');}
 function text(s,max,required=false){if(typeof s!=='string'||s.length>max||(required&&!s.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s))invalid('Sprawdź opisy wyceny.');}
 function decimal(s,scale,max){
  if(typeof s!=='string'||!new RegExp('^(0|[1-9][0-9]{0,8})(\\.[0-9]{1,'+scale+'})?$').test(s))invalid('Podaj dodatnią liczbę dziesiętną (kropka, bez wykładnika).');
  const [whole,part='']=s.split('.'),n=BigInt(whole)*10n**BigInt(scale)+BigInt(part.padEnd(scale,'0'));
  if(n>BigInt(max))invalid('Przekroczono limit kwoty lub ilości.');return n;
 }
 const round=(n,d)=>(n+d/2n)/d;
 function lineTotals(l){
  const qty=decimal(l.quantity,3,1000000000),rate=decimal(l.rate,2,10000000),discount=decimal(l.discount,2,10000),vat=decimal(l.vat,2,10000);
  const base=round(qty*rate,1000n),net=round(base*(10000n-discount),10000n),tax=round(net*vat,10000n);
  return {base:Number(base),discount:Number(base-net),net:Number(net),tax:Number(tax),gross:Number(net+tax)};
 }
 function validate(doc){
  keys(doc,['title','company','customer','notes','variants']);text(doc.title,120,true);text(doc.notes,2000);
  for(const party of [doc.company,doc.customer]){keys(party,['name','address','tax_id','email']);text(party.name,160);text(party.address,300);text(party.tax_id,40);text(party.email,160);}
  if(!Array.isArray(doc.variants)||doc.variants.length<1||doc.variants.length>6)invalid('Wycena: 1–6 wariantów.');
  const ids=new Set();let count=0;
  for(const v of doc.variants){
   keys(v,['id','name','lines']);if(!UUID.test(v.id)||ids.has(v.id))invalid('Nieprawidłowy wariant.');ids.add(v.id);text(v.name,80,true);
   if(!Array.isArray(v.lines)||v.lines.length>80)invalid('Wariant: maksymalnie 80 pozycji.');
   const lines=new Set();
   for(const l of v.lines){keys(l,['id','name','unit','quantity','rate','discount','vat']);if(!UUID.test(l.id)||lines.has(l.id))invalid('Nieprawidłowa pozycja.');lines.add(l.id);text(l.name,200,true);if(!units.includes(l.unit))invalid('Nieprawidłowa jednostka.');lineTotals(l);count++;}
  }
  if(count>100||JSON.stringify(doc).length>22000)invalid('Wycena jest zbyt duża (100 pozycji / 22 kB).');return doc;
 }
 function totals(v){return v.lines.reduce((sum,l)=>{const t=lineTotals(l);for(const key of Object.keys(sum))sum[key]+=t[key];return sum;},{base:0,discount:0,net:0,tax:0,gross:0});}
 function money(cents){return (cents/100).toLocaleString('pl-PL',{style:'currency',currency:'PLN'});}
 function blank(title='Wycena'){return {title,company:{name:'',address:'',tax_id:'',email:''},customer:{name:'',address:'',tax_id:'',email:''},notes:'',variants:[{id:root.crypto.randomUUID(),name:'Podstawowy',lines:[]}]};}
 const model={UUID,units,validate,decimal,lineTotals,totals,money,blank};
 if(typeof module==='object')module.exports=model;else root.AKPProModel=model;
})(globalThis);
