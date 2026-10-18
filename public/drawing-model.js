'use strict';
(function(root){
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 function invalid(){throw Object.assign(new Error('Nieprawidłowy rysunek: sprawdź współrzędne i podpisy (maks. 100 elementów).'),{status:422});}
 function keys(o,allowed){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!allowed.includes(k)))invalid();}
 function validate(d){
  keys(d,['schema','width','height','source_sha256','shapes']);
  if(d.schema!==1||!Number.isSafeInteger(d.width)||!Number.isSafeInteger(d.height)||d.width<1||d.height<1||d.width>12000||d.height>12000||d.width*d.height>40000000||typeof d.source_sha256!=='string'||!/^[0-9a-f]{64}$/.test(d.source_sha256)||!Array.isArray(d.shapes)||d.shapes.length>100||JSON.stringify(d).length>22000)invalid();
  const ids=new Set();for(const s of d.shapes){
   keys(s,['id','type','x1','y1','x2','y2','text','color']);
   if(!UUID.test(s.id||'')||ids.has(s.id)||!['line','arrow','dimension','label'].includes(s.type)||!['red','blue'].includes(s.color)||typeof s.text!=='string'||s.text.length>120||/[\u0000-\u001f]/.test(s.text))invalid();ids.add(s.id);
   for(const key of ['x1','y1','x2','y2'])if(!Number.isSafeInteger(s[key])||s[key]<0||s[key]>10000)invalid();
   if(['dimension','label'].includes(s.type)&&!s.text.trim())invalid();
   if(['line','arrow'].includes(s.type)&&s.text!=='')invalid();
   if(s.type!=='label'&&s.x1===s.x2&&s.y1===s.y2)invalid();
  }return d;
 }
 function point(rect,x,y){return {x:Math.max(0,Math.min(10000,Math.round((x-rect.left)/rect.width*10000))),y:Math.max(0,Math.min(10000,Math.round((y-rect.top)/rect.height*10000)))};}
 function render(canvas,image,d,preview=null){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);c.drawImage(image,0,0,w,h);
  const unit=Math.max(w,h)/1000,font=Math.max(13,20*unit);
  for(const s of preview?[...d.shapes,preview]:d.shapes){
   const x1=s.x1/10000*w,y1=s.y1/10000*h,x2=s.x2/10000*w,y2=s.y2/10000*h,color=s.color==='blue'?'#2463c2':'#c9273d';
   c.lineWidth=Math.max(2,3*unit);c.lineCap='round';c.strokeStyle=color;c.fillStyle=color;
   if(s.type!=='label'){
    c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
    const angle=Math.atan2(y2-y1,x2-x1),head=Math.max(10,14*unit);
    function arrow(x,y,a){c.beginPath();c.moveTo(x,y);c.lineTo(x-head*Math.cos(a-0.45),y-head*Math.sin(a-0.45));c.moveTo(x,y);c.lineTo(x-head*Math.cos(a+0.45),y-head*Math.sin(a+0.45));c.stroke();}
    if(s.type==='arrow'||s.type==='dimension')arrow(x2,y2,angle);if(s.type==='dimension')arrow(x1,y1,angle+Math.PI);
   }
   if(s.text){
    c.font='600 '+font+'px sans-serif';const padding=6*unit,width=c.measureText(s.text).width;
    // Keep labels on the image even at the right/bottom edge; never interpret HTML.
    const px=Math.max(padding,Math.min((s.type==='dimension'?(x1+x2)/2:x1),w-width-padding)),py=Math.max(font+padding,Math.min((s.type==='dimension'?(y1+y2)/2:y1),h-padding));
    c.fillStyle='#ffffff';c.fillRect(px-padding,py-font-padding,Math.min(width+padding*2,w),font+padding*2);c.fillStyle=color;c.fillText(s.text,px,py,Math.max(1,w-padding*2));
   }
  }
 }
 const model={validate,point,render,UUID};if(typeof module==='object')module.exports=model;else root.AKPDrawingModel=model;
})(globalThis);
