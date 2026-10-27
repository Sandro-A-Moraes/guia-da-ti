import { useEffect, useRef, useState } from 'react';
import { Link2, ListTree } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ReloadRequired, reloadMessage, retryableImport } from './LazyLoad';
import type { ContributionRequest } from './contribution-actions';

type ContributionForm = typeof import('./ResourceContribution').ResourceContribution;
type RoadmapForm = typeof import('./RoadmapEditor').RoadmapEditor;
let formModule: Promise<ContributionForm> | undefined;
let editorModule: Promise<RoadmapForm> | undefined;
const requestForm = retryableImport(() => import('./ResourceContribution'));
const requestEditor = retryableImport(() => import('./RoadmapEditor'));
// Each form loads on first use. The dialog waits for it, so focus lands on the first field.
function loadForm() {
  formModule ??= requestForm().then(module => module.ResourceContribution);
  formModule.catch(() => { formModule = undefined; });
  return formModule;
}
function loadEditor() {
  editorModule ??= requestEditor().then(module => module.RoadmapEditor);
  editorModule.catch(() => { editorModule = undefined; });
  return editorModule;
}

// "choice" asks how to suggest a roadmap before showing any form.
type Mode = { kind: 'resource'; category: string } | { kind: 'choice' } | { kind: 'editor'; slug?: string };

export function ContributionDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: 'resource', category: '' });
  const [Form, setForm] = useState<ContributionForm | null>(null);
  const [Editor, setEditor] = useState<RoadmapForm | null>(null);
  const [reload, setReload] = useState(false);
  const [failed, setFailed] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let active = true;
    // Loads what the mode needs, then shows it.
    function show(next: Mode) {
      const needed = next.kind === 'editor' ? loadEditor().then(component => { if (active) setEditor(() => component); })
        : next.kind === 'resource' ? loadForm().then(component => { if (active) setForm(() => component); }) : Promise.resolve();
      void needed.then(() => { if (active) { setReload(false); setFailed(false); } }, error => { if (active) { setReload(error instanceof ReloadRequired); setFailed(true); } }).finally(() => {
        if (!active) return;
        setMode(next);
        setOpen(true);
      });
    }
    const openRequest = (request: ContributionRequest) => show(request.roadmap ? { kind: 'editor', slug: request.roadmap } : request.category === 'roadmaps' ? { kind: 'choice' } : { kind: 'resource', category: request.category });
    const onContribute = (event: Event) => {
      opener.current = document.activeElement as HTMLElement;
      const detail = (event as CustomEvent<ContributionRequest | string | undefined>).detail;
      openRequest(typeof detail === 'object' && detail ? detail : { category: detail || '' });
    };
    window.addEventListener('guia:contribute', onContribute);
    const params = new URLSearchParams(window.location.search);
    if (params.has('sugerir') || window.location.pathname.replace(/\/$/, '') === '/contribuir') {
      window.history.replaceState(null, '', '/');
      openRequest({ category: params.get('sugerir') || params.get('categoria') || '' });
    }
    return () => { active = false; window.removeEventListener('guia:contribute', onContribute); };
  }, []);
  function choose(next: Mode) {
    const needed = next.kind === 'editor' ? loadEditor().then(component => setEditor(() => component)) : loadForm().then(component => setForm(() => component));
    needed.then(() => { setFailed(false); setReload(false); setMode(next); }, error => { setReload(error instanceof ReloadRequired); setFailed(true); });
  }
  const title = mode.kind === 'editor' ? (mode.slug ? 'Sugerir alteração no roadmap' : 'Montar um roadmap') : mode.kind === 'choice' ? 'Sugerir um roadmap' : 'Contribuir com o guia';
  const description = mode.kind === 'editor' ? 'Monte as etapas e confira a prévia. O envio abre um PR para os mantenedores revisarem.'
    : mode.kind === 'choice' ? 'Escolha como você quer sugerir.' : 'Preencha os dados e confira a prévia antes de enviar sua sugestão.';
  const unavailable = failed && (reload ? <div role="alert" className="flex flex-col items-start gap-3">
    <p className="text-sm text-destructive">Não foi possível carregar o formulário. {reloadMessage}</p>
    <Button type="button" size="sm" onClick={() => window.location.reload()}>Recarregar a página</Button>
  </div> : <p role="alert" className="text-sm text-destructive">Não foi possível carregar o formulário. Tente novamente.</p>);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus({preventScroll:true}); }} className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {mode.kind === 'choice' ? <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => choose({ kind: 'editor' })} className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
          <ListTree aria-hidden="true" className="size-5 text-primary" /><span className="font-medium">Montar um roadmap aqui</span>
          <span className="text-sm text-muted-foreground">Crie as etapas e ligue cada uma aos recursos do catálogo. O roadmap fica no Guia.</span>
        </button>
        <button type="button" onClick={() => choose({ kind: 'resource', category: 'roadmaps' })} className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
          <Link2 aria-hidden="true" className="size-5 text-primary" /><span className="font-medium">Indicar um roadmap de outro site</span>
          <span className="text-sm text-muted-foreground">Informe o link de um roadmap que já existe fora do Guia.</span>
        </button>
        {unavailable}
      </div> : failed ? unavailable : mode.kind === 'editor' ? (Editor && <Editor key={mode.slug ?? 'novo'} slug={mode.slug} onSubmitted={() => setOpen(false)} />)
        : Form && <Form key={mode.category} initialCategory={mode.category} />}
    </DialogContent>
  </Dialog>;
}
