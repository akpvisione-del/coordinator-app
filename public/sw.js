/* AKP Commander PWA v03 — migrate legacy V19 root worker; never cache client data. */
'use strict';
const OFFLINE_CACHE='akp-offline-only-v03';
const OFFLINE_FILES=['/offline.html','/offline.css'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(OFFLINE_CACHE).then(c=>c.addAll(OFFLINE_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  // Preserve every existing cache, including potential V19 photos.
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  // Never intercept API, jobs, photos, POST requests, manifests or cross-origin content.
  if(request.method!=='GET'||request.mode!=='navigate'||url.origin!==self.location.origin)return;
  event.respondWith(fetch(request).catch(async()=>await caches.match('/offline.html')||Response.error()));
});
