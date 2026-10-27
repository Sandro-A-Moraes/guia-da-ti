import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { render, routes, pageInfo, preloadRoadmap } from '../dist/server/entry-server.js';
const template = await readFile('dist/index.html', 'utf8');
const origin = new URL(process.env.SITE_URL || 'https://guiadati.com').origin;
const escape = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
for (const path of [...routes, '/empresas', '/admin/anuncios', '/404']) {
  await preloadRoadmap(path);
  const page = pageInfo(path), title = escape(`${page.title} | Guia da TI`), description = escape(page.description), url = escape(origin + path);
  const seo = `<meta name="description" content="${description}"><link rel="canonical" href="${url}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${url}"><meta property="og:type" content="website">${path === '/404' ? '<meta name="robots" content="noindex">' : ''}`;
  const html = template.replace('<title>Guia da TI</title>', `<title>${title}</title>`).replace('<!--seo-->', seo + (['/empresas', '/admin/anuncios'].includes(path) ? '<meta name="robots" content="noindex, nofollow">' : '')).replace('<!--app-->', () => render(path));
  const target = resolve('dist', path === '/' ? 'index.html' : `${path.slice(1)}/index.html`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(path => `<url><loc>${escape(origin + path)}</loc></url>`).join('')}</urlset>`);
await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
console.log(`${routes.length} páginas pré-renderizadas.`);
