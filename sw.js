/*
  Golf Tracker — Service Worker  (network-first, offline-capable)

  SHELL: everything needed to boot the app without a network hit:
    - index.html, manifest.json, icons
    - vendor/opencv.js  (9.6MB — precached on first install so detection works offline)
    - fonts/fonts.css + all 12 WOFF2 subsets (latin + latin-ext for Anton and Manrope)

  Strategy: network-first for all GETs; successful responses update the cache
  so subsequent loads can fall back to cached versions offline.
  On the very first install, SHELL is fetched eagerly (install-time precache)
  so the app is immediately available offline after that first page load.
*/
const CACHE_NAME = 'golf-tracker-v26';

const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/vendor/opencv.js',
  '/images/green-70.jpg',
  '/images/green-50.jpg',
  '/images/green-35.jpg',
  '/fonts/fonts.css',
  '/fonts/anton-400-latin-ext.woff2',
  '/fonts/anton-400-latin.woff2',
  '/fonts/manrope-400-latin-ext.woff2',
  '/fonts/manrope-400-latin.woff2',
  '/fonts/manrope-500-latin-ext.woff2',
  '/fonts/manrope-500-latin.woff2',
  '/fonts/manrope-600-latin-ext.woff2',
  '/fonts/manrope-600-latin.woff2',
  '/fonts/manrope-700-latin-ext.woff2',
  '/fonts/manrope-700-latin.woff2',
  '/fonts/manrope-800-latin-ext.woff2',
  '/fonts/manrope-800-latin.woff2',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Network-first: try the network, update cache on success, fall back to cache.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Cache API only supports http/https — skip chrome-extension://, blob:, data:, etc.
  // Without this guard the SW throws "Failed to execute 'put' on 'Cache': Request
  // scheme chrome-extension is unsupported" when browser extensions inject requests.
  const { protocol } = new URL(event.request.url);
  if (protocol !== 'http:' && protocol !== 'https:') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
