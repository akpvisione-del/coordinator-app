/* AKP Premium Cinematic v01 — zero third-party analytics, no client data, no auto audio. */
(()=>{'use strict';
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const hero=document.getElementById('heroArt');
 if(hero&&!reduced&&window.matchMedia('(hover:hover) and (pointer:fine)').matches){
  let raf=0,targetX=0,targetY=0;
  document.addEventListener('pointermove',e=>{
   targetX=Math.max(-13,Math.min(13,((e.clientX/window.innerWidth)-.5)*25));
   targetY=Math.max(-9,Math.min(9,((e.clientY/window.innerHeight)-.5)*18));
   if(raf)return;
   raf=requestAnimationFrame(()=>{hero.style.setProperty('--scene-x',`${targetX}px`);hero.style.setProperty('--scene-y',`${targetY}px`);raf=0;});
  },{passive:true});
 }
 // Preview must also work when opened as a downloaded file or via a plain local HTTP server.
 if(location.protocol==='file:'||['localhost','127.0.0.1'].includes(location.hostname)){
  document.querySelectorAll('a[data-login]').forEach(a=>a.setAttribute('href','./index.html'));
 }
 const btn=document.getElementById('soundBtn');const hint=document.getElementById('soundHint');
 let ctx=null,master=null,rumbleSource=null,rumbleGain=null,chordVoices=[],armed=false,loopId=0;
 const show=(s)=>{hint.textContent=s;hint.hidden=false;clearTimeout(show.timer);show.timer=setTimeout(()=>hint.hidden=true,3700)};
 function tone(freq,type,volume,pan,filterHz){
  const osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
  osc.type=type;osc.frequency.value=freq;gain.gain.value=0;filter.type='lowpass';filter.frequency.value=filterHz;
  osc.connect(filter);filter.connect(gain);gain.connect(master);
  if(typeof ctx.createStereoPanner==='function'){
   const p=ctx.createStereoPanner();p.pan.value=pan;filter.disconnect();filter.connect(p);p.connect(gain);
  }
  osc.start();return {osc,gain,base:volume};
 }
 function swell(chord){
  if(!ctx||!master)return;const now=ctx.currentTime;
  chordVoices.forEach(v=>{try{v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(0,now,.8);v.osc.stop(now+2.6)}catch{}});
  chordVoices=[];
  // Original synthetic brass-horn/drone texture, not copyrighted music.
  chord.forEach((f,i)=>{
   const v=tone(f,i===0?'triangle':'sawtooth',i===0?.065:.016,i%2?.4:-.4,i===0?330:570);
   v.gain.gain.setValueAtTime(0,now);v.gain.gain.linearRampToValueAtTime(v.base,now+2.8);v.gain.gain.setValueAtTime(v.base,now+5);v.gain.gain.linearRampToValueAtTime(v.base*.5,now+7.8);chordVoices.push(v);
  });
 }
 function caveNoise(){
  const len=Math.floor(ctx.sampleRate*4),buf=ctx.createBuffer(1,len,ctx.sampleRate),data=buf.getChannelData(0);
  let last=0;for(let i=0;i<len;i++){last=(last*.997)+((Math.random()-.5)*.003);data[i]=last;}
  const src=ctx.createBufferSource(),low=ctx.createBiquadFilter(),gain=ctx.createGain();src.buffer=buf;src.loop=true;
  low.type='lowpass';low.frequency.value=125;gain.gain.value=.045;
  src.connect(low);low.connect(gain);gain.connect(master);src.start();rumbleSource=src;rumbleGain=gain;
 }
 async function play(){
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC){show('Ta przeglądarka nie obsługuje generowanego dźwięku.');return;}
  try{
   ctx=new AC();master=ctx.createGain();master.gain.value=.0001;master.connect(ctx.destination);await ctx.resume();
   caveNoise();const sequence=[[55,110,164.81],[49,98,146.83],[43.65,87.31,130.81],[46.25,92.5,138.59]];
   let step=0;swell(sequence[step]);loopId=setInterval(()=>{step=(step+1)%sequence.length;swell(sequence[step])},8100);
   master.gain.setTargetAtTime(.58,ctx.currentTime,.8);armed=true;btn.setAttribute('aria-pressed','true');btn.setAttribute('aria-label','Wyłącz epickie tło dźwiękowe');show('Włączono autorską syntezę dźwięku: niski bas, przestrzeń i instrumenty dęte.');
  }catch(err){console.warn('AKP sound unavailable',err);show('Dźwięk zablokowany przez przeglądarkę.');stop();}
 }
 function stop(){clearInterval(loopId);loopId=0;armed=false;btn.setAttribute('aria-pressed','false');btn.setAttribute('aria-label','Włącz epickie tło dźwiękowe');
  if(ctx){const active=ctx;try{master?.gain.setTargetAtTime(0,active.currentTime,.08)}catch{}ctx=null;master=null;chordVoices=[];
   setTimeout(()=>{rumbleSource?.stop?.();rumbleSource=null;rumbleGain=null;active.close().catch(()=>{})},300);
  }
 }
 btn.addEventListener('click',()=>{if(armed){stop();show('Dźwięk wyłączony.')}else play();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&armed)stop();});
 window.addEventListener('pagehide',()=>{if(armed)stop();});
})();
