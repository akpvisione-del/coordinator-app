// AKP Commander P0 — privileged worker provisioning (server-only).
// Public endpoint has gateway JWT verification AND explicit coordinator checks.
// No service-role secret reaches Netlify or the browser.
const response=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const bad=(status,message)=>response(status,{message});
const isUuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const makeHandler=(env,requestFetch)=>async(req)=>{
  if(req.method!=='POST')return bad(405,'Niedozwolona metoda.');
  const bearer=req.headers.get('authorization')||'';
  if(!/^Bearer [A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/.test(bearer))return bad(401,'Wymagane logowanie.');
  const url=(env.get('SUPABASE_URL')||'').replace(/\/$/,'');
  const anon=env.get('SUPABASE_ANON_KEY')||'';
  const secret=env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!anon||!secret)return bad(503,'Usługa kont jest niedostępna.');
  // sb_secret_ is an opaque API key, not a JWT. Passing it as Bearer causes
  // PostgREST 403/42501. For opaque keys, the gateway authenticates by apikey.
  // Retain Authorization only for the legacy JWT-based service_role key.
  const headers={apikey:secret,'Content-Type':'application/json'};
  if(!secret.startsWith('sb_secret_'))headers.Authorization='Bearer '+secret;
  const send=(path,init={})=>requestFetch(url+path,{...init,signal:AbortSignal.timeout(12000)});
  try{
    const userResp=await send('/auth/v1/user',{headers:{apikey:anon,Authorization:bearer}});
    if(!userResp.ok)return bad(401,'Sesja wygasła.');
    const user=await userResp.json();
    if(!isUuid(user.id)||user.app_metadata?.akp_role!=='coordinator')return bad(403,'Brak uprawnień.');
    const profile=await send('/rest/v1/akp_profiles?user_id=eq.'+user.id+'&select=role,is_active&limit=1',{headers});
    if(!profile.ok)return bad(503,'Nie można zweryfikować uprawnień.');
    const rows=await profile.json();
    if(!Array.isArray(rows)||rows.length!==1||rows[0].role!=='coordinator'||rows[0].is_active!==true)return bad(403,'Brak uprawnień.');
    const raw=await req.text();
    if(raw.length>4096)return bad(413,'Za duże żądanie.');
    let data;try{data=JSON.parse(raw)}catch{return bad(400,'Nieprawidłowe dane.')}
    if(!data||typeof data!=='object'||Array.isArray(data))return bad(422,'Nieprawidłowy formularz konta.');
    // Worker profile management is a coordinator-only, non-destructive action.
    // Never allow the client to change user_id, role, email or password.
    if(data?.action==='update_worker'){
      if(!isUuid(data.worker_id))return bad(422,'Nieprawidłowy identyfikator montera.');
      const allowed=new Set(['action','worker_id','name','language','is_active']);
      if(Object.keys(data).some(k=>!allowed.has(k)))return bad(422,'Niedozwolone pole aktualizacji.');
      const changes={};
      if(data.name!==undefined){
        if(typeof data.name!=='string'||data.name.trim().length<2||data.name.trim().length>100)return bad(422,'Imię i nazwisko: 2–100 znaków.');
        changes.display_name=data.name.trim();
      }
      if(data.language!==undefined){
        if(!['pl','ru','uk','en'].includes(data.language))return bad(422,'Nieprawidłowy język.');
        changes.preferred_lang=data.language;
      }
      if(data.is_active!==undefined){
        if(typeof data.is_active!=='boolean')return bad(422,'Nieprawidłowy status konta.');
        changes.is_active=data.is_active;
      }
      if(Object.keys(changes).length===0)return bad(422,'Brak zmian do zapisania.');
      const workerPath='/rest/v1/akp_profiles?user_id=eq.'+data.worker_id+'&role=eq.worker';
      const target=await send(workerPath+'&select=user_id,role,is_active',{headers});
      if(!target.ok)return bad(503,'Nie udało się zweryfikować montera.');
      const candidates=await target.json();
      if(!Array.isArray(candidates)||candidates.length!==1)return bad(404,'Nie znaleziono konta montera.');
      const updated=await send(workerPath,{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify(changes)});
      if(!updated.ok)return bad(503,'Nie udało się zapisać zmian montera.');
      const edited=await updated.json();
      if(!Array.isArray(edited)||edited.length!==1||edited[0].user_id!==data.worker_id||edited[0].role!=='worker')return bad(409,'Zmiana montera nie została potwierdzona.');
      return response(200,{worker:{id:edited[0].user_id,display:edited[0].display_name,role:'worker',is_active:edited[0].is_active,preferred_lang:edited[0].preferred_lang||'pl'}});
    }
    const inviting=data.action==='invite_worker';
    if(data.action!==undefined&&!inviting)return bad(422,'Nieznana operacja konta.');
    let inviteOrigin='';
    if(inviting){
      if(Object.keys(data).some(k=>!['action','name','email','language','confirm_access'].includes(k)))return bad(422,'Nieprawidłowe zaproszenie.');
      inviteOrigin=(env.get('AKP_APP_ORIGIN')||'').replace(/\/$/,'');
      if(!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(inviteOrigin))return bad(503,'Zaproszenia wymagają skonfigurowanej domeny AKP_APP_ORIGIN.');
    }

    const name=typeof data.name==='string'?data.name.trim():'';
    const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
    const password=typeof data.password==='string'?data.password:'';
    const language=data.language||'pl';
    if(name.length<2||name.length>100||email.length>250||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||(!inviting&&(password.length<12||password.length>128))||!['pl','ru','uk','en'].includes(language)||data.confirm_access!==true)
      return bad(422,'Wymagane: imię, poprawny e-mail, hasło min. 12 znaków i zgoda.');
    // Fail-closed: Auth user is created with NO AKP role, not worker/coordinator.
    const created=await send('/auth/v1/admin/users',{method:'POST',headers,body:JSON.stringify({email,...(!inviting?{password}:{}),email_confirm:true,app_metadata:{akp_provisioned_by:user.id},user_metadata:{display_name:name}})});
    if(!created.ok){
      if(created.status===400||created.status===422)return bad(409,'Nie można utworzyć konta dla podanego adresu.');
      return bad(503,'Nie udało się utworzyć konta.');
    }
    const result=await created.json();
    const id=result?.id||result?.user?.id;
    if(!isUuid(id))return bad(503,'Nie udało się potwierdzić konta.');
    // A provisioning failure MUST NEVER leave a user with a privileged AKP role.
    {
      const profileWrite=await send('/rest/v1/akp_profiles',{method:'POST',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({user_id:id,display_name:name,role:'worker',is_active:true,preferred_lang:language})});
      if(!profileWrite.ok)throw Error('profile');
      const promoted=await send('/auth/v1/admin/users/'+id,{method:'PUT',headers,body:JSON.stringify({app_metadata:{akp_role:'worker',akp_provisioned_by:user.id}})});
      if(!promoted.ok)throw Error('authrole');
    }
    // Preserve incomplete identities without an AKP role; never delete accounts on failure.
    if(inviting){
      const invitation=await send('/auth/v1/recover?redirect_to='+encodeURIComponent(inviteOrigin+'/reset-password.html'),{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email})});
      if(!invitation.ok)return bad(503,'Konto utworzono, ale link nie został potwierdzony. Sprawdź listę; użyj odzyskiwania hasła, nie twórz konta ponownie.');
    }
    return response(201,{worker:{id,display:name,role:'worker',preferred_lang:language}});
  }catch{
    return bad(503,'Nie ukończono tworzenia konta. Sprawdź listę przed ponowieniem.');
  }
};
Deno.serve(makeHandler(Deno.env,fetch));
