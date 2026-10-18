'use strict';
const {createHash}=require('node:crypto');
const SHEET_ID='1D23GAhR8O1enh420DnsH7QuigYLa6gkb1FHkcEUaYIw';
function normalizeReference(row){return String(row.NR_LM||row.ID_AKP||'').trim().replace(/^(\d{3})[-/](\d+)[-/](\d+)[-/](\d+)$/,'$1/$2/$3/$4');}
function mapRows(values){
 if(!Array.isArray(values)||values.length<2)throw new Error('Arkusz nie zawiera zleceń.');
 const headers=values[0].map(x=>String(x).trim());
 for(const k of ['ID_AKP','NR_LM','KLIENT','TYP_PRACY','STATUS'])if(!headers.includes(k))throw new Error('Nieprawidłowy format centralnej bazy: '+k);
 const seen=new Set();
 return values.slice(1).filter(v=>v.some(x=>String(x).trim())).map(v=>{
  const r=Object.fromEntries(headers.map((h,i)=>[h,String(v[i]??'').trim()]));const ref=normalizeReference(r);
  if(!ref||seen.has(ref))throw new Error('Brak identyfikatora lub duplikat: '+ref);seen.add(ref);
  const state=r.STATUS;
  const allowed=['NOWE','DO_KONTAKTU','DO_UMOWIENIA','UMOWIONE','POMIAR','DO_WYCENY','WYCENA_W_TOKU','OCZEKUJE_NA_KLIENTA','OCZEKUJE_NA_MATERIAL','OCZEKUJE_NA_DOSTAWE','DO_REALIZACJI','W_REALIZACJI','WSTRZYMANE','DO_ODBIORU','DO_ROZLICZENIA','ZAKONCZONE','REKLAMACJA','SERWIS','ANULOWANE','POMIARY','PLANOWANE','REALIZACJA'];
  let status=state.startsWith('WYKONANE_ROZLICZONE')?'ZAKONCZONE':state;
  if(!allowed.includes(status))throw new Error('Nieznany status źródłowy: '+state);
  const priority=['KRYTYCZNY','WYSOKI'].includes(r.PRIORYTET)?r.PRIORYTET:'NORMALNY';
  const planned=r.PLAN_START||r.DATA_POMIARU;const due_date=/^\d{4}-\d{2}-\d{2}$/.test(planned)?planned:null;
  // Financial notes and full source record are coordinator-only in akp_job_sources.
  const instructions=[r.KLIENT&&'Klient: '+r.KLIENT,r.TELEFON&&'Telefon: '+r.TELEFON,r.PRACOWNICY&&'Wykonawca wg Google: '+r.PRACOWNICY+' (konto/przydział do potwierdzenia)',r.NASTEPNY_KROK&&'Następny krok: '+r.NASTEPNY_KROK,r.BLOKADA&&'Blokada: '+r.BLOKADA].filter(Boolean).join('\n');
  return {akp_id:r.ID_AKP,lm_number:r.NR_LM||null,iproc_number:r.NR_IPROC||null,client_name:r.KLIENT||null,client_phone:r.TELEFON||null,client_email:r.EMAIL||null,client_address:r.ADRES||null,reference:ref,title:(r.TYP_PRACY+' — '+r.KLIENT).slice(0,180),location:r.ADRES.slice(0,200),due_date,status,priority,instructions:instructions.slice(0,2500),source_record:r,source_hash:createHash('sha256').update(JSON.stringify(r)).digest('hex')};
 });
}
async function readSheet(token){
 if(typeof token!=='string'||token.length<20||token.length>6000)throw new Error('Brak autoryzacji Google.');
 const opts={headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)};
 const meta=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+SHEET_ID+'?fields=sheets.properties.title',opts);
 if(!meta.ok)throw new Error('Google odmówił dostępu do centralnej bazy. Połącz właściwe konto.');
 const sheets=(await meta.json()).sheets||[];
 const ranges=sheets.map(s=>"'"+s.properties.title.replace(/'/g,"''")+"'!A1:AE501");
 const url=new URL('https://sheets.googleapis.com/v4/spreadsheets/'+SHEET_ID+'/values:batchGet');ranges.forEach(r=>url.searchParams.append('ranges',r));
 const response=await fetch(url,opts);if(!response.ok)throw new Error('Nie udało się odczytać zleceń z Google.');
 const books=(await response.json()).valueRanges||[];
 const found=books.find(s=>s.values?.[0]?.includes('ID_AKP')&&s.values?.[0]?.includes('NR_LM'));
 if(!found)throw new Error('Nie znaleziono zakładki centralnej bazy zleceń.');
 if(found.values.length>=501)throw new Error('Import przekracza limit 500 wierszy.');
 return mapRows(found.values);
}
module.exports={SHEET_ID,mapRows,readSheet,normalizeReference};
