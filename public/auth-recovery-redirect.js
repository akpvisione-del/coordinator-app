'use strict';
(()=>{
  const params=new URLSearchParams(location.hash.slice(1));
  // Supabase errors may omit type=recovery. Never leave them hidden on the landing page.
  if(params.get('type')==='recovery'||params.has('error')||params.has('error_code'))location.replace('/reset-password.html'+location.hash);
})();
