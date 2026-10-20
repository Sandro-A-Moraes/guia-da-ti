import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Toast } from 'radix-ui';
import { CheckCircle2, X } from 'lucide-react';
import { categories } from './catalog';

type Notice = { id: string; login: string; name: string; category: string; url: string };
const NoticeContext = createContext<(notice: Notice) => void>(() => {});
export const useContributionToast = () => useContext(NoticeContext);

export function ContributionToasts({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const seen = useRef(new Set<string>());
  const notify = useCallback((notice: Notice) => {
    if (seen.current.has(notice.id)) return;
    seen.current.add(notice.id);
    if (seen.current.size > 256) seen.current.delete(seen.current.values().next().value!);
    setNotices(current => [...current, notice].slice(-3));
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let cursor: { stream: string; cursor: number } | undefined;
    async function poll() {
      let delay = 5000;
      try {
        if (!document.hidden) {
          const query = cursor ? '?' + new URLSearchParams({ stream: cursor.stream, after: String(cursor.cursor) }) : '';
          const response = await fetch('/api/contributions/notices' + query, { signal: controller.signal, cache: 'no-store' });
          if (!response.ok) throw Error();
          const page = await response.json() as { stream: string; cursor: number; items: Notice[] };
          if (!controller.signal.aborted) {
            page.items.slice(-3).forEach(notify);
            cursor = page;
          }
        }
      } catch { delay = 15000; }
      if (!controller.signal.aborted) timer = setTimeout(poll, delay);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [notify]);
  return <NoticeContext.Provider value={notify}><Toast.Provider duration={7000} swipeDirection="right">
    {children}
    {notices.map(notice => <Toast.Root key={notice.id} defaultOpen type="background" onOpenChange={open => { if (!open) setNotices(current => current.filter(n => n.id !== notice.id)); }} className="flex items-start gap-2 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in motion-reduce:animate-none sm:gap-3 sm:p-4">
      <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary sm:size-5" />
      <div className="min-w-0 flex-1 space-y-1">
        <Toast.Title className="break-words text-xs font-medium sm:text-sm">{notice.login} adicionou {notice.name} em {notice.category === 'creators' ? 'Criadores' : categories.find(c => c.id === notice.category)?.name ?? notice.category}</Toast.Title>
        <Toast.Description className="text-[11px] text-muted-foreground sm:text-xs">Sugestão enviada para revisão</Toast.Description>
        <a href={notice.url} className="inline-block text-[11px] text-primary underline underline-offset-4 sm:text-xs">Acompanhar PR</a>
      </div>
      <Toast.Close aria-label="Fechar aviso" className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><X className="size-3.5 sm:size-4" /></Toast.Close>
    </Toast.Root>)}
    <Toast.Viewport aria-label="Avisos de sugestões" className="fixed right-2 bottom-2 z-[100] m-0 flex w-[calc(100vw-1rem)] max-w-xs list-none flex-col gap-1 outline-none sm:right-4 sm:bottom-4 sm:w-[calc(100vw-2rem)] sm:max-w-sm sm:gap-2" />
  </Toast.Provider></NoticeContext.Provider>;
}
