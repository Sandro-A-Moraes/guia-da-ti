import { useId, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { categories, labels, resources } from './catalog';
import { matchesResourceSearch } from './resource-search';

const MAX_OPTIONS = 50;
const categoryName = (type: string) => categories.find(category => category.id === type)?.name ?? type;
const key = (ref: { type: string; slug: string }) => `${ref.type}/${ref.slug}`;

export function RoadmapResourcePicker({ value, onChange, max = 8, disabled = false, label = 'Recursos do catálogo' }: {
  value: { type: string; slug: string }[];
  onChange: (next: { type: string; slug: string }[]) => void;
  max?: number;
  disabled?: boolean;
  label?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const full = value.length >= max;
  const chosen = useMemo(() => new Set(value.map(key)), [value]);
  const matches = useMemo(() => {
    if (!open) return [];
    return resources
      .filter(resource => !chosen.has(key(resource)) && matchesResourceSearch(resource, query, labels))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [open, query, chosen]);
  const named = (ref: { type: string; slug: string }) => resources.find(resource => resource.type === ref.type && resource.slug === ref.slug);
  return <div role="group" aria-labelledby={`${id}-label`} className="space-y-2">
    <p id={`${id}-label`} className="text-sm font-medium">{label}</p>
    {value.length > 0 && <ul className="space-y-1">{value.map(ref => {
      const resource = named(ref);
      const name = resource?.name ?? key(ref);
      return <li key={key(ref)} className="flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
        <span className="min-w-0 break-words"><span className="font-medium">{name}</span> <span className="text-xs text-muted-foreground">{categoryName(ref.type)}</span></span>
        <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" disabled={disabled} aria-label={`Remover ${name}`} onClick={() => onChange(value.filter(item => key(item) !== key(ref)))}><X aria-hidden="true" className="size-4" /></Button>
      </li>;
    })}</ul>}
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setQuery(''); }}>
      <PopoverTrigger asChild><Button type="button" variant="outline" size="sm" disabled={disabled || full} aria-expanded={open}><Plus aria-hidden="true" className="size-4" />Adicionar recurso</Button></PopoverTrigger>
      <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false}>
          <CommandInput aria-label="Pesquisar recurso do catálogo" placeholder="Pesquisar por nome ou assunto" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Nenhum recurso encontrado.</CommandEmpty>
            <CommandGroup>{matches.slice(0, MAX_OPTIONS).map(resource => <CommandItem key={key(resource)} value={key(resource)} onSelect={() => { onChange([...value, { type: resource.type, slug: resource.slug }]); setOpen(false); }}>
              <span className="min-w-0 break-words">{resource.name} <span className="text-xs text-muted-foreground">{categoryName(resource.type)}</span></span>
            </CommandItem>)}</CommandGroup>
          </CommandList>
          {matches.length > MAX_OPTIONS && <p className="border-t px-3 py-2 text-xs text-muted-foreground">Mostrando {MAX_OPTIONS} de {matches.length}. Digite para refinar.</p>}
        </Command>
      </PopoverContent>
    </Popover>
    <p className="text-xs text-muted-foreground">{full ? `Limite de ${max} recursos por etapa.` : `${value.length} de ${max} recursos.`}</p>
    <p className="text-xs text-muted-foreground">Não achou o recurso? Sugira-o pelo botão Contribuir. Quando ele entrar no catálogo, adicione aqui.</p>
  </div>;
}
