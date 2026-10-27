export type RoadmapOrigin = 'community' | 'external';
export type OriginFilter = RoadmapOrigin | 'all';

export const roadmapOriginLabels: Record<RoadmapOrigin, string> = { community: 'Comunidade do Guia', external: 'Fonte externa' };
const queryValues: Record<RoadmapOrigin, string> = { community: 'comunidade', external: 'externa' };

export const roadmapOrigin = (resource: { roadmap?: unknown }): RoadmapOrigin => resource.roadmap ? 'community' : 'external';

// Any other value in `?origem=` shows every roadmap.
export function readOrigin(search: string): OriginFilter {
  const value = new URLSearchParams(search).get('origem');
  return (Object.keys(queryValues) as RoadmapOrigin[]).find(origin => queryValues[origin] === value) ?? 'all';
}

export const originQueryValue = (origin: OriginFilter) => origin === 'all' ? '' : queryValues[origin];

export function filterByOrigin<T extends { roadmap?: unknown }>(items: T[], origin: OriginFilter) {
  return origin === 'all' ? items : items.filter(item => roadmapOrigin(item) === origin);
}
