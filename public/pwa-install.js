(() => {
  'use strict';
  // Upgrade a legacy root-scope V19 Service Worker safely; preserve local user data.
  // Only same-origin navigation receives an offline notice, never cached job data.
  if ('serviceWorker' in navigator && window.isSecureContext === true) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', {scope:'/'}).catch(() => {});
    }, {once:true});
  }

  const buttons = Array.from(document.querySelectorAll('[data-akp-install]'));
  const dialog = document.getElementById('akpInstallDialog');
  const help = document.getElementById('akpInstallHelp');
  const standalone = window.matchMedia('(display-mode: standalone)');
  let pending = null;
  let installed = standalone.matches || navigator.standalone === true;
  let busy = false;
  const refresh = () => buttons.forEach(button => { button.hidden = installed; button.disabled = busy; });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pending = event;
    refresh();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    pending = null;
    if (dialog.open) dialog.close();
    refresh();
  });
  standalone.addEventListener('change', event => { installed = event.matches || navigator.standalone === true; refresh(); });
  function instructions() {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    help.textContent = ios
      ? 'Otwórz menu Udostępnij w przeglądarce i wybierz Dodaj do ekranu początkowego.'
      : 'Otwórz menu przeglądarki (⋮ lub …), a następnie wybierz Zainstaluj aplikację lub Dodaj do ekranu głównego. Jeśli tej opcji nie ma, otwórz akp.wtf w Chrome lub Edge.';
    if (!dialog.open) dialog.showModal();
  }
  buttons.forEach(button => button.addEventListener('click', async () => {
    if (busy || installed) return;
    if (!pending) { instructions(); return; }
    const event = pending;
    pending = null;
    busy = true;
    refresh();
    try {
      await event.prompt();
      await event.userChoice;
    } catch { instructions(); }
    finally { busy = false; refresh(); }
  }));
  refresh();
})();
