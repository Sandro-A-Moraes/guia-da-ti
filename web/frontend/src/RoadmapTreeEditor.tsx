import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Link2, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SelectField } from './SelectField';
import { RoadmapResourcePicker } from './RoadmapResourcePicker';
import type { RoadmapImportance, RoadmapSection, RoadmapStep, RoadmapSubstep } from './roadmap-data';
import { addSection, addStep, addSubstep, collectIds, countNodes, groupWithNext, moveNode, removeNode, renameSection, treeProblems, ungroup, updateNode, type TreeNodePatch } from './roadmap-tree';

const importanceOptions: { id: RoadmapImportance; name: string }[] = [{ id: 'essential', name: 'Essencial' }, { id: 'recommended', name: 'Recomendado' }, { id: 'optional', name: 'Opcional' }];
const MAX_SUBSTEPS = 12;
const MAX_LINKS = 3;

type Remove = { id: string; title: string; what: string; detail: string };
type Node = RoadmapStep | RoadmapSubstep;
const target = (id: string, action: string) => `[data-node="${id}"][data-action="${action}"]`;

// Position of a section, step or substep inside its own list, to disable the move buttons at the edges.
function position(sections: RoadmapSection[], id: string) {
  const own = sections.findIndex(section => section.id === id);
  if (own >= 0) return { index: own, length: sections.length };
  for (const section of sections) {
    const step = section.steps.findIndex(item => item.id === id);
    if (step >= 0) return { index: step, length: section.steps.length };
    for (const parent of section.steps) {
      const child = parent.children?.findIndex(item => item.id === id) ?? -1;
      if (child >= 0) return { index: child, length: parent.children!.length };
    }
  }
  return { index: 0, length: 1 };
}

