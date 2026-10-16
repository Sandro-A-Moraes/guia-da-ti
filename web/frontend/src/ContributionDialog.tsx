import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ResourceContribution } from './Participation';

export function ContributionDialog() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const show = (event: Event) => { opener.current = document.activeElement as HTMLElement; setCategory((event as CustomEvent<string>).detail || ''); setOpen(true); };
    window.addEventListener('guia:contribute', show);
    const params = new URLSearchParams(window.location.search);
    if (params.has('sugerir') || window.location.pathname.replace(/\/$/, '') === '/contribuir') {
      setCategory(params.get('sugerir') || params.get('categoria') || '');
      window.history.replaceState(null, '', '/');
      setOpen(true);
    }
    return () => window.removeEventListener('guia:contribute', show);
  }, []);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus({preventScroll:true}); }} className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle>Contribuir com o guia</DialogTitle><DialogDescription>Preencha os dados e confira a prévia antes de enviar sua sugestão.</DialogDescription></DialogHeader>
      <ResourceContribution key={category} initialCategory={category} />
    </DialogContent>
  </Dialog>;
}
