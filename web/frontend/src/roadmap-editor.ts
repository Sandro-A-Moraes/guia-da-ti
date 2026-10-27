import type { RoadmapLevel } from './catalog';
import type { RoadmapSection } from './roadmap-data';

export type RoadmapForm = {
  name: string; summary: string; description: string; area: string; level: RoadmapLevel | '';
  technologies: string[]; languages: string[]; imageUrl: string; sections: RoadmapSection[];
};

export const emptyForm = (): RoadmapForm => ({ name: '', summary: '', description: '', area: '', level: '', technologies: [], languages: ['pt-BR'], imageUrl: '', sections: [] });

// Same slug rule as the backend, so the address shown while typing is the one the PR will use.
export const roadmapSlug = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

type SourceResource = { name: string; summary: string; description: string; areas: string[]; technologies: string[]; languages: string[]; imageUrl?: string; roadmap: { level: RoadmapLevel; sections: RoadmapSection[] } };

// Fills the form from the roadmap file that GET /api/roadmaps/{slug}/source returns.
export const formFromSource = (resource: SourceResource): RoadmapForm => ({
  name: resource.name, summary: resource.summary, description: resource.description, area: resource.areas[0] ?? '', level: resource.roadmap.level,
  technologies: [...resource.technologies], languages: [...resource.languages], imageUrl: resource.imageUrl ?? '', sections: resource.roadmap.sections,
});

// Body of POST /api/roadmaps/proposals (RoadmapDraft in the backend).
export function toProposal(form: RoadmapForm, extra: { slug?: string; baseSha?: string; imageUploadId?: string } = {}) {
  const imageUrl = form.imageUrl.trim();
  return {
    ...(extra.slug ? { slug: extra.slug } : {}), ...(extra.baseSha ? { baseSha: extra.baseSha } : {}),
    name: form.name.trim(), summary: form.summary.trim(), description: form.description.trim(),
    areas: form.area ? [form.area] : [], technologies: form.technologies, languages: form.languages,
    roadmap: { level: form.level, sections: form.sections },
    ...(extra.imageUploadId ? { imageUploadId: extra.imageUploadId } : imageUrl ? { imageUrl } : {}),
  };
}

export const isEditConflict = (message: unknown) => typeof message === 'string' && /mudou desde que você abriu/i.test(message);

// Plain-text copy of what the person typed, shown when a stale edit is refused.
export function outlineText(form: RoadmapForm) {
  const lines = [form.name, form.summary, form.description, ''];
  for (const section of form.sections) {
    lines.push(section.title);
    for (const step of section.steps) {
      lines.push(`  - ${step.title}${step.description ? `: ${step.description}` : ''}`);
      for (const child of step.children ?? []) lines.push(`      - ${child.title}${child.description ? `: ${child.description}` : ''}`);
    }
  }
  return lines.join('\n');
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Draft = { baseSha?: string; form: RoadmapForm };
export const draftKey = (slug?: string) => `guia:roadmap-draft:v1:${slug ?? 'novo'}`;
const browserStore = (): Store | undefined => { try { return window.localStorage; } catch { return undefined; } };

export function readDraft(slug: string | undefined, store: Store | undefined = browserStore()): Draft | null {
  try {
    const value = JSON.parse(store?.getItem(draftKey(slug)) ?? 'null');
    return value && typeof value === 'object' && value.form && Array.isArray(value.form.sections) && typeof value.form.name === 'string' ? value : null;
  } catch { return null; }
}

export function writeDraft(slug: string | undefined, draft: Draft, store: Store | undefined = browserStore()) {
  try { store?.setItem(draftKey(slug), JSON.stringify(draft)); } catch { /* Storage can be full or blocked. The editor still works. */ }
}

export function clearDraft(slug: string | undefined, store: Store | undefined = browserStore()) {
  try { store?.removeItem(draftKey(slug)); } catch { /* Nothing to clear. */ }
}
