import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ReloadRequired, reloadMessage, retryableImport } from './LazyLoad';

type ContributionForm = typeof import('./ResourceContribution').ResourceContribution;
let formModule: Promise<ContributionForm> | undefined;
const requestForm = retryableImport(() => import('./ResourceContribution'));
// The form loads on the first opening. The dialog waits for it, so focus lands on the first field.
function loadForm() {
  formModule ??= requestForm().then(module => module.ResourceContribution);
  formModule.catch(() => { formModule = undefined; });
  return formModule;
}

export function ContributionDialog() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [Form, setForm] = useState<ContributionForm | null>(null);
  const [reload, setReload] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let active = true;
    function openWith(next: string) {
      void loadForm().then(component => { if (active) setForm(() => component); }, error => { if (active) setReload(error instanceof ReloadRequired); }).finally(() => {
        if (!active) return;
        setCategory(next);
        setOpen(true);
      });
    }
    const show = (event: Event) => { opener.current = document.activeElement as HTMLElement; openWith((event as CustomEvent<string>).detail || ''); };
    window.addEventListener('guia:contribute', show);
    const params = new URLSearchParams(window.location.search);
    if (params.has('sugerir') || window.location.pathname.replace(/\/$/, '') === '/contribuir') {
      window.history.replaceState(null, '', '/');
      openWith(params.get('sugerir') || params.get('categoria') || '');
    }
    return () => { active = false; window.removeEventListener('guia:contribute', show); };
  }, []);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus({preventScroll:true}); }} className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle>Contribuir com o guia</DialogTitle><DialogDescription>Preencha os dados e confira a prévia antes de enviar sua sugestão.</DialogDescription></DialogHeader>
      {Form ? <Form key={category} initialCategory={category} /> : reload ? <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-sm text-destructive">Não foi possível carregar o formulário. {reloadMessage}</p>
        <Button type="button" size="sm" onClick={() => window.location.reload()}>Recarregar a página</Button>
      </div> : <p role="alert" className="text-sm text-destructive">Não foi possível carregar o formulário. Tente novamente.</p>}
    </DialogContent>
  </Dialog>;
}
