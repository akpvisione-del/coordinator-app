'use strict';
(()=>{
  const el=id=>document.getElementById(id);
  const fragment=new URLSearchParams(location.hash.slice(1));
  let token=fragment.get('type')==='recovery'?fragment.get('access_token')||'':'';
  const providerError=fragment.has('error')||fragment.has('error_code');
  // Remove every fragment before any request. Never persist recovery credentials.
  if(location.hash)history.replaceState(null,'',location.pathname);
  fragment.delete('access_token');fragment.delete('refresh_token');
  function message(text,error=false){el('message').textContent=text;el('message').dataset.error=String(error);}
  async function post(path,body){
    const response=await fetch('/api/recovery/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Akp-Request':'commander-v10'},credentials:'same-origin',cache:'no-store',body:JSON.stringify(body)});
    let data;try{data=await response.json()}catch{throw new Error('Nieprawidłowa odpowiedź serwera. Spróbuj później.');}
    if(!response.ok)throw new Error(data.message||'Nie udało się wykonać operacji.');
    return data;
  }
  if(token){el('requestForm').hidden=true;el('passwordForm').hidden=false;el('intro').textContent='Ustaw nowe hasło dla swojego konta AKP.';}
  else if(providerError)message('Link wygasł lub został już wykorzystany. Wyślij nowy link poniżej.',true);
  el('requestForm').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;message('Wysyłanie linku…');
    try{const data=await post('request',{email:el('email').value.trim()});message(data.message);}catch(error){message(error.message||'Brak połączenia. Spróbuj ponownie.',true);}finally{button.disabled=false;}
  });
  el('passwordForm').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!token){message('Brakuje ważnego linku. Poproś o nowy.',true);return;}
    if(el('newPassword').value!==el('confirmPassword').value){message('Wpisane hasła różnią się.',true);return;}
    const button=event.target.querySelector('button');button.disabled=true;message('Zapisywanie hasła…');
    try{const data=await post('complete',{access_token:token,password:el('newPassword').value});token='';el('passwordForm').reset();el('passwordForm').hidden=true;el('intro').textContent='Dostęp do konta został odzyskany.';message(data.message);el('loginLink').focus();}catch(error){message(error.message||'Brak połączenia. Spróbuj ponownie.',true);}finally{el('newPassword').value='';el('confirmPassword').value='';button.disabled=false;}
  });
})();
