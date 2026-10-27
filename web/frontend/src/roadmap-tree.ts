import type { RoadmapImportance, RoadmapSection, RoadmapStep, RoadmapSubstep } from './roadmap-data';

// Pure, immutable operations on the roadmap draft tree. They return the same array when nothing changes.
export type TreeNodePatch = {
  title?: string;
  description?: string | undefined;
  importance?: RoadmapImportance;
  resources?: { type: string; slug: string }[] | undefined;
  links?: { title: string; url: string }[] | undefined;
};

const MAX_ID_LENGTH = 40;
const MAX_SUBSTEPS = 12;
const MIN_NODES = 5;
const MAX_NODES = 150;

const kebab = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Unique kebab-case id (at most 40 characters) built from a title, never in `taken`.
export const newId = (title: string, taken: ReadonlySet<string>): string => {
  const base = kebab(title).slice(0, MAX_ID_LENGTH).replace(/-+$/, '') || 'etapa';
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const id = base.slice(0, MAX_ID_LENGTH - suffix.length).replace(/-+$/, '') + suffix;
    if (!taken.has(id)) return id;
  }
};

export const collectIds = (sections: RoadmapSection[]): Set<string> => {
  const ids = new Set<string>();
  for (const section of sections) {
    ids.add(section.id);
    for (const step of section.steps) {
      ids.add(step.id);
      for (const child of step.children ?? []) ids.add(child.id);
    }
  }
  return ids;
};

// Steps plus substeps, as the catalog rule counts them.
export const countNodes = (sections: RoadmapSection[]): number =>
  sections.reduce((total, section) => total + section.steps.reduce((sum, step) => sum + 1 + (step.children?.length ?? 0), 0), 0);

const withoutKey = <T extends object>(node: T, key: string): T => {
  const next = { ...node } as Record<string, unknown>;
  delete next[key];
  return next as T;
};

const replaceAt = <T>(list: T[], index: number, item: T) => list.map((current, position) => (position === index ? item : current));

// Fixes the "choose one" groups of a section: a repeated choice in a separate run gets its own name,
// and a run shorter than two steps loses its choice.
function normalizeChoices(steps: RoadmapStep[]): RoadmapStep[] {
  const taken = new Set(steps.flatMap(step => (step.choice === undefined ? [] : [step.choice])));
  const seen = new Set<string>();
  const names: (string | undefined)[] = [];
  let index = 0;
  while (index < steps.length) {
    const choice = steps[index].choice;
    let end = index;
    while (choice !== undefined && end + 1 < steps.length && steps[end + 1].choice === choice) end++;
    let name = choice;
    if (choice !== undefined && seen.has(choice)) {
      name = newId('escolha', taken);
      taken.add(name);
    }
    if (name !== undefined) seen.add(name);
    const keep = name !== undefined && end - index + 1 >= 2 ? name : undefined;
    for (let i = index; i <= end; i++) names.push(keep);
    index = end + 1;
  }
  let changed = false;
  const next = steps.map((step, position) => {
    if (step.choice === names[position]) return step;
    changed = true;
    return names[position] === undefined ? withoutKey(step, 'choice') : { ...step, choice: names[position] };
  });
  return changed ? next : steps;
}

function editSection(sections: RoadmapSection[], sectionId: string, edit: (section: RoadmapSection) => RoadmapSection): RoadmapSection[] {
  const index = sections.findIndex(section => section.id === sectionId);
  if (index < 0) return sections;
  const next = edit(sections[index]);
  return next === sections[index] ? sections : replaceAt(sections, index, next);
}

export const addSection = (sections: RoadmapSection[], title: string): RoadmapSection[] =>
  [...sections, { id: newId(title, collectIds(sections)), title, steps: [] }];

export const addStep = (sections: RoadmapSection[], sectionId: string, title: string): RoadmapSection[] => {
  const id = newId(title, collectIds(sections));
  return editSection(sections, sectionId, section => ({ ...section, steps: [...section.steps, { id, title, importance: 'recommended' }] }));
};

// Substeps live one level below a step; a substep cannot have children.
export const addSubstep = (sections: RoadmapSection[], stepId: string, title: string): RoadmapSection[] => {
  const id = newId(title, collectIds(sections));
  const section = sections.find(candidate => candidate.steps.some(step => step.id === stepId));
  const step = section?.steps.find(candidate => candidate.id === stepId);
  if (!section || !step || (step.children?.length ?? 0) >= MAX_SUBSTEPS) return sections;
  const child: RoadmapSubstep = { id, title, importance: 'recommended' };
  return editSection(sections, section.id, current => ({
    ...current,
    steps: current.steps.map(candidate => (candidate.id === stepId ? { ...candidate, children: [...(candidate.children ?? []), child] } : candidate)),
  }));
};

