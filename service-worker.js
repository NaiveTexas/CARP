const CACHE_NAME = "carp-v3";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./css/style.css",
    "./js/script.js",
    "./js/jspdf.umd.min.js",
    "./manifest.json",
    "./icons/icon_rumba.png"
];

// Instala e salva os arquivos no cache
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(FILES_TO_CACHE);
        console.log("Cache criado com sucesso!");
      } catch (err) {
        console.error("Erro ao criar cache:", err);
        throw err;
      }
    })
  );
});

// Remove caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );

  self.clients.claim();
});

// Intercepta requisições
self.addEventListener("fetch", (event) => {

  // Navegação (index.html)
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html").then((response) => {
        return response || fetch(event.request);
      })
    );
    return;
  }

  // Demais arquivos
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});