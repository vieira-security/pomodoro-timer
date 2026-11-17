/* Service worker: deixa o site funcionando offline.
   Estratégia: responde do cache na hora e atualiza o cache em segundo plano
   (stale-while-revalidate). Troque VERSION ao publicar mudanças grandes. */
const VERSION = "v3";
const CACHE = `pomodoro-${VERSION}`;
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/main.js",
  "./js/core.js",
  "./js/i18n.js",
  "./js/audio.js",
  "./js/extras.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pomodoro-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached || (req.mode === "navigate" ? cache.match("./index.html") : undefined));
      return cached || network;
    })
  );
});

// Clicar na notificação traz o timer de volta
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow("./");
    })
  );
});
