export type ContributionRequest = { category: string; roadmap?: string };

// `roadmap` opens the editor on an existing community roadmap. The event keeps accepting a plain category string.
export function openContribution(category = '', options?: { roadmap?: string }) {
  const detail: ContributionRequest = { category, ...(options?.roadmap ? { roadmap: options.roadmap } : {}) };
  window.dispatchEvent(new CustomEvent<ContributionRequest>('guia:contribute', { detail }));
}
