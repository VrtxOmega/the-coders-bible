/* coi-serviceworker — injects COOP/COEP headers so SharedArrayBuffer works on GitHub Pages */
'use strict';

if (typeof window === 'undefined') {
    // Running as service worker
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

    self.addEventListener('fetch', e => {
        if (e.request.cache === 'only-if-cached' && e.request.mode !== 'same-origin') return;
        e.respondWith(
            fetch(e.request).then(r => {
                if (!r || r.status === 0 || !r.headers) return r;
                const headers = new Headers(r.headers);
                headers.set('Cross-Origin-Opener-Policy', 'same-origin');
                headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
                headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
                return new Response(r.body, { status: r.status, statusText: r.statusText, headers });
            })
        );
    });
} else {
    // Running in page — register self as service worker
    (async () => {
        if (typeof SharedArrayBuffer !== 'undefined') return; // already isolated
        if (!('serviceWorker' in navigator)) return;
        const src = document.currentScript?.src;
        if (!src) return;
        await navigator.serviceWorker.register(src);
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) window.location.reload();
    })().catch(console.error);
}
