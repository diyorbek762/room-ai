// RoomAI Service Worker - 3D Asset Cache First Engine
const CACHE_NAME = "roomai-assets-v1";
const MODEL_CACHE_NAME = "roomai-models-v4";

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  "/",
  "/catalog",
  "/checkout",
  "/ar",
  "/models/draco/draco_decoder.js",
  "/models/draco/draco_decoder.wasm",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[SW] Pre-cache warning:", err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== MODEL_CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Handle 3D model requests with Cache-First strategy
  if (url.pathname.endsWith(".glb") || url.pathname.endsWith(".gltf") || url.pathname.includes("/models/")) {
    event.respondWith(
      caches.open(MODEL_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          console.error("[SW] Network fetch failed for 3D asset:", url.pathname, error);
          throw error;
        }
      })
    );
    return;
  }

  // Handle static assets & navigation with Stale-While-Revalidate
  if (event.request.method === "GET" && url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
