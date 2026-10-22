const CACHE_NAME = "oficina-public-assets-v1";
const IMMUTABLE_ASSETS = ["/logo.jpg","/icons/icon-192.png","/icons/icon-512.png","/icons/icon-maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(IMMUTABLE_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const cacheable =
    url.origin === self.location.origin && IMMUTABLE_ASSETS.includes(url.pathname);

  if (!cacheable) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(url.pathname);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) await cache.put(url.pathname, response.clone());
      return response;
    }),
  );
});