export const renameSection = (sections: RoadmapSection[], sectionId: string, title: string): RoadmapSection[] =>
  editSection(sections, sectionId, section => ({ ...section, title }));

function patchNode<T extends RoadmapSubstep>(node: T, patch: TreeNodePatch): T {
  const next = { ...node } as Record<string, unknown>;
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.importance !== undefined) next.importance = patch.importance;
  if ('description' in patch) {
    if (patch.description === undefined || patch.description.trim() === '') delete next.description;
    else next.description = patch.description;
  }
  for (const key of ['resources', 'links'] as const) {
    if (!(key in patch)) continue;
    const list = patch[key];
    if (!list || list.length === 0) delete next[key];
    else next[key] = list;
  }
  return next as T;
}

// Updates a step or substep by id. Ids never change.
export const updateNode = (sections: RoadmapSection[], id: string, patch: TreeNodePatch): RoadmapSection[] => {
  let found = false;
  const next = sections.map(section => ({
    ...section,
    steps: section.steps.map(step => {
      if (step.id === id) { found = true; return patchNode(step, patch); }
      if (!step.children?.some(child => child.id === id)) return step;
      found = true;
      return { ...step, children: step.children.map(child => (child.id === id ? patchNode(child, patch) : child)) };
    }),
  }));
  return found ? next : sections;
};

// Removes a section, step or substep. Alternatives left alone in a group lose their `choice`.
export const removeNode = (sections: RoadmapSection[], id: string): RoadmapSection[] => {
  if (sections.some(section => section.id === id)) return sections.filter(section => section.id !== id);
  const section = sections.find(candidate => candidate.steps.some(step => step.id === id || step.children?.some(child => child.id === id)));
  if (!section) return sections;
  return editSection(sections, section.id, current => {
    const steps = current.steps
      .filter(step => step.id !== id)
      .map(step => {
        if (!step.children?.some(child => child.id === id)) return step;
        const children = step.children.filter(child => child.id !== id);
        return children.length ? { ...step, children } : withoutKey(step, 'children');
      });
    return { ...current, steps: normalizeChoices(steps) };
  });
};

