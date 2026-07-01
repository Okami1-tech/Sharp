// ============================================
// AKRADA — SERVICE WORKER
// Campus Intelligence Platform
// ============================================

const CACHE_NAME = 'akrada-v2';
const STATIC_CACHE = 'akrada-static-v2';
const DYNAMIC_CACHE = 'akrada-dynamic-v2';
const MAP_CACHE = 'akrada-maps-v2';

// Static assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/logo.png',
  '/robots.txt',
  '/sitemap.xml'
];

// Routes that should load even when offline
const OFFLINE_ROUTES = [
  '/',
  '/about',
  '/campuses'
];

// ============================================
// INSTALL
// ============================================
self.addEventListener('install', (event) => {
  console.log('🚀 Akrada Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Static assets cached');
        return self.skipWaiting();
      })
  );
});

// ============================================
// ACTIVATE
// ============================================
self.addEventListener('activate', (event) => {
  console.log('⚡ Akrada Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old cache versions
          if (
            cacheName !== STATIC_CACHE &&
            cacheName !== DYNAMIC_CACHE &&
            cacheName !== MAP_CACHE
          ) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Activation complete');
      return self.clients.claim();
    })
  );
});

// ============================================
// FETCH — Smart Caching Strategy
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Supabase API calls — always go network
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Skip browser extensions and chrome-extension
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Mapbox tiles — cache with expiry
  if (url.hostname.includes('mapbox.com') || url.hostname.includes('mapbox.cn')) {
    if (url.pathname.includes('/tiles/') || url.pathname.includes('/styles/')) {
      event.respondWith(cacheWithExpiry(request, MAP_CACHE, 7)); // 7 days
      return;
    }
    // Mapbox API calls — network first
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Static assets — cache first
  if (STATIC_ASSETS.includes(url.pathname) || OFFLINE_ROUTES.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML navigation requests — network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, DYNAMIC_CACHE).catch(() => {
        return caches.match('/');
      })
    );
    return;
  }

  // Everything else — network first, cache as fallback
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// ============================================
// CACHE STRATEGIES
// ============================================

// Cache First — Serve from cache, fallback to network
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Offline fallback for navigation
    if (request.mode === 'navigate') {
      return caches.match('/');
    }
    throw error;
  }
}

// Network First — Try network, fallback to cache
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('⚠️ Offline — serving from cache:', request.url);
    const cached = await caches.match(request);
    
    if (cached) {
      return cached;
    }
    
    // If it's a navigation, return the home page
    if (request.mode === 'navigate') {
      return caches.match('/');
    }
    
    throw error;
  }
}

// Cache with Expiry — For map tiles and semi-static content
async function cacheWithExpiry(request, cacheName, maxAgeDays) {
  const cached = await caches.match(request);
  
  if (cached) {
    // Check age
    const cachedDate = new Date(cached.headers.get('sw-cached-date') || 0);
    const now = new Date();
    const ageInDays = (now - cachedDate) / (1000 * 60 * 60 * 24);
    
    if (ageInDays < maxAgeDays) {
      return cached;
    }
  }
  
  // Cache expired or not found — fetch fresh
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      // Add cache date header
      const clonedResponse = response.clone();
      const headers = new Headers(clonedResponse.headers);
      headers.set('sw-cached-date', new Date().toISOString());
      
      const responseWithDate = new Response(clonedResponse.body, {
        status: clonedResponse.status,
        statusText: clonedResponse.statusText,
        headers: headers
      });
      
      const cache = await caches.open(cacheName);
      cache.put(request, responseWithDate);
    }
    return response;
  } catch (error) {
    // Return expired cache if available, even if expired
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// ============================================
// PUSH NOTIFICATIONS (Ready for future)
// ============================================
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Something new on Akrada',
      icon: '/logo.png',
      badge: '/logo.png',
      data: {
        url: data.url || '/'
      },
      vibrate: [200, 100, 200],
      tag: data.tag || 'akrada-general',
      requireInteraction: data.requireInteraction || false
    };
    
    event.waitUntil(
      self.registration.showNotification(
        data.title || 'Akrada',
        options
      )
    );
  } catch (e) {
    console.log('Push notification error:', e);
  }
});

// Notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ============================================
// BACKGROUND SYNC (Ready for future)
// ============================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncPendingReports());
  }
  if (event.tag === 'sync-streaks') {
    event.waitUntil(syncPendingStreaks());
  }
});

async function syncPendingReports() {
  // Placeholder for offline report syncing
  console.log('🔄 Syncing pending reports...');
}

async function syncPendingStreaks() {
  // Placeholder for offline streak syncing
  console.log('🔄 Syncing streaks...');
}

// ============================================
// MESSAGE HANDLER
// ============================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      console.log('🗑️ All caches cleared');
    });
  }
});

console.log('🟢 Akrada Service Worker ready');
