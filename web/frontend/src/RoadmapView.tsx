import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ChevronDown, CircleDashed, Clock, Star, ThumbsUp, type LucideIcon } from 'lucide-react';
import { categories, resourcePath, resources, type Resource } from './catalog';
import { cachedRoadmap, loadRoadmap, type Roadmap, type RoadmapImportance, type RoadmapStep, type RoadmapSubstep } from './roadmap-data';
import { groupSteps, isRoadmapStale, roadmapLevels, stepAncestors } from './roadmap-view';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const importance: Record<RoadmapImportance, { label: string; hint: string; icon: LucideIcon; className: string }> = {
  essential: { label: 'Essencial', hint: 'Estude antes de seguir.', icon: Star, className: 'border-primary/40 bg-primary/10 text-primary' },
  recommended: { label: 'Recomendado', hint: 'Vale o tempo para quase todo mundo.', icon: ThumbsUp, className: 'border-transparent bg-secondary text-secondary-foreground' },
  optional: { label: 'Opcional', hint: 'Estude se o assunto te interessar.', icon: CircleDashed, className: 'border-dashed border-border text-muted-foreground' },
};

const resourceIndex = new Map(resources.map(resource => [`${resource.type}/${resource.slug}`, resource]));

function ImportanceBadge({ value }: { value: RoadmapImportance }) {
  const { label, icon: Icon, className } = importance[value];
  return <Badge variant="outline" className={className}><Icon aria-hidden="true" />{label}</Badge>;
}

const hasDetails = (step: RoadmapSubstep & { children?: RoadmapSubstep[] }) =>
  !!(step.description || step.resources?.length || step.links?.length || step.children?.length);

