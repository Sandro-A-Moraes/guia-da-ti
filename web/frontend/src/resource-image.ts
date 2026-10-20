import type { Resource } from './catalog';

const covers = import.meta.glob('./assets/{study,inform,networking,practice,career}/*/*.{webp,png,jpg,jpeg,svg,ico}', {
  eager: true, query: '?url&no-inline', import: 'default',
}) as Record<string, string>;

export function resourceImage(resource: Resource) {
  const key = `/${resource.type}/${resource.slug}`;
  return Object.entries(covers).find(([path]) => path.replace(/\.[^.]+$/, '').endsWith(key))?.[1] || resource.imageUrl;
}
