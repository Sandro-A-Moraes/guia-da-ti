import {openContribution} from './contribution-actions';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { Tooltip } from 'radix-ui';

import { Button } from '@/components/ui/button';

import { Skeleton } from '@/components/ui/skeleton';

import { LoadingImage } from './LoadingImage';

import { ArrowUpRight, Github } from 'lucide-react';



type Maintainer = { name: string; url: string; avatarUrl: string; contributions: number };

const MaintainersContext = createContext<{ people: Maintainer[] | null; error: boolean; retry: () => void }>({ people: null, error: false, retry: () => {} });



export function MaintainersProvider({ children }: { children: ReactNode }) {

  const [people, setPeople] = useState<Maintainer[] | null>(null);

  const [error, setError] = useState(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {

    const controller = new AbortController();

    setError(false);

    fetch('/api/contributors', { signal: controller.signal }).then(async response => {

      if (!response.ok) throw Error();

      const data = await response.json();

      if (!Array.isArray(data.items)) throw Error();

      return data.items as Maintainer[];

    }).then(items => { if (!controller.signal.aborted) setPeople(items); }).catch(() => { if (!controller.signal.aborted) setError(true); });

    return () => controller.abort();

  }, [attempt]);

  return <MaintainersContext.Provider value={{ people, error, retry: () => setAttempt(value => value + 1) }}>{children}</MaintainersContext.Provider>;

}



export function Maintainers({ compact = false, embedded = false }: { compact?: boolean; embedded?: boolean }) {
  const { people, error, retry } = useContext(MaintainersContext);
  const listRef = useRef<HTMLUListElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [homeLimit, setHomeLimit] = useState(8);

  useEffect(() => {
    if (!embedded || !people || !listRef.current) return;
    const list = listRef.current;
    const updateLimit = () => {
      const width = list.clientWidth;
      const labelWidth = measureRef.current?.getBoundingClientRect().width ?? 0;
      const columns = Math.max(1, Math.floor((width + 12) / 56));
      const labelSlots = Math.ceil((labelWidth + 12) / 56);
      setHomeLimit(Math.max(0, Math.min(people.length, columns * 2 - labelSlots)));
    };
    const observer = new ResizeObserver(updateLimit);
    observer.observe(list);
    updateLimit();
    return () => observer.disconnect();
  }, [embedded, people]);
  const shown = compact ? people?.slice(0, 8) : embedded ? people?.slice(0, homeLimit) : people;
  const remaining = embedded && people ? Math.max(0, people.length - homeLimit) : 0;

  return <section id={compact ? undefined : 'contribuidores'} aria-label="Contribuidores" className={compact ? 'flex max-w-full items-center justify-center gap-2' : 'space-y-5'}>
    {compact ? <h2 className="sr-only">Contribuidores</h2> : !embedded && <header className="space-y-2"><h3 className="text-xl font-semibold tracking-tight">Contribuidores</h3><p className="text-sm text-muted-foreground">Pessoas que contribuem com os repositórios públicos do Guia.</p></header>}
    {error ? <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><p>Não foi possível carregar os contribuidores.</p><Button variant="link" size="inline" onClick={retry}>Tentar novamente</Button></div>
      : people === null ? <div role="status" aria-label="Carregando contribuidores" className="flex flex-wrap gap-3">{Array.from({ length: compact ? 4 : 7 }, (_, index) => <Skeleton key={index} className={compact ? 'size-8 rounded-full' : 'size-11 rounded-full'} />)}</div>
      : people.length === 0 ? <p className="text-sm text-muted-foreground">Os contribuidores serão apresentados aqui.</p>
      : <Tooltip.Provider delayDuration={250}><ul ref={listRef} className={`flex flex-wrap items-center gap-3 ${compact ? 'justify-center' : 'justify-start'}`}>
        {shown?.map(person => <li key={person.url}><Tooltip.Root><Tooltip.Trigger asChild>
          <a href={person.url} target="_blank" rel="noopener noreferrer" aria-label={`Perfil de ${person.name} no GitHub`} className={`block shrink-0 overflow-hidden rounded-full border border-border/70 bg-muted ring-2 ring-background outline-offset-4 transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transform-none ${compact ? 'size-8' : 'size-11'}`}>
            <LoadingImage src={person.avatarUrl} alt={person.name} width={44} height={44} referrerPolicy="no-referrer" className="size-full rounded-full" imageClassName="rounded-full object-cover" />
          </a>
        </Tooltip.Trigger><Tooltip.Portal><Tooltip.Content side="top" sideOffset={10} collisionPadding={12} className="z-[100] w-72 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3"><span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Github aria-hidden="true" className="size-4" />GitHub</span><ArrowUpRight aria-hidden="true" className="size-4 text-muted-foreground" /></div>
          <div className="flex items-center gap-3 p-4"><LoadingImage src={person.avatarUrl} alt="" width={48} height={48} referrerPolicy="no-referrer" className="size-12 shrink-0 rounded-full bg-muted" imageClassName="rounded-full object-cover" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{person.name}</p><p className="truncate text-xs text-muted-foreground">@{person.name}</p></div></div>
          <div className="border-t px-4 py-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">{person.contributions.toLocaleString('pt-BR')}</strong> {person.contributions === 1 ? 'contribuição' : 'contribuições'} nos repositórios do Guia</p><p className="mt-2 text-xs font-medium text-primary">Abrir perfil no GitHub ↗</p></div>
          <Tooltip.Arrow className="fill-popover" />
        </Tooltip.Content></Tooltip.Portal></Tooltip.Root></li>)}
        {remaining > 0 && <li className="max-w-full text-sm leading-5 text-muted-foreground">e mais {remaining === 1 ? '1 pessoa' : `${remaining} pessoas`}...</li>}
      </ul>{embedded && people && people.length > 0 && <span ref={measureRef} aria-hidden="true" className="pointer-events-none absolute -z-10 whitespace-nowrap text-sm leading-5 text-muted-foreground">e mais {people.length} pessoas...</span>}</Tooltip.Provider>}
    {!compact && !embedded && <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-sm text-muted-foreground">O GitHub reúne aqui quem contribui com os repositórios públicos do Guia.</p><Button variant="outline" onClick={() => openContribution()}>Quero contribuir</Button></div>}
  </section>;
}
