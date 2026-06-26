const CACHE_NAME = 'gestor-v1';
const PRECACHE = [
    '/',
    '/vendor/tailwind.css',
    '/vendor/inter.css',
    '/vendor/phosphor/bold/style.css',
    '/vendor/phosphor/fill/style.css',
    '/vendor/phosphor/regular/style.css',
    '/vendor/html2pdf.bundle.min.js',
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE).catch(() => {})));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = e.request.url;
    if (url.includes('firestore') || url.includes('googleapis') || url.includes('firebaseio')) return;

    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(res => {
                if (res && res.status === 200 && res.type === 'basic') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return res;
            }).catch(() => {
                // Offline + cache miss: fall back to root for navigations,
                // empty 504 for other resources so the app does not throw.
                if (e.request.mode === 'navigate') return caches.match('/');
                return new Response('', { status: 504, statusText: 'Offline' });
            });
        })
    );
});
