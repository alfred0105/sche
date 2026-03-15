/**
 * @fileoverview Custom service worker for 올라운더 PWA.
 * Handles precaching (via VitePWA injectManifest) and Web Share Target.
 *
 * Web Share Target flow (Android):
 *  1. User shares screenshot/text from bank app → selects "올라운더"
 *  2. Browser sends POST /share-target with image file or text
 *  3. This SW intercepts the POST, stores the payload in Cache API
 *  4. Redirects to /?share=image (or /?share=text)
 *  5. App reads from cache, opens BankImportModal with the data
 */
import { precacheAndRoute } from 'workbox-precaching';

// VitePWA injects the precache manifest here at build time
precacheAndRoute(self.__WB_MANIFEST);

const SHARE_CACHE = 'share-target-v1';
const SHARE_PENDING_KEY = '/share-pending';

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only intercept POST to /share-target
    if (url.pathname !== '/share-target' || event.request.method !== 'POST') return;

    event.respondWith((async () => {
        try {
            const formData = await event.request.formData();

            // Image file (screenshot shared from gallery or bank app)
            const image = formData.get('image');
            // Text (SMS notification or copied text)
            const text = (formData.get('text') || formData.get('data') || '').trim();

            const cache = await caches.open(SHARE_CACHE);

            if (image && image.size > 0) {
                // Store image blob in cache
                await cache.put(
                    SHARE_PENDING_KEY,
                    new Response(image, {
                        headers: {
                            'Content-Type': image.type || 'image/png',
                            'X-Share-Type': 'image',
                        },
                    })
                );
                return Response.redirect('/?share=image', 303);
            }

            if (text) {
                // Store text in cache as JSON
                await cache.put(
                    SHARE_PENDING_KEY,
                    new Response(JSON.stringify({ text }), {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Share-Type': 'text',
                        },
                    })
                );
                return Response.redirect('/?share=text', 303);
            }
        } catch (err) {
            console.error('[SW] share-target error:', err);
        }

        return Response.redirect('/', 303);
    })());
});
