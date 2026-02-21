const CACHE_NAME = "attendpro-cache-v4";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon.svg",
  "./icons/icon-maskable.svg",
  "./components/Auth.js",
  "./components/Home.js",
  "./components/Calendar.js",
  "./components/StudentCard.js",
  "./components/GroupCard.js",
  "./components/Session.js",
  "./components/Statistics.js",
  "./components/Salary.js",
  "./components/Settings.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(APP_SHELL.map((path) => cache.add(path))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (shouldUseNetworkFirst(request, url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

function shouldUseNetworkFirst(request, url) {
  if (request.mode === "navigate") return true;
  if (url.pathname === "/" || url.pathname.endsWith("/index.html")) return true;

  return [".js", ".css", ".html", ".webmanifest"].some((ext) => url.pathname.endsWith(ext));
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    return caches.match("./index.html");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_error) {
    return caches.match("./index.html");
  }
}
