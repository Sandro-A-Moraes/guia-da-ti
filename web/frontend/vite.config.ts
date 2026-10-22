import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Keep browser cookies and the registered OAuth callback on the same local host.
function canonicalLocalHost(request: IncomingMessage, response: ServerResponse, next: () => void) {
  const host = request.headers.host;
  if (host && /^127\.0\.0\.1(?::\d+)?$/.test(host)) {
    response.writeHead(302, { Location: `http://${host.replace('127.0.0.1', 'localhost')}${request.url || '/'}` });
    response.end();
    return;
  }
  if (request.url?.split('?')[0].replace(/\/$/, '') === '/sobre') {
    response.writeHead(308, { Location: `/${request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : ''}` });
    response.end();
    return;
  }
  const url = new URL(request.url || '/', 'http://localhost');
  if (url.pathname === '/' && url.searchParams.has('conversa')) {
    response.writeHead(308, { Location: `/forum${url.search}` });
    response.end();
    return;
  }
  next();
}
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), tailwindcss(), {
    name: 'canonical-local-host',
    configureServer(server) { server.middlewares.use(canonicalLocalHost); },
    configurePreviewServer(server) { server.middlewares.use(canonicalLocalHost); },
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: isSsrBuild ? {} : { rollupOptions: { input: {
    main: fileURLToPath(new URL('./index.html', import.meta.url)),
    auth: fileURLToPath(new URL('./auth/complete.html', import.meta.url)),
    guide: fileURLToPath(new URL('./guia-animacoes/index.html', import.meta.url)),
  } } },
  server: { proxy: { '/api': { target: 'http://localhost:5080', changeOrigin: false } } },
  preview: { proxy: { '/api': { target: 'http://localhost:5080', changeOrigin: false } } },
}));
