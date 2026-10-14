import {lazy,Suspense,useState} from 'react';
import {Dialog} from 'radix-ui';
import {SlidersHorizontal, X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {emptyLocationSelection,type LocationSelection} from './community-location';

// The maps only load when the dialog opens.
const CommunityLocationFilter=lazy(()=>import('./CommunityLocationFilter').then(module=>({default:module.CommunityLocationFilter})));

export function CommunityFiltersDialog({value,onChange}:{value:LocationSelection;onChange:(next:LocationSelection)=>void}) {
  const [open,setOpen]=useState(false);
  const [draft,setDraft]=useState(value);
  const count=Number(!!value.scope);
  return <div className="flex flex-wrap items-center gap-3">
    <Dialog.Root open={open} onOpenChange={next=>{if(next)setDraft(value);setOpen(next);}}>
      <Dialog.Trigger asChild><Button aria-label={`Filtrar comunidades${count>0?`, ${count} filtro ativo`:''}`} variant="outline" className="size-9 px-0 sm:size-auto sm:px-4"><SlidersHorizontal /><span className="sr-only sm:not-sr-only">Filtrar comunidades{count>0?' ('+count+')':''}</span></Button></Dialog.Trigger>
      <Dialog.Portal><Dialog.Overlay data-slot="dialog-overlay" className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content data-slot="dialog-content" className="fixed left-1/2 top-1/2 z-50 flex h-[min(90dvh,48rem)] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
          <div className="relative shrink-0 border-b px-4 py-4 pr-14 sm:px-6"><Dialog.Title className="text-xl font-semibold">Filtrar comunidades</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted-foreground">Filtre por estado, região ou alcance da comunidade.</Dialog.Description><Dialog.Close aria-label="Fechar filtros" className="absolute right-4 top-4 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><X className="size-4" /></Dialog.Close></div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Carregando mapa…</p>}><CommunityLocationFilter value={draft} onChange={next=>setDraft(current=>({...current,...next}))} /></Suspense>
          </div>
          <div className="flex shrink-0 flex-nowrap items-center justify-between gap-1 border-t px-2 py-3 sm:gap-2 sm:px-6">
            <Button size="sm" variant="ghost" className="px-2 text-xs sm:px-3 sm:text-sm" onClick={()=>setDraft(emptyLocationSelection())}>Limpar filtros</Button>
            <div className="flex shrink-0 gap-1 sm:gap-2"><Dialog.Close asChild><Button size="sm" variant="outline" className="px-2 text-xs sm:px-3 sm:text-sm">Cancelar</Button></Dialog.Close><Button size="sm" className="px-2 text-xs sm:px-3 sm:text-sm" onClick={()=>{onChange(draft);setOpen(false);}}>Aplicar filtros</Button></div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    {count>0&&<Button variant="ghost" size="sm" onClick={()=>onChange(emptyLocationSelection())}>Limpar filtros</Button>}
  </div>;
}