function Materials({ node }: { node: RoadmapSubstep }) {
  const linked = (node.resources ?? []).flatMap(ref => resourceIndex.get(`${ref.type}/${ref.slug}`) ?? []);
  if (!linked.length && !node.links?.length) return null;
  return <ul aria-label="Materiais de estudo" className="space-y-2">
    {linked.map(resource => <li key={`${resource.type}/${resource.slug}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <a href={resourcePath(resource)} className="min-w-0 break-words font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{resource.name}</a>
      <span className="text-xs text-muted-foreground">{categories.find(category => category.id === resource.type)?.name ?? resource.type}</span>
    </li>)}
    {node.links?.map(link => <li key={link.url} className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 break-words font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{link.title}<ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" /></a>
      <Badge variant="outline" className="text-muted-foreground">Fora do catálogo</Badge>
    </li>)}
  </ul>;
}

function Substeps({ items }: { items: RoadmapSubstep[] }) {
  return <ol aria-label="Subetapas" className="space-y-3 border-l pl-4">
    {items.map(item => <li key={item.id} id={`etapa-${item.id}`} className="scroll-mt-24 space-y-2">
      <div className="flex flex-wrap items-center gap-2"><p className="min-w-0 break-words font-medium">{item.title}</p><ImportanceBadge value={item.importance} /></div>
      {item.description && <p className="break-words text-muted-foreground">{item.description}</p>}
      <Materials node={item} />
    </li>)}
  </ol>;
}

function Step({ step, open, onOpenChange }: { step: RoadmapStep; open: boolean; onOpenChange: (open: boolean) => void }) {
  const title = <span className="min-w-0 flex-1 break-words font-medium">{step.title}</span>;
  if (!hasDetails(step)) return <li id={`etapa-${step.id}`} className="scroll-mt-24 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-3"><span className="size-4 shrink-0" aria-hidden="true" />{title}<ImportanceBadge value={step.importance} /></li>;
  return <li id={`etapa-${step.id}`} className="scroll-mt-24 rounded-lg border bg-card">
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="group flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-ring">
        <ChevronDown aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
        {title}
        <ImportanceBadge value={step.importance} />
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="space-y-3 border-t px-4 py-3 text-sm data-[state=closed]:hidden">
        {step.description && <p className="break-words text-muted-foreground">{step.description}</p>}
        <Materials node={step} />
        {!!step.children?.length && <Substeps items={step.children} />}
      </CollapsibleContent>
    </Collapsible>
  </li>;
}

function RoadmapTree({ roadmap, resource }: { roadmap: Roadmap; resource: Resource }) {
  const expandable = useMemo(() => roadmap.sections.flatMap(section => section.steps.filter(hasDetails).map(step => step.id)), [roadmap]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [stale, setStale] = useState(false);
  useEffect(() => setStale(isRoadmapStale(resource.updatedAt)), [resource.updatedAt]);
  const toggle = useCallback((id: string, value: boolean) => setOpen(current => {
    const next = new Set(current);
    if (value) next.add(id); else next.delete(id);
    return next;
  }), []);
  // Opens the steps that hide the target of a #etapa-<id> link, then scrolls to it.
  useEffect(() => {
    const reveal = () => {
      const match = /^#etapa-([a-z0-9-]+)$/.exec(window.location.hash);
      const ancestors = match && stepAncestors(roadmap.sections, match[1]);
      if (!match || !ancestors) return;
      const target = roadmap.sections.flatMap(section => section.steps).find(step => step.id === match[1]);
      setOpen(current => new Set([...current, ...ancestors, ...(target && hasDetails(target) ? [target.id] : [])]));
      requestAnimationFrame(() => document.getElementById(`etapa-${match[1]}`)?.scrollIntoView({ block: 'start' }));
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, [roadmap]);
  const allOpen = expandable.length > 0 && expandable.every(id => open.has(id));
  const summary = resource.roadmap;
  return <div className="space-y-6">
    {stale && <Alert role="status"><Clock aria-hidden="true" /><AlertTitle>Este roadmap pode estar desatualizado</AlertTitle><AlertDescription>A última revisão foi em {resource.updatedAt.split('-').reverse().join('/')}. Confira os materiais antes de seguir.</AlertDescription></Alert>}
    <div className="space-y-4 rounded-lg bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{summary && <>Nível: <strong className="font-medium text-foreground">{roadmapLevels[summary.level]}</strong> · {summary.sectionCount} blocos · {summary.stepCount} etapas</>}</p>
        {expandable.length > 0 && <Button type="button" variant="outline" size="sm" onClick={() => setOpen(allOpen ? new Set() : new Set(expandable))}>{allOpen ? 'Recolher tudo' : 'Expandir tudo'}</Button>}
      </div>
      <ul aria-label="Legenda da importância" className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        {(Object.keys(importance) as RoadmapImportance[]).map(key => <li key={key} className="flex flex-wrap items-center gap-2"><ImportanceBadge value={key} />{importance[key].hint}</li>)}
      </ul>
    </div>
    <div className="space-y-8">
      {roadmap.sections.map((section, index) => <section key={section.id} aria-labelledby={`bloco-${section.id}`} className="space-y-3">
        <h2 id={`bloco-${section.id}`} className="flex items-baseline gap-3 text-xl font-semibold tracking-tight"><span aria-hidden="true" className="text-muted-foreground">{index + 1}</span><span className="min-w-0 break-words">{section.title}</span></h2>
        <ol className="space-y-2">
          {groupSteps(section.steps).map(group => {
            const steps = group.steps.map(step => <Step key={step.id} step={step} open={open.has(step.id)} onOpenChange={value => toggle(step.id, value)} />);
            return group.choice && group.steps.length > 1
              ? <li key={group.steps[0].id}><div role="group" aria-label="Escolha uma opção" className="space-y-2 rounded-lg border border-dashed p-2"><p className="px-1 text-xs font-medium text-muted-foreground">Escolha uma opção</p><ol className="space-y-2">{steps}</ol></div></li>
              : steps;
          })}
        </ol>
      </section>)}
    </div>
  </div>;
}

export function RoadmapView({ resource }: { resource: Resource }) {
  const [roadmap, setRoadmap] = useState<Roadmap | undefined>(() => cachedRoadmap(resource.slug));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (roadmap) return;
    let active = true;
    setFailed(false);
    loadRoadmap(resource.slug).then(value => { if (active) setRoadmap(value); }, () => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [resource.slug, roadmap, attempt]);
  if (roadmap) return <RoadmapTree roadmap={roadmap} resource={resource} />;
  return failed
    ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive"><p>Não foi possível carregar as etapas.</p><Button type="button" size="sm" variant="outline" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Button></div>
    : <p role="status" className="text-sm text-muted-foreground">Carregando etapas…</p>;
}
