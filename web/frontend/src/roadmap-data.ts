import { pageInfo, type RoadmapLevel } from './catalog';

export type RoadmapImportance = 'essential' | 'recommended' | 'optional';
export type RoadmapResourceRef = { type: string; slug: string };
export type RoadmapLink = { title: string; url: string };
export type RoadmapSubstep = { id: string; title: string; description?: string; importance: RoadmapImportance; resources?: RoadmapResourceRef[]; links?: RoadmapLink[] };
export type RoadmapStep = RoadmapSubstep & { choice?: string; children?: RoadmapSubstep[] };
export type RoadmapSection = { id: string; title: string; steps: RoadmapStep[] };
export type Roadmap = { level: RoadmapLevel; sections: RoadmapSection[] };

const loaders = import.meta.glob<Roadmap>('./generated/roadmaps/*.json', { import: 'default' });
const loaded = new Map<string, Roadmap>();

// The render is synchronous, so the pre-render and the browser load the tree before rendering.
export const cachedRoadmap = (slug: string) => loaded.get(slug);

export async function loadRoadmap(slug: string) {
  const known = loaded.get(slug);
  if (known) return known;
  const load = loaders[`./generated/roadmaps/${slug}.json`];
  if (!load) throw new Error(`Roadmap sem conteúdo: ${slug}`);
  const roadmap = await load();
  loaded.set(slug, roadmap);
  return roadmap;
}

export async function preloadRoadmap(path: string) {
  const resource = pageInfo(path).resource;
  if (resource?.roadmap) await loadRoadmap(resource.slug);
}
