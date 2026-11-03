// 오프라인 캐시. 코드/콘텐츠를 바꿔서 배포할 때마다 VERSION을 올릴 것.
const VERSION = 'v3';
const SHELL = `mhd-shell-${VERSION}`;
const IMAGES = 'mhd-images-v2'; // 그림 파일을 같은 이름으로 교체했을 때만 올림 (v2: 고해상도로 교체)

const SHELL_FILES = [
  './', 'index.html', 'privacy.html', 'css/style.css', 'manifest.webmanifest',
  'js/app.js', 'js/data.js', 'js/puzzle.js', 'js/quiz.js', 'js/store.js', 'js/tts.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];
const THUMBS = ['starry-night', 'sunflowers', 'bedroom', 'impression-sunrise', 'woman-parasol', 'water-lily-bridge',
  'pearl-earring', 'milkmaid', 'view-of-delft', 'ssireum', 'seodang', 'mudong'].map(id => `images/thumb/${id}.jpg`);

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    await (await caches.open(SHELL)).addAll(SHELL_FILES);
    await (await caches.open(IMAGES)).addAll(THUMBS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if ((key.startsWith('mhd-shell-') && key !== SHELL) || (key.startsWith('mhd-images-') && key !== IMAGES)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // 그림: 한 번 받은 건 캐시에서 (오프라인에서도 보이게)
  if (url.pathname.includes('/images/')) {
    e.respondWith((async () => {
      const cache = await caches.open(IMAGES);
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    })());
    return;
  }

  // 앱 파일: 네트워크 우선(최신 반영), 실패하면 캐시
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request);
      if (res.ok) (await caches.open(SHELL)).put(e.request, res.clone());
      return res;
    } catch {
      return (await caches.match(e.request)) || (await caches.match('index.html'));
    }
  })());
});
