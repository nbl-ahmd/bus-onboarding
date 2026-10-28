const CACHE = "nightline-shell-__NIGHTLINE_BUILD__";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          "/",
          "/audio/chime.wav",
          "/manifest.webmanifest",
          "/icons/icon.svg",
          "/icons/icon-192.png",
          "/icons/icon-512.png",
        ]),
      )
      .then(async () => {
        const cache = await caches.open(CACHE);
        const shell = await cache.match("/");
        const html = await shell.text();
        const assets = [
          ...new Set(
            [...html.matchAll(/(?:src|href)="([^"<>]+)"/g)]
              .map((match) => match[1].replaceAll("&amp;", "&"))
              .filter((url) => url.startsWith("/_next/static/")),
          ),
        ];
        await Promise.all(
          assets.map(async (url) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Offline app asset unavailable");
            await cache.put(url, response.clone());
            if (url.endsWith(".css")) {
              const css = await response.text();
              const fonts = [
                ...css.matchAll(
                  /url\(["']?([^)'"\s]+\.(?:woff2?|ttf))["']?\)/g,
                ),
              ].map(
                (match) =>
                  new URL(match[1], new URL(url, self.location.origin)).href,
              );
              await Promise.all(fonts.map((font) => cache.add(font)));
            }
          }),
        );
      }),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("nightline-shell-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.searchParams.has("_rsc")
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match("/")
            .then(
              (cached) =>
                cached ||
                new Response(
                  "Open Nightline once while connected to prepare offline mode.",
                  { status: 503 },
                ),
            ),
        ),
    );
    return;
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/audio/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
