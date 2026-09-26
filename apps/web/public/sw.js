// v3 removes the legacy cache, which previously included authenticated API data.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>/^(perpetual|lead2|crm)[-]/.test(k)).map(k=>caches.delete(k)))),self.clients.claim()])));
// Always use the network. No customer data or authenticated responses are cached.
