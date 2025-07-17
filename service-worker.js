const CACHE_NAME = 'family-hub-cache-v1';

// List of URLs to cache when the service worker is installed.
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/js/main.js', // Replace with actual hashed filename, e.g., '/static/js/main.fc68f0c2.js'
  '/static/css/main.css', // Replace with actual hashed filename, e.g., '/static/css/main.f855e6bc.css'
  '/static/js/vendors.js', // Replace if your build generates additional bundles
  '/static/media/icon-192x192.png', // Replace with actual path to your icon
  '/static/media/icon-512x512.png' // Replace with actual path to your icon
];

// Install event: caches static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Opened cache');
        return cache.addAll(urlsToCache).catch(error => {
          console.error('Service Worker: Failed to cache some URLs:', error);
        });
      })
  );
});

// Fetch event: serves cached content or fetches from network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Activate event: cleans up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});