export function RoadmapTreeEditor({ sections, onChange, disabled = false }: { sections: RoadmapSection[]; onChange: (next: RoadmapSection[]) => void; disabled?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [removal, setRemoval] = useState<Remove | null>(null);
  const problems = treeProblems(sections);
  const nodes = countNodes(sections);

  const focusSoon = (selector: string) => requestAnimationFrame(() => requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(selector)?.focus()));
  function apply(next: RoadmapSection[], message: string, focus?: string) {
    if (next === sections) return;
    onChange(next);
    setAnnouncement(message);
    if (focus) focusSoon(focus);
  }
  function add(kind: 'section' | 'step' | 'substep', parent: string) {
    const title = (titles[parent] ?? '').trim();
    if (title.length < 2) { setAnnouncement('Escreva um título de pelo menos 2 caracteres.'); focusSoon(`[data-new="${parent}"]`); return; }
    const next = kind === 'section' ? addSection(sections, title) : kind === 'step' ? addStep(sections, parent, title) : addSubstep(sections, parent, title);
    const before = collectIds(sections);
    const id = [...collectIds(next)].find(candidate => !before.has(candidate));
    if (!id) return;
    setTitles(current => ({ ...current, [parent]: '' }));
    setOpen(current => new Set(current).add(id));
    apply(next, `${kind === 'section' ? 'Bloco' : kind === 'step' ? 'Etapa' : 'Subetapa'} “${title}” incluído.`, target(id, 'title'));
  }
  function move(id: string, title: string, direction: -1 | 1) {
    const next = moveNode(sections, id, direction);
    const spot = position(next, id);
    const stays = direction === -1 ? spot.index > 0 : spot.index < spot.length - 1;
    apply(next, `“${title}” foi para ${direction === -1 ? 'cima' : 'baixo'}. Posição ${spot.index + 1} de ${spot.length}.`, target(id, stays ? (direction === -1 ? 'up' : 'down') : direction === -1 ? 'down' : 'up'));
  }
  function remove(item: Remove) {
    setRemoval(null);
    apply(removeNode(sections, item.id), `${item.what} “${item.title}” removido.`, '#roadmap-structure-status');
  }
  function askRemoval(item: Remove, needsConfirmation: boolean) { if (needsConfirmation) setRemoval(item); else remove(item); }
  const patch = (id: string, change: TreeNodePatch) => onChange(updateNode(sections, id, change));

  const addRow = (kind: 'section' | 'step' | 'substep', parent: string, label: string, full = false) => <div className="flex flex-wrap items-end gap-2">
    <Label className="min-w-0 flex-1 basis-48 space-y-1 text-xs font-normal text-muted-foreground">{label}
      <Input data-new={parent} value={titles[parent] ?? ''} maxLength={80} disabled={disabled || full} className="text-sm" onChange={event => setTitles(current => ({ ...current, [parent]: event.target.value }))}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(kind, parent); } }} /></Label>
    <Button type="button" size="sm" variant="outline" disabled={disabled || full} onClick={() => add(kind, parent)}><Plus aria-hidden="true" />Adicionar</Button>
  </div>;

  const moveButtons = (id: string, title: string, what: string) => {
    const { index, length } = position(sections, id);
    return <>
      <Button type="button" size="icon" variant="ghost" className="size-8" data-node={id} data-action="up" disabled={disabled || index === 0} aria-label={`Subir ${what} ${title}`} onClick={() => move(id, title, -1)}><ArrowUp aria-hidden="true" /></Button>
      <Button type="button" size="icon" variant="ghost" className="size-8" data-node={id} data-action="down" disabled={disabled || index === length - 1} aria-label={`Descer ${what} ${title}`} onClick={() => move(id, title, 1)}><ArrowDown aria-hidden="true" /></Button>
    </>;
  };

  function details(node: Node) {
    const links = node.links ?? [];
    const setLinks = (next: { title: string; url: string }[]) => patch(node.id, { links: next.length ? next : undefined });
    return <div className="space-y-4">
      <SelectField label="Importância" name={`importance-${node.id}`} value={node.importance} onChange={value => patch(node.id, { importance: value as RoadmapImportance })} options={importanceOptions} />
      <Label className="block space-y-1 text-sm font-medium">Explicação (opcional)
        <Textarea value={node.description ?? ''} maxLength={400} rows={3} disabled={disabled} className="w-full text-sm font-normal" onChange={event => patch(node.id, { description: event.target.value })} />
        <span className="block text-xs font-normal text-muted-foreground">{(node.description ?? '').length} de 400 caracteres</span></Label>
      <RoadmapResourcePicker label={`Recursos do catálogo: ${node.title}`} value={node.resources ?? []} max={8} disabled={disabled} onChange={resources => patch(node.id, { resources: resources.length ? resources : undefined })} />
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Links de outros sites (opcional)</legend>
        <p className="text-xs text-muted-foreground">Aparecem como “Fora do catálogo”. Prefira recursos que já estão no catálogo. Até {MAX_LINKS} links.</p>
        {links.map((link, index) => <div key={index} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <Label className="space-y-1 text-xs font-normal text-muted-foreground">Título do link<Input value={link.title} required minLength={2} maxLength={80} disabled={disabled} className="text-sm" onChange={event => setLinks(links.map((item, at) => at === index ? { ...item, title: event.target.value } : item))} /></Label>
          <Label className="space-y-1 text-xs font-normal text-muted-foreground">Endereço (https://)<Input type="url" value={link.url} required maxLength={500} pattern="https://.+" placeholder="https://" disabled={disabled} className="text-sm" onChange={event => setLinks(links.map((item, at) => at === index ? { ...item, url: event.target.value } : item))} /></Label>
          <Button type="button" size="icon" variant="ghost" aria-label={`Remover o link ${link.title || index + 1}`} disabled={disabled} onClick={() => setLinks(links.filter((_, at) => at !== index))}><Trash2 aria-hidden="true" /></Button>
        </div>)}
        <Button type="button" size="sm" variant="outline" disabled={disabled || links.length >= MAX_LINKS} onClick={() => setLinks([...links, { title: '', url: '' }])}><Link2 aria-hidden="true" />Adicionar link</Button>
      </fieldset>
    </div>;
  }

  const stepTitle = (node: Node, label: string) => <Input value={node.title} required minLength={2} maxLength={80} disabled={disabled} aria-label={label} data-node={node.id} data-action="title" className="min-w-0 flex-1 basis-40 text-sm"
    onChange={event => patch(node.id, { title: event.target.value })} />;

  function substep(child: RoadmapSubstep, parent: RoadmapStep) {
    const fullTitle = child.title || 'sem título';
    return <li key={child.id} className="space-y-2 rounded-md border bg-background p-2">
      <Collapsible open={open.has(child.id)} onOpenChange={value => setOpen(current => { const next = new Set(current); if (value) next.add(child.id); else next.delete(child.id); return next; })}>
        <div className="flex flex-wrap items-center gap-1">
          <CollapsibleTrigger asChild><Button type="button" size="icon" variant="ghost" className="group size-8" aria-label={`Detalhes da subetapa ${fullTitle}`}><ChevronDown aria-hidden="true" className="transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" /></Button></CollapsibleTrigger>
          {stepTitle(child, `Título da subetapa ${fullTitle}`)}
          {moveButtons(child.id, fullTitle, 'subetapa')}
          <Button type="button" size="icon" variant="ghost" className="size-8" aria-label={`Remover a subetapa ${fullTitle}`} disabled={disabled} onClick={() => remove({ id: child.id, title: fullTitle, what: 'Subetapa', detail: '' })}><Trash2 aria-hidden="true" /></Button>
        </div>
        <CollapsibleContent className="px-2 pb-1 pt-3">{details(child)}</CollapsibleContent>
      </Collapsible>
      <span className="sr-only">Subetapa de {parent.title}</span>
    </li>;
  }

  function step(item: RoadmapStep, section: RoadmapSection) {
    const fullTitle = item.title || 'sem título';
    const index = section.steps.findIndex(candidate => candidate.id === item.id);
    const childCount = item.children?.length ?? 0;
    return <li key={item.id} className="space-y-2 rounded-lg border bg-card p-3">
      <Collapsible open={open.has(item.id)} onOpenChange={value => setOpen(current => { const next = new Set(current); if (value) next.add(item.id); else next.delete(item.id); return next; })}>
        <div className="flex flex-wrap items-center gap-1">
          <CollapsibleTrigger asChild><Button type="button" size="icon" variant="ghost" className="group size-8" aria-label={`Detalhes da etapa ${fullTitle}`}><ChevronDown aria-hidden="true" className="transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" /></Button></CollapsibleTrigger>
          {stepTitle(item, `Título da etapa ${fullTitle}`)}
          {moveButtons(item.id, fullTitle, 'etapa')}
          <Button type="button" size="icon" variant="ghost" className="size-8" aria-label={`Remover a etapa ${fullTitle}`} disabled={disabled}
            onClick={() => askRemoval({ id: item.id, title: fullTitle, what: 'Etapa', detail: `${childCount} ${childCount === 1 ? 'subetapa será removida' : 'subetapas serão removidas'} junto.` }, childCount > 0)}><Trash2 aria-hidden="true" /></Button>
        </div>
        {item.choice !== undefined && <p className="mt-1 flex items-center gap-2 pl-9 text-xs text-muted-foreground"><Badge variant="outline">Alternativa</Badge>Faz parte de um grupo “Escolha uma opção”.</p>}
        <CollapsibleContent className="space-y-4 px-1 pb-1 pt-3">
          <div className="flex flex-wrap gap-2">
            {item.choice !== undefined
              ? <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => apply(ungroup(sections, item.id), `“${fullTitle}” saiu do grupo de alternativas.`, target(item.id, 'title'))}>Tirar do grupo</Button>
              : <Button type="button" size="sm" variant="outline" disabled={disabled || index === section.steps.length - 1} onClick={() => apply(groupWithNext(sections, item.id), `“${fullTitle}” agrupada como alternativa com a próxima etapa.`, target(item.id, 'title'))}>Agrupar como alternativa com a próxima</Button>}
          </div>
          {details(item)}
          <div className="space-y-2"><h4 className="text-sm font-medium">Subetapas ({childCount} de {MAX_SUBSTEPS})</h4>
            {childCount > 0 && <ol className="space-y-2 border-l pl-3">{item.children!.map(child => substep(child, item))}</ol>}
            {addRow('substep', item.id, 'Título da nova subetapa', childCount >= MAX_SUBSTEPS)}</div>
        </CollapsibleContent>
      </Collapsible>
    </li>;
  }

  return <div ref={root} className="space-y-5">
    <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
    <div className="space-y-2 rounded-lg bg-muted/30 p-3 text-sm">
      <p id="roadmap-structure-status" tabIndex={-1} className="font-medium outline-none">{sections.length} de 2 a 20 blocos · {nodes} de 5 a 150 etapas e subetapas</p>
      {problems.length > 0 && <ul aria-label="O que ainda falta" className="list-disc space-y-1 pl-5 text-muted-foreground">{problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
    </div>
    <ol className="space-y-5">
      {sections.map((section, index) => <li key={section.id}><section aria-label={`Bloco ${index + 1}: ${section.title}`} className="space-y-3 rounded-lg border p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1">
          <span aria-hidden="true" className="w-6 text-center text-sm font-medium text-muted-foreground">{index + 1}</span>
          <Input value={section.title} required minLength={2} maxLength={80} disabled={disabled} aria-label={`Título do bloco ${index + 1}`} data-node={section.id} data-action="title" className="min-w-0 flex-1 basis-40 font-medium"
            onChange={event => onChange(renameSection(sections, section.id, event.target.value))} />
          {moveButtons(section.id, section.title || 'sem título', 'bloco')}
          <Button type="button" size="icon" variant="ghost" className="size-8" aria-label={`Remover o bloco ${section.title || 'sem título'}`} disabled={disabled}
            onClick={() => askRemoval({ id: section.id, title: section.title || 'sem título', what: 'Bloco', detail: `${section.steps.length} ${section.steps.length === 1 ? 'etapa será removida' : 'etapas serão removidas'} junto.` }, section.steps.length > 0)}><Trash2 aria-hidden="true" /></Button>
        </div>
        {section.steps.length > 0 && <ol className="space-y-2">{section.steps.map(item => step(item, section))}</ol>}
        {addRow('step', section.id, 'Título da nova etapa')}
      </section></li>)}
    </ol>
    {addRow('section', 'sections', 'Título do novo bloco', sections.length >= 20)}
    <Dialog open={!!removal} onOpenChange={value => { if (!value) setRemoval(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Remover {removal?.what.toLowerCase()}?</DialogTitle><DialogDescription>“{removal?.title}” sai do roadmap. {removal?.detail}</DialogDescription></DialogHeader>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setRemoval(null)}>Cancelar</Button><Button type="button" variant="destructive" onClick={() => removal && remove(removal)}>Remover</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
