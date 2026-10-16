import { useState } from 'react';
import { Globe2, MapPin, RotateCcw } from 'lucide-react';
import { WorldMap } from './WorldMap';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import map from './data/brazil-states.json';
import { brazilRegions, toggleStates, type LocationSelection } from './community-location';

export function CommunityLocationFilter({ value, onChange }: { value: LocationSelection; onChange: (next: LocationSelection) => void }) {
  const [mode, setMode] = useState<'states' | 'regions'>('states');
  const [hovered, setHovered] = useState('');
  function select(uf: string, region: string) {
    onChange(toggleStates(value, mode === 'regions' ? brazilRegions.find(item => item.id === region)!.states : [uf]));
  }
  const selected = value.scope === 'regional' ? value.states : [];
  return <section aria-label="Filtrar comunidades por localização" className="rounded-lg border bg-card p-3 sm:p-4">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Localização</h2><p className="mt-1 text-sm text-muted-foreground">Selecione estados ou regiões no mapa, o Brasil inteiro ou comunidades internacionais.</p></div>
      {value.scope && <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ scope: null, states: [] })}><RotateCcw className="size-4" />Limpar seleção</Button>}
    </div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="flex min-h-80 min-w-0 flex-col justify-center rounded-lg bg-muted/20 p-3">
        {value.scope === 'international' ? <WorldMap /> : <><div role="group" aria-label="Selecionar no mapa por" className="flex justify-center gap-2">
          <Button type="button" size="sm" variant={mode === 'states' ? 'default' : 'ghost'} aria-pressed={mode === 'states'} onClick={() => setMode('states')}>Estados</Button>
          <Button type="button" size="sm" variant={mode === 'regions' ? 'default' : 'ghost'} aria-pressed={mode === 'regions'} onClick={() => setMode('regions')}>Regiões</Button>
        </div>
        <svg viewBox={map.viewBox} role="group" aria-label="Mapa do Brasil: selecione estados ou regiões" className="mx-auto w-full max-w-64">
          {map.states.map(state => {
            const active = value.scope === 'national' || selected.includes(state.uf);
            const highlight = hovered === (mode === 'regions' ? state.region : state.uf);
            return <path key={state.uf} d={state.d} role="button" tabIndex={0} aria-label={state.name + ' (' + state.uf + ')'} aria-pressed={active} data-uf={state.uf}
              onClick={() => select(state.uf, state.region)}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(state.uf, state.region); } }}
              onMouseEnter={() => setHovered(mode === 'regions' ? state.region : state.uf)} onMouseLeave={() => setHovered('')}
              onFocus={() => setHovered(mode === 'regions' ? state.region : state.uf)} onBlur={() => setHovered('')}
              className={'cursor-pointer stroke-background stroke-[1.5] transition-colors focus:stroke-foreground focus:stroke-[3] focus:outline-none ' + (active ? 'fill-primary' : highlight ? 'fill-primary/40' : 'fill-muted-foreground/25 hover:fill-primary/40')}>
              <title>{state.name + ' · ' + brazilRegions.find(region => region.id === state.region)?.name}</title>
            </path>;
          })}
          {map.states.map(state => <text key={state.uf} x={state.x} y={state.y} textAnchor="middle" dominantBaseline="middle" aria-hidden="true"
            className={'pointer-events-none text-[11px] font-semibold ' + (value.scope === 'national' || selected.includes(state.uf) ? 'fill-primary-foreground' : 'fill-foreground')}>{state.uf}</text>)}
        </svg>
        <p aria-live="polite" className="min-h-5 text-center text-xs text-muted-foreground">{hovered ? map.states.find(state => state.uf === hovered)?.name || brazilRegions.find(region => region.id === hovered)?.name : 'Selecione no mapa. Clique de novo para remover.'}</p>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">Mapa simplificado · IBGE</p></>}
      </div>
      <div className="min-w-0 space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Button type="button" aria-pressed={value.scope === 'national'} variant={value.scope === 'national' ? 'default' : 'outline'} onClick={() => onChange({ scope: 'national', states: [] })} className="h-auto w-full justify-start whitespace-normal p-3 text-left">
            <MapPin className="size-5 shrink-0" /><span><span className="block text-sm font-semibold">Brasil inteiro</span><span className="block text-xs opacity-80">Comunidades de alcance nacional</span></span>
          </Button>
          <Button type="button" aria-pressed={value.scope === 'international'} variant={value.scope === 'international' ? 'default' : 'outline'} onClick={() => onChange({ scope: 'international', states: [] })} className="h-auto w-full justify-start whitespace-normal p-3 text-left">
            <Globe2 className="size-5 shrink-0" /><span><span className="block text-sm font-semibold">Internacionais</span><span className="block text-xs opacity-80">Comunidades de fora do Brasil ou globais</span></span>
          </Button>
        </div>
        {value.scope !== 'international' && <><fieldset className="space-y-2"><legend className="text-sm font-medium">Regiões do Brasil</legend><div className="flex flex-wrap gap-2">
          {brazilRegions.map(region => <Button key={region.id} type="button" size="sm" variant={region.states.every(uf => selected.includes(uf)) ? 'default' : 'outline'}
            aria-pressed={region.states.every(uf => selected.includes(uf))} onClick={() => onChange(toggleStates(value, region.states))}>{region.name}</Button>)}
        </div></fieldset>
        <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Selecionar estados pela lista</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[...map.states].sort((a,b) => a.name.localeCompare(b.name, 'pt-BR')).map(state => <div key={state.uf} className="flex items-center gap-2"><Checkbox id={'uf-' + state.uf} checked={selected.includes(state.uf)} onCheckedChange={() => onChange(toggleStates(value, [state.uf]))} /><label htmlFor={'uf-' + state.uf} className="cursor-pointer text-xs">{state.name} ({state.uf})</label></div>)}
        </div></details></>}
        <p aria-live="polite" className="text-sm text-muted-foreground">{value.scope === 'national' ? 'Selecionado: Brasil inteiro' : value.scope === 'international' ? 'Selecionado: internacionais' : selected.length ? 'Estados selecionados: ' + selected.join(', ') : 'Todas as localizações'}</p>
      </div>
    </div>
  </section>;
}
