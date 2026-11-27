// Service worker mínimo: só existe para o app poder ser instalado no celular.
// De propósito NÃO guarda nada em cache: dados do bolão e login sempre vêm da rede.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
