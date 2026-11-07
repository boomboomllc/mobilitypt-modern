---
layout: null
sitemap: false
---
// Offline support for the "My progress" app. Network first, so the site never goes stale;
// the saved copy is only used when there's no connection. Patient data is never cached here
// (it lives in the page's own storage).
const CACHE = 'mpt-v1';
const CORE = [
  "{{ '/assets/styles.css' | relative_url }}",
  "{{ '/assets/script.js' | relative_url }}",
  "{{ '/my-progress/' | relative_url }}",
  "{{ '/es/my-progress/' | relative_url }}",
  "{{ '/vi/my-progress/' | relative_url }}",
  "{{ '/ko/my-progress/' | relative_url }}"
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
