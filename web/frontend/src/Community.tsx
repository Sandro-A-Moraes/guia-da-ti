import community from './generated/community.json';
import { Button } from '@/components/ui/button';
import { Maintainers } from './Maintainers';
import { ArrowUpRight, Blocks, Box, Building2, Cloud, Code2, Command, Cpu, Database, Hexagon, Layers, Network, Shield } from 'lucide-react';

const silhouettes = [Blocks, Cloud, Hexagon, Cpu, Building2, Command, Database, Layers, Box, Network, Shield, Code2];
// Keep the decorative spaces aligned with the column counts in the container queries.
const spaceBreakpoints = [[20, 0], [32, 352], [44, 472], [45, 592], [55, 712], [65, 832], [75, 952], [85, 1072], [95, 1192]] as const;

export function Community({ area, preview = false, embedded = false }: { area: 'supporters' | 'contributors'; preview?: boolean; embedded?: boolean }) {
  if (area === 'contributors') return <Maintainers compact={preview} />;
  const entries = community.supporters;
  const Heading = preview || embedded ? 'h2' : 'h1';
  // Decorative spaces keep the mosaic balanced without suggesting other partnerships.
  const spaces = Math.max(95, entries.length);
  return <section id="apoiadores" aria-label="Empresas apoiadoras" className="supporters-section space-y-5">
    {!embedded && <header className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-widest text-primary">Parceiros do Guia</p>
      <Heading className={preview ? 'sr-only' : 'text-2xl font-semibold tracking-tight sm:text-3xl'}>Empresas apoiadoras</Heading>
    </header>}
    <div className="supporters-mosaic">
      <div className="supporters-invite rounded-2xl border bg-card">
        <p className="text-sm text-muted-foreground">Empresas que apoiam o Guia.</p>
        <p className="supporters-invite-title font-medium tracking-tight">Mais pessoas descobrindo tecnologia.</p>
        <Button asChild className="mt-auto self-start"><a href="/#contato">Apoie o Guia<ArrowUpRight aria-hidden="true" /></a></Button>
      </div>
      {Array.from({ length: spaces }, (_, index) => {
        const entry = entries[index];
        const Icon = silhouettes[index % silhouettes.length];
        const className = 'supporters-tile';
        const revealAt = spaceBreakpoints.find(([count]) => index < count)?.[1] ?? 1192;
        if (!entry) return <div key={`space-${index}`} className={`${className}${revealAt ? ` supporters-tile-extra supporters-space-${revealAt}` : ''}`} aria-hidden="true"><Icon className="supporters-silhouette" strokeWidth={1.5} /></div>;
        return <a key={entry.url} href={entry.url} target="_blank" rel="noopener noreferrer" aria-label={`Visitar ${entry.name}`} title={entry.name} className={`${className} supporters-partner`}>
          {entry.name === 'HostGator'
            ? <img src="/supporters/hostgator.ico" alt="HostGator" width="48" height="48" loading="lazy" />
            : <span className="px-2 text-center text-xs font-semibold sm:text-sm">{entry.name}</span>}
        </a>;
      })}
    </div>
  </section>;
}
