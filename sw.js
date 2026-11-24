const V='pendiente-v2',ASSETS=['./','index.html','styles.css','app.js','manifest.json','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  if(r.mode==='navigate'){ // red primero, caché como respaldo
    e.respondWith(fetch(r).then(x=>{const c=x.clone();caches.open(V).then(h=>h.put(r,c));return x}).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))));return}
  e.respondWith(caches.match(r).then(m=>{ // stale-while-revalidate
    const net=fetch(r).then(x=>{if(x.ok){const c=x.clone();caches.open(V).then(h=>h.put(r,c))}return x}).catch(()=>m);
    return m||net}));
});
self.addEventListener('sync',e=>{if(e.tag==='sync-tasks')e.waitUntil(self.clients.matchAll().then(l=>l.forEach(c=>c.postMessage('sync'))))});
self.addEventListener('push',e=>{const d=e.data?.json?.()||{title:'Pendiente',body:'Tienes un recordatorio'};
  e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:'icons/icon-192.png'}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window'}).then(l=>l[0]?l[0].focus():clients.openWindow('./')))});
