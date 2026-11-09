// オフライン対応（一度開けば、ネットがなくても遊べる）
const CACHE = 'cajon-dojo-v3';
const ASSETS = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icon.svg',
  'js/main.js', 'js/audio.js', 'js/sounds.js', 'js/storage.js', 'js/patterns.js', 'js/judge.js',
  'js/backing.js', 'js/player.js', 'js/ui.js', 'js/cajon.js', 'js/grid.js', 'js/practice.js',
  'js/game.js', 'js/editor.js', 'js/screens.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// ネット優先・失敗したらキャッシュ（更新がすぐ反映され、オフラインでも動く）
// cache: 'no-cache' でブラウザのHTTPキャッシュ（GitHub Pagesは10分）を使わず必ず最新を確認する
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
