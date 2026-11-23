/*
 * Capydoku service worker — offline play after the first visit, newest code
 * whenever the network is there.
 *
 * The shell (HTML, CSS, JS) is network-first: an online reload always gets the
 * deployed files and the cache is only the offline fallback, so a home-screen
 * app can never get stuck on an old copy. Icons and the manifest are
 * cache-first because they do not change between deploys. Cache keys drop the
 * ?v= cache-buster, so one file has exactly one cache entry.
 *
 * Bump VERSION (and the ?v= in index.html) on every deploy.
 */
'use strict';

var VERSION = 4;
var CACHE = 'capydoku-v' + VERSION;
var CORE = ['index.html', 'styles.css', 'app.js', 'engine.js'];
var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './engine.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

/* one cache entry per file: the query string is a version tag, not a resource */
function keyOf(input) {
  var url = new URL(input, self.registration.scope);
  url.search = '';
  url.hash = '';
  return url.href;
}

function putInCache(request, response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return;
  caches.open(CACHE).then(function (cache) {
    cache.put(keyOf(request.url), response.clone());
  });
}

function fromCache(input) {
  return caches.match(keyOf(input));
}

function offlinePage() {
  return new Response(
    '<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
      '<title>Capydoku</title><p style="font-family:-apple-system,sans-serif;padding:28px;line-height:1.6">' +
      '오프라인이라 앱을 불러오지 못했어요. 연결한 뒤 새로고침해 주세요.</p>',
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

function networkFirst(request, fallback) {
  return fetch(request)
    .then(function (response) {
      putInCache(request, response);
      return response;
    })
    .catch(function () {
      return fromCache(request.url).then(function (cached) {
        if (cached) return cached;
        return fallback ? fromCache(fallback) : null;
      });
    })
    .then(function (response) {
      if (response) return response;
      return request.mode === 'navigate' ? offlinePage() : Response.error();
    });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) {
        return cache.addAll(ASSETS);
      })
      .catch(function () {
        /* a missing optional asset must not break installation */
      })
      .then(function () {
        /* take over as soon as this worker is installed */
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        /* control the already open page, not only the next navigation */
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  /* the page itself: always ask the network first, cached shell offline */
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  /* shell files (with or without ?v=): network first, cache as the fallback */
  var name = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
  if (CORE.indexOf(name) !== -1) {
    event.respondWith(networkFirst(request));
    return;
  }

  /* icons, manifest and everything else: cache first, then network */
  event.respondWith(
    fromCache(request.url).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        putInCache(request, response);
        return response;
      });
    })
  );
});
