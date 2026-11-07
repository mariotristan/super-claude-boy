// Offline support: serve from cache, refresh the cache in the background.
const CACHE = 'super-claude-boy-v13';
const ASSETS = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './src/main.js', './src/physics.js', './src/levels.js', './src/sprites.js', './src/audio.js', './src/input.js', './src/music.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached || (e.request.mode === 'navigate' ? cache.match('./index.html') : undefined));
      return cached || network;
    }),
  );
});
