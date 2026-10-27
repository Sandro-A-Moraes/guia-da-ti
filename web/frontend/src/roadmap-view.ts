import type { RoadmapLevel } from './catalog';

export const roadmapLevels: Record<RoadmapLevel, string> = { beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado' };

// A roadmap not reviewed for this many months shows a warning.
export const ROADMAP_STALE_MONTHS = 12;

export function isRoadmapStale(updatedAt: string, now: Date = new Date()) {
  const limit = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - ROADMAP_STALE_MONTHS, now.getUTCDate());
  return Date.parse(updatedAt + 'T00:00:00Z') < limit;
}

export type StepGroup<Step> = { choice?: string; steps: Step[] };

// Consecutive steps sharing a `choice` are alternatives; every other step stands alone.
export function groupSteps<Step extends { choice?: string }>(steps: Step[]): StepGroup<Step>[] {
  const groups: StepGroup<Step>[] = [];
  for (const step of steps) {
    const last = groups[groups.length - 1];
    if (step.choice !== undefined && last?.choice === step.choice) last.steps.push(step);
    else groups.push({ choice: step.choice, steps: [step] });
  }
  return groups;
}

type Node = { id: string; children?: Node[] };

// Step ids that must be open to show `id`, outermost first. Null when the id is not a step or substep.
export function stepAncestors(sections: { steps: Node[] }[], id: string): string[] | null {
  for (const section of sections) {
    for (const step of section.steps) {
      if (step.id === id) return [];
      if (step.children?.some(child => child.id === id)) return [step.id];
    }
  }
  return null;
}

export function stepIds(sections: { steps: Node[] }[]) {
  return sections.flatMap(section => section.steps.flatMap(step => step.children?.length ? [step.id] : []));
}
