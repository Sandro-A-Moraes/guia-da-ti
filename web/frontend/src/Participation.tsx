import {openContribution} from './contribution-actions';
import { SectionGuide } from './UserGuide';
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog } from 'radix-ui';
import { Github, Moon, Sun, LogOut, HeartHandshake, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { categories } from './catalog';

type Session = { enabled: boolean; login: string | null; avatarUrl: string | null; csrfToken: string; canManageAds?: boolean };
export const SessionContext = createContext<{ session: Session | null; loading: boolean; logout: () => Promise<void>; startLogin: () => void; pending: boolean } | null>(null);
export function Participation({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const popup = useRef<Window | null>(null);
  const sessionRequest = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    let retry: number | undefined;
    const unavailable = 'Não foi possível verificar seu login. Tentaremos novamente.';
    function refresh() {
      if (document.hidden || (popup.current && !popup.current.closed)) return;
      window.clearTimeout(retry);
      const request = ++sessionRequest.current;
      return fetch('/api/auth/session', { signal: controller.signal, cache: 'no-store' }).then(response => {
      if (!response.ok) throw Error();
      return response.json();
    }).then(data => {
      if (!controller.signal.aborted && request === sessionRequest.current) {
        setSession(data); setLoading(false); setError(previous => previous === unavailable ? '' : previous);
      }
    }).catch(() => {
      if (!controller.signal.aborted && request === sessionRequest.current) {
        setError(unavailable);
        retry = window.setTimeout(() => { void refresh(); }, 5000);
      }
    }); }
    void refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(() => { void refresh(); }, 60000);
    if (new URLSearchParams(window.location.search).get('login') === 'failed') setError('Não foi possível entrar com o GitHub. Tente novamente.');
    return () => {
      controller.abort(); window.clearTimeout(retry); window.clearInterval(timer);
      window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  function startLogin() {
    if (pending) { popup.current?.focus(); return; }
    ++sessionRequest.current;
    setError('');
    const left = Math.max(0, window.screenX + (window.outerWidth - 520) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - 720) / 2);
    popup.current = window.open('/api/auth/login?returnUrl=%2Fauth%2Fcomplete.html', 'guia-github-login', `popup,width=520,height=720,left=${left},top=${top}`);
    if (!popup.current) {
      window.location.assign(`/api/auth/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setPending(true);
  }
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    const started = Date.now();
    let checking = false;
    async function checkSession() {
      if (checking || controller.signal.aborted) return;
      checking = true;
      const request = ++sessionRequest.current;
      try {
        const response = await fetch('/api/auth/session', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw Error();
        const next: Session = await response.json();
        if (controller.signal.aborted || request !== sessionRequest.current) return;
        if (next.login) { setSession(next); setLoading(false); setPending(false); popup.current?.close(); }
        else if (popup.current?.closed) setPending(false);
        else if (Date.now() - started > 300000) { setPending(false); setError('O login não foi concluído. Tente novamente.'); popup.current?.close(); }
      } catch { if (!controller.signal.aborted && popup.current?.closed) setPending(false); }
      finally { checking = false; }
    }
    function completed(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== popup.current || event.data?.type !== 'guia:auth-complete') return;
      if (event.data.failed) { setError('Não foi possível entrar com o GitHub. Tente novamente.'); setPending(false); }
      else void checkSession();
    }
    const timer = window.setInterval(() => { void checkSession(); }, 1000);
    window.addEventListener('message', completed);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('message', completed); };
  }, [pending]);
  async function logout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': session!.csrfToken } });
      if (!response.ok) throw Error();
      window.location.reload();
    } catch { setError('Não foi possível sair. Atualize a página e tente novamente.'); }
  }
  return <SessionContext.Provider value={{ session, loading, logout, startLogin, pending }}>
    {error && <p role="alert" className="mx-auto max-w-7xl px-4 py-3 text-sm text-destructive">{error}</p>}
    {children}
  </SessionContext.Provider>;
}

export function UserControls({ dark, toggleTheme }: { dark: boolean; toggleTheme: () => void }) {
  const auth = useContext(SessionContext);
  const themeLabel = dark ? 'Ativar tema claro' : 'Ativar tema escuro';
  const ThemeIcon = dark ? Sun : Moon;
  if (auth?.loading) return <div role="status" aria-label="Carregando usuário" className="flex items-center gap-2"><Skeleton className="size-9" /><Skeleton className="h-8 w-8 sm:w-36" /></div>;
  if (!auth?.session?.login) return <>
    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={themeLabel}><ThemeIcon /></Button>
    <LoginPrompt enabled={auth?.session?.enabled !== false} />
  </>;
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" shape="circle" aria-label={`Menu do usuário ${auth.session.login}`}>{auth.session.avatarUrl ? <img src={auth.session.avatarUrl} alt={`Foto de ${auth.session.login}`} className="size-8 rounded-full object-cover" referrerPolicy="no-referrer" /> : <Github />}</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-56">
      <DropdownMenuLabel>{auth.session.login}</DropdownMenuLabel><DropdownMenuSeparator />
      <DropdownMenuItem onSelect={toggleTheme}><ThemeIcon />{themeLabel}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => setTimeout(() => openContribution(), 0)}><HeartHandshake />Contribuir</DropdownMenuItem>
      {auth.session.canManageAds && <DropdownMenuItem asChild><a href="/admin/anuncios"><HeartHandshake />Administrar anúncios</a></DropdownMenuItem>}
      <DropdownMenuSeparator /><DropdownMenuItem onSelect={() => { void auth.logout(); }}><LogOut />Sair</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

const loginPanelClass = 'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg';

function GitHubHelp() { return <SectionGuide section="github" label="Primeira vez no GitHub?" />; }

function LoginPrompt({ enabled }: { enabled: boolean }) {
  const auth = useContext(SessionContext);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (auth?.session?.login) setOpen(false); }, [auth?.session?.login]);
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><Button size="sm"><Github className="size-4" aria-hidden="true" /><span className="sr-only sm:not-sr-only">Entrar com GitHub</span></Button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay data-slot="dialog-overlay" className="fixed inset-0 z-50 bg-black/50" /><Dialog.Content data-slot="dialog-content" className={loginPanelClass}>
      <div className="border-b px-6 py-4 pr-12"><Dialog.Title className="text-lg font-semibold">Entre para participar</Dialog.Title><Dialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">{enabled ? 'Entre com o GitHub para criar tópicos e responder no fórum.' : 'O login pelo GitHub está indisponível. Você ainda pode ler o fórum.'}</Dialog.Description></div>
      <div className="space-y-4 p-6"><GitHubHelp /></div>
      <div className="flex flex-wrap gap-2 border-t px-6 py-4"><LoginButton enabled={enabled} /><Dialog.Close asChild><Button variant="ghost" size="sm">Cancelar</Button></Dialog.Close></div>
      <Dialog.Close aria-label="Fechar diálogo" className="absolute right-4 top-4 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><X aria-hidden="true" className="size-4" /></Dialog.Close>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}

export function LoginButton({ enabled = true, compact = false }: { enabled?: boolean; compact?: boolean }) {
  const auth = useContext(SessionContext);
  const content = <><Github className="size-4" aria-hidden="true" /><span className={compact ? 'sr-only sm:not-sr-only' : undefined}>{auth?.pending ? 'Conectando…' : 'Entrar com GitHub'}</span></>;
  if (!enabled) return <Button size="sm" disabled>{content}</Button>;
  return <Button size="sm" onClick={auth?.startLogin} disabled={auth?.pending}>{content}</Button>;
}

export function Composer({ number, replyToId, categories, onPublished, label = 'Comentar', compact = false, prompt = false, githubUrl, mobileIcon }: {
  number?: number; replyToId?: string; categories?: { id: string; name: string }[]; onPublished: (number: number) => void; label?: string; compact?: boolean; prompt?: boolean; githubUrl?: string; mobileIcon?: ReactNode;
}) {
  const session = useContext(SessionContext)?.session;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  if (!session) return null;
  const layout = compact ? 'data-[open=true]:basis-full data-[open=true]:space-y-3' : 'space-y-3';
  const triggerSize = prompt ? 'lg' : compact ? number ? 'xs' : 'default' : 'default';
  const triggerVariant = prompt ? 'prompt' : number ? compact ? 'ghost' : 'outline' : 'default';
  const triggerLabel = prompt ? 'Participe da conversa…' : label;
  const triggerContent = mobileIcon ? <><span className="hidden sm:inline">{triggerLabel}</span><span aria-hidden="true" className="text-2xl leading-none sm:hidden">{mobileIcon}</span></> : triggerLabel;
  const triggerClassName = mobileIcon ? 'w-9 px-0 sm:w-auto sm:px-4' : undefined;
  if (!session.login || !session.enabled) return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><Button aria-label={mobileIcon ? triggerLabel : undefined} title={mobileIcon ? triggerLabel : undefined} size={triggerSize} className={triggerClassName} variant={triggerVariant}>{triggerContent}</Button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay data-slot="dialog-overlay" className="fixed inset-0 z-50 bg-black/50" /><Dialog.Content data-slot="dialog-content" className={loginPanelClass}>
      <div className="border-b px-6 py-4 pr-12"><Dialog.Title className="text-lg font-semibold">Entre para participar</Dialog.Title><Dialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">{session.enabled ? 'Entre com o GitHub para publicar sua mensagem no Guia.' : 'Ainda não dá para publicar pelo Guia. Abra o tópico no GitHub para participar.'}</Dialog.Description></div>
      <div className="space-y-4 p-6"><GitHubHelp /></div>
      <div className="flex flex-wrap gap-2 border-t px-6 py-4">{session.enabled && <LoginButton />}
        {!session.enabled && githubUrl && <Button asChild variant="outline" size="sm"><a href={githubUrl} target="_blank" rel="noopener noreferrer">{number ? 'Responder no GitHub' : 'Criar tópico no GitHub'}</a></Button>}
        <Dialog.Close asChild><Button variant="ghost" size="sm">Cancelar</Button></Dialog.Close>
      </div>
      <Dialog.Close aria-label="Fechar diálogo" className="absolute right-4 top-4 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><X aria-hidden="true" className="size-4" /></Dialog.Close>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setSuccess(false);
    try {
      const response = await fetch('/api/discussions/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session!.csrfToken },
        body: JSON.stringify({ number, replyToId, title, categoryId, body }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(response.status === 401 ? 'Sua sessão expirou. Entre novamente com o GitHub.' : result.error || 'Não foi possível confirmar a publicação. Confira o tópico no GitHub antes de tentar novamente.');
      setBody(''); setTitle(''); setOpen(false); setSuccess(true);
      onPublished(result.number);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível confirmar a publicação. Confira o tópico no GitHub antes de tentar novamente.'); }
    finally { setBusy(false); }
  }
  const form = <form data-motion onSubmit={submit} className={mobileIcon ? 'space-y-4' : 'space-y-4 rounded-lg border p-4'}>
    {!number && <>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-2"><label htmlFor={`${id}-title`} className="text-sm font-medium">Título do tópico</label><Input id={`${id}-title`} value={title} onChange={event => setTitle(event.target.value)} required maxLength={256} disabled={busy} /></div>
        <div className="min-w-0 space-y-2"><label htmlFor={`${id}-category`} className="text-sm font-medium">Categoria</label><Select value={categoryId} onValueChange={setCategoryId} disabled={busy}><SelectTrigger id={`${id}-category`} aria-label="Categoria" className="w-full"><SelectValue placeholder="Escolha" /></SelectTrigger><SelectContent>{categories?.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div>
      </div>
    </>}
    <div className="space-y-2"><label htmlFor={`${id}-body`} className="text-sm font-medium">{number ? 'Sua mensagem' : 'Conteúdo do tópico'}</label><textarea id={`${id}-body`} value={body} onChange={event => setBody(event.target.value)} required maxLength={10000} rows={5} disabled={busy} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50" /></div>
    <p className="text-xs text-muted-foreground">Sua mensagem aparecerá no Guia e no GitHub com o nome de {session.login}.</p>
    <div className={mobileIcon ? '-mx-6 -mb-6 flex gap-2 border-t px-6 py-4' : 'flex gap-2'}><Button type="submit" disabled={busy || !body.trim() || (!number && (!title.trim() || !categoryId))}>{busy ? 'Publicando…' : 'Publicar'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
  if (mobileIcon) return <><Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><Button aria-label={triggerLabel} title={triggerLabel} size={triggerSize} className={triggerClassName} variant={triggerVariant}>{triggerContent}</Button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay data-slot="dialog-overlay" className="fixed inset-0 z-50 bg-black/50" /><Dialog.Content data-slot="dialog-content" className={loginPanelClass}>
      <div className="border-b px-6 py-4 pr-12"><Dialog.Title className="text-lg font-semibold">Novo tópico</Dialog.Title></div>
      <div className="overflow-y-auto p-6">{form}</div>
      <Dialog.Close aria-label="Fechar diálogo" className="absolute right-4 top-4 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><X aria-hidden="true" className="size-4" /></Dialog.Close>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>{success && <p role="status" className="text-sm text-muted-foreground">Mensagem publicada.</p>}</>;
  return <div data-open={open} className={layout}>
    {!open ? <Button size={triggerSize} variant={triggerVariant} onClick={() => { setOpen(true); setSuccess(false); }}>{triggerContent}</Button> : form}
    {success && <p role="status" className="text-sm text-muted-foreground">Mensagem publicada.</p>}
  </div>;
}

export function ApproveContribution({ number }: { number: number }) {
  const session = useContext(SessionContext)?.session;
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [url, setUrl] = useState('');
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (!session?.login) { setAllowed(false); return; }
    const controller = new AbortController();
    fetch(`/api/discussions/${number}/approval-status`, { signal: controller.signal, cache: 'no-store' }).then(response => response.ok ? response.json() : { allowed: false }).then(result => { if (!controller.signal.aborted) setAllowed(result.allowed === true); }).catch(() => {});
    return () => controller.abort();
  }, [number, session?.login]);
  if (!session?.login) return null;
  if (!allowed && !url) return null;
  async function approve() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/discussions/${number}/approve`, { method: 'POST', headers: { 'X-CSRF-Token': session!.csrfToken } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(result.error || 'Não foi possível aprovar esta sugestão.');
      setUrl(result.url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível aprovar esta sugestão.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2">{url ? <p className="text-sm">Proposta de cadastro criada: <a className="text-primary underline" href={url} target="_blank" rel="noopener noreferrer">revisar e mesclar no GitHub</a></p> : <Button variant="outline" size="sm" disabled={busy} onClick={() => void approve()}>{busy ? 'Preparando cadastro…' : 'Aprovar e preparar cadastro'}</Button>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
