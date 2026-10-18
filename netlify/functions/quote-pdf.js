'use strict';
const PDFDocument=require('pdfkit');
const path=require('node:path');
const fs=require('node:fs');
const {lineTotals,totals,money}=require('../../public/pro-model');
module.exports=(snapshot,variant,job)=>new Promise((resolve,reject)=>{
 const pdf=new PDFDocument({size:'A4',margins:{top:48,bottom:60,left:42,right:42},bufferPages:true,info:{Title:snapshot.document.title,Author:snapshot.document.company.name||'AKP Commander'}});
 const chunks=[];pdf.on('data',x=>chunks.push(x));pdf.on('error',reject);pdf.on('end',()=>resolve(Buffer.concat(chunks)));
 // Netlify bundles functions at the ZIP root but retains included_files paths.
 const font=[path.join(__dirname,'fonts','DejaVuSans.ttf'),path.join(process.cwd(),'netlify/functions/fonts/DejaVuSans.ttf')].find(file=>fs.existsSync(file));
 if(!font){pdf.destroy();reject(Error('PDF font asset missing'));return;}pdf.font(font);
 const doc=snapshot.document, width=511;
 function header(){pdf.fillColor('#ad1632').fontSize(24).text('AKP / WYCENA PRO');pdf.fillColor('#151e30').fontSize(16).text(doc.title);pdf.fontSize(9).fillColor('#4b5563').text('Wariant: '+variant.name+'  •  Wersja '+snapshot.version+'  •  PLN');pdf.moveDown();}
 function room(h=64){if(pdf.y+h>760){pdf.addPage();header();}}
 header();
 for(const [label,party] of [['WYKONAWCA',doc.company],['KLIENT',doc.customer]]){
  pdf.fontSize(9).fillColor('#ad1632').text(label);pdf.fillColor('#151e30').fontSize(11).text(party.name||'Dane do uzupełnienia',{width});
  pdf.fontSize(9).text([party.address,party.tax_id?'NIP: '+party.tax_id:'',party.email].filter(Boolean).join(' • '),{width});pdf.moveDown();
 }
 pdf.fontSize(8).fillColor('#4b5563').text('Zlecenie: '+job);pdf.moveDown();
 variant.lines.forEach((l,i)=>{
  room(100);const t=lineTotals(l);pdf.fillColor('#151e30').fontSize(11).text((i+1)+'. '+l.name,{width});
  pdf.fontSize(9).fillColor('#4b5563').text(l.quantity+' '+l.unit+' × '+money(Number(require('../../public/pro-model').decimal(l.rate,2,100000000)))+'   |   Rabat '+l.discount+'%   |   VAT '+l.vat+'%',{width});
  pdf.fillColor('#151e30').text('Netto '+money(t.net)+'   VAT '+money(t.tax)+'   Brutto '+money(t.gross),{width,align:'right'});pdf.moveDown(0.7);
 });
 room(110);const sum=totals(variant);pdf.fontSize(11).fillColor('#151e30').text('Netto: '+money(sum.net),{align:'right'}).text('VAT: '+money(sum.tax),{align:'right'});
 pdf.fillColor('#ad1632').fontSize(16).text('Razem brutto: '+money(sum.gross),{align:'right'});
 if(doc.notes){room(100);pdf.moveDown().fontSize(10).fillColor('#151e30').text('Uwagi i warunki').fontSize(9).text(doc.notes,{width});}
 const pages=pdf.bufferedPageRange();for(let i=pages.start;i<pages.start+pages.count;i++){pdf.switchToPage(i);pdf.fontSize(8).fillColor('#4b5563').text('AKP Commander • Wersja '+snapshot.version+' • '+(i+1)+' / '+pages.count,42,795,{lineBreak:false});}
 pdf.end();
});
