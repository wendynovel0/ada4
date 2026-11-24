# Pendiente — PWA de actividades y recordatorios

CRUD de actividades · IndexedDB · Service Worker (offline) · Notifications API · cola de sincronización · tema claro/oscuro · responsivo.

## Publicar en GitHub Pages
1. Crea un repo y sube estos archivos a la raíz (`git init && git add . && git commit -m "PWA" && git push`).
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.
3. Tu URL: `https://TU_USUARIO.github.io/NOMBRE_REPO/` (HTTPS incluido).

## Arquitectura
- `app.js`: IndexedDB (`tasks`, `outbox`). Cada alta/edición/baja se guarda local y se encola en `outbox`; al volver la conexión (`online`, o Background Sync si existe) se envía a `SYNC_URL`. Sin URL, la sincronización es simulada.
- `sw.js`: precaché de la app shell, red‑primero para navegación, stale‑while‑revalidate para estáticos, eventos `sync`, `push` y `notificationclick`.
- Notificaciones: se revisan los recordatorios cada 30 s con la app abierta.
- Ampliación push: genera claves VAPID, guarda la `PushSubscription` en un backend (p. ej. Node + `web-push`) y envía payload `{title, body}`; `sw.js` ya lo muestra.

## Lighthouse
Chrome DevTools → Lighthouse → modo Navigation, Mobile, categorías PWA/Performance/Accessibility/Best Practices/SEO. Guarda el reporte (HTML/JSON) y toma capturas con DevTools → Network → *Offline*.
