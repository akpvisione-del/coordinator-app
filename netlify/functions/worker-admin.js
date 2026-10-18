'use strict';
// This module is server-only. It never returns passwords or privileged keys.
const key = () => process.env.SUPABASE_SECRET_KEY || '';
const hasServerSecret = () => /^(sb_secret_|eyJ)/.test(key());
const available = () => hasServerSecret() || !!(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
const failure = (status,message) => Object.assign(new Error(message),{status,publicMessage:message});
async function createWorker(cfg,actor,input,{fetcher=fetch}={}) {
  if(actor.role!=='coordinator')throw failure(403,'Brak uprawnień.');
  if(!input||typeof input!=='object'||Array.isArray(input))throw failure(422,'Nieprawidłowy formularz konta.');
  if(!available())throw failure(503,'Tworzenie kont monterów wymaga jednorazowego uruchomienia usługi kont na serwerze.');
  const name=typeof input.name==='string'?input.name.trim():'';
  const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
  const password=typeof input.password==='string'?input.password:'';
  const language=input.language||'pl';
  if(name.length<2||name.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>250||password.length<12||password.length>128||!['pl','ru','uk','en'].includes(language)||input.confirm_access!==true)
    throw failure(422,'Podaj imię, poprawny e-mail, hasło 12–128 znaków i potwierdź nadanie dostępu.');
  if(!hasServerSecret()){
    // Server-side proxy using the coordinator's verified Supabase JWT.
    // The Edge Function independently validates Auth role AND active DB profile.
    if(!actor.token||!cfg.url||!cfg.key)throw failure(503,'Usługa kont nie jest skonfigurowana.');
    let res;
    try{
      res=await fetcher(cfg.url+'/functions/v1/akp-provision-worker',{
        method:'POST',
        headers:{apikey:cfg.key,Authorization:'Bearer '+actor.token,'Content-Type':'application/json'},
        body:JSON.stringify({name,email,password,language,confirm_access:true}),
        signal:AbortSignal.timeout(14000)
      });
    }catch{throw failure(503,'Usługa kont jest chwilowo niedostępna.');}
    if(res.status===401||res.status===403)throw failure(403,'Brak uprawnień.');
    if(res.status===409)throw failure(409,'Nie można utworzyć konta dla podanego adresu.');
    if(!res.ok)throw failure(503,'Nie udało się utworzyć konta. Sprawdź listę przed ponowieniem.');
    let data;try{data=await res.json()}catch{throw failure(503,'Serwer zwrócił nieprawidłową odpowiedź.');}
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data?.worker?.id||'') || data.worker.role!=='worker')throw failure(503,'Nie potwierdzono utworzenia konta.');
    return {id:data.worker.id,display:data.worker.display,role:'worker',preferred_lang:data.worker.preferred_lang};
  }
  const secret=key();
  const headers={apikey:secret,'Content-Type':'application/json',Prefer:'return=representation'};
  // Opaque Supabase keys authenticate through apikey; only legacy keys are JWTs.
  if(!secret.startsWith('sb_secret_'))headers.Authorization='Bearer '+secret;
  const send=async(path,method,data)=>{
    const response=await fetcher(cfg.url+path,{method,headers,body:JSON.stringify(data),signal:AbortSignal.timeout(12000)});
    if(!response.ok){
      // Provider responses may include sensitive details: never relay them.
      if(path==='/auth/v1/admin/users'&&[400,422].includes(response.status))throw failure(409,'Nie utworzono nowego konta. Adres może już istnieć lub hasło nie spełnia wymagań. Istniejące konto pozostaje bez zmian.');
      throw failure(503,'Nie ukończono tworzenia konta. Nie ponawiaj operacji dla tego adresu bez sprawdzenia statusu przez administratora.');
    }
    return response.status===204?null:response.json();
  };
  // Auth account initially has NO AKP role, so any intermediate failure is fail-closed.
  const result=await send('/auth/v1/admin/users','POST',{email,password,email_confirm:true,app_metadata:{akp_provisioned_by:actor.user.id},user_metadata:{display_name:name}});
  const id=result?.id||result?.user?.id;
  if(!/^[0-9a-f-]{36}$/i.test(id||''))throw failure(503,'Nie potwierdzono utworzenia konta. Skontaktuj się z administratorem.');
  await send('/rest/v1/akp_profiles','POST',{user_id:id,display_name:name,role:'worker',is_active:true,preferred_lang:language});
  // Fixed worker role only. Client-supplied role and permissions are never forwarded.
  await send('/auth/v1/admin/users/'+id,'PUT',{app_metadata:{akp_role:'worker',akp_provisioned_by:actor.user.id}});
  return {id,display:name,role:'worker',preferred_lang:language};
}
module.exports={available,createWorker};