const swapped = <T>(list: T[], index: number, direction: -1 | 1) => {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

// Start and end of the run of steps that share a choice with the step at `index`.
function runAround(steps: RoadmapStep[], index: number): [number, number] {
  const choice = steps[index].choice;
  if (choice === undefined) return [index, index];
  let start = index;
  let end = index;
  while (start > 0 && steps[start - 1].choice === choice) start--;
  while (end + 1 < steps.length && steps[end + 1].choice === choice) end++;
  return [start, end];
}

// A step jumps over a whole neighbouring group, so it never lands inside a "choose one" group by accident.
function moveStep(steps: RoadmapStep[], index: number, direction: -1 | 1): RoadmapStep[] {
  const neighbour = index + direction;
  if (neighbour < 0 || neighbour >= steps.length) return steps;
  const step = steps[index];
  const sameGroup = step.choice !== undefined && steps[neighbour].choice === step.choice;
  const [start, end] = sameGroup ? [neighbour, neighbour] : runAround(steps, neighbour);
  const rest = steps.filter((_, position) => position !== index);
  const moved = sameGroup || step.choice === undefined ? step : withoutKey(step, 'choice');
  rest.splice(direction === 1 ? end : start, 0, moved);
  return normalizeChoices(rest);
}

// Moves a section, step or substep one position up (-1) or down (+1) inside its own list.
export const moveNode = (sections: RoadmapSection[], id: string, direction: -1 | 1): RoadmapSection[] => {
  const sectionIndex = sections.findIndex(section => section.id === id);
  if (sectionIndex >= 0) return swapped(sections, sectionIndex, direction);
  const section = sections.find(candidate => candidate.steps.some(step => step.id === id || step.children?.some(child => child.id === id)));
  if (!section) return sections;
  return editSection(sections, section.id, current => {
    const stepIndex = current.steps.findIndex(step => step.id === id);
    if (stepIndex >= 0) {
      const steps = moveStep(current.steps, stepIndex, direction);
      return steps === current.steps ? current : { ...current, steps };
    }
    const parent = current.steps.find(step => step.children?.some(child => child.id === id))!;
    const children = swapped(parent.children!, parent.children!.findIndex(child => child.id === id), direction);
    return children === parent.children ? current : { ...current, steps: current.steps.map(step => (step === parent ? { ...step, children } : step)) };
  });
};

// Puts a step in the same "choose one" group as the next step.
export const groupWithNext = (sections: RoadmapSection[], stepId: string): RoadmapSection[] => {
  const section = sections.find(candidate => candidate.steps.some(step => step.id === stepId));
  if (!section) return sections;
  const index = section.steps.findIndex(step => step.id === stepId);
  const step = section.steps[index];
  const next = section.steps[index + 1];
  if (!next || (step.choice !== undefined && step.choice === next.choice)) return sections;
  const taken = new Set(section.steps.flatMap(item => (item.choice === undefined ? [] : [item.choice])));
  const choice = step.choice ?? next.choice ?? newId('escolha', taken);
  const merged = next.choice;
  return editSection(sections, section.id, current => ({
    ...current,
    steps: current.steps.map((item, position) => {
      const joins = position === index || position === index + 1 || (merged !== undefined && item.choice === merged);
      return joins && item.choice !== choice ? { ...item, choice } : item;
    }),
  }));
};

// Takes a step out of its "choose one" group. A group left with one step is dissolved.
export const ungroup = (sections: RoadmapSection[], stepId: string): RoadmapSection[] => {
  const section = sections.find(candidate => candidate.steps.some(step => step.id === stepId));
  if (!section || section.steps.find(step => step.id === stepId)!.choice === undefined) return sections;
  return editSection(sections, section.id, current => ({
    ...current,
    steps: normalizeChoices(current.steps.map(step => (step.id === stepId ? withoutKey(step, 'choice') : step))),
  }));
};

// Friendly messages for what still blocks sending (counts, empty sections, choice groups). Empty when valid.
export const treeProblems = (sections: RoadmapSection[]): string[] => {
  const problems = new Set<string>();
  const badTitle = (title: string) => title.trim().length < 2 || title.trim().length > 80;
  if (sections.length < 2) problems.add('Inclua pelo menos 2 blocos.');
  if (sections.length > 20) problems.add('Use no máximo 20 blocos.');
  const nodes = countNodes(sections);
  if (nodes < MIN_NODES) problems.add(`Inclua pelo menos ${MIN_NODES} etapas ou subetapas. Hoje há ${nodes}.`);
  if (nodes > MAX_NODES) problems.add(`Use no máximo ${MAX_NODES} etapas e subetapas no total.`);
  for (const section of sections) {
    if (badTitle(section.title)) problems.add('Dê a cada bloco um título de 2 a 80 caracteres.');
    if (section.steps.length === 0) problems.add(`O bloco “${section.title.trim() || 'sem título'}” precisa de pelo menos uma etapa.`);
    const closed = new Set<string>();
    let run: string | undefined;
    let length = 0;
    const finish = () => { if (run !== undefined && length < 2) problems.add(`A escolha “${run}” precisa de pelo menos duas etapas vizinhas.`); };
    for (const step of section.steps) {
      const nodesOfStep: RoadmapSubstep[] = [step, ...(step.children ?? [])];
      if (nodesOfStep.some(node => badTitle(node.title))) problems.add('Dê a cada etapa e subetapa um título de 2 a 80 caracteres.');
      if (nodesOfStep.some(node => (node.description?.trim().length ?? 0) > 400)) problems.add('A explicação de cada etapa aceita até 400 caracteres.');
      if (nodesOfStep.some(node => (node.resources?.length ?? 0) > 8 || (node.links?.length ?? 0) > 3)) problems.add('Cada etapa aceita até 8 recursos e 3 links externos.');
      if ((step.children?.length ?? 0) > MAX_SUBSTEPS) problems.add(`A etapa “${step.title.trim() || 'sem título'}” aceita até ${MAX_SUBSTEPS} subetapas.`);
      if (step.choice === run) { length++; continue; }
      finish();
      if (step.choice !== undefined && closed.has(step.choice)) problems.add(`As etapas da escolha “${step.choice}” precisam ficar juntas.`);
      if (run !== undefined) closed.add(run);
      run = step.choice;
      length = 1;
    }
    finish();
  }
  return [...problems];
};
