type SearchableResource = {
  name: string;
  slug: string;
  summary: string;
  description: string;
  url?: string;
  areas: string[];
  technologies: string[];
  languages: string[];
  countries?: string[];
  creatorCategories?: string[];
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function readSearch(search: string) {
  return (new URLSearchParams(search).get('q') || '').slice(0, 200);
}

export function matchesResourceSearch(resource: SearchableResource, query: string, labels: Record<string, string> = {}) {
  const terms = normalize(query).trim().split(/\s+/).map(term => term.replace(/^@/, '')).filter(Boolean);
  const tags = [...resource.areas, ...resource.technologies, ...resource.languages, ...(resource.countries || []), ...(resource.creatorCategories || [])];
  const text = normalize([resource.name, resource.slug, resource.summary, resource.description, resource.url ?? '', ...tags, ...tags.map(tag => labels[tag] || tag)].join(' '));
  return terms.every(term => text.includes(term));
}
