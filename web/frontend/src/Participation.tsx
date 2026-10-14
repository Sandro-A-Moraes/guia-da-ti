import {openContribution} from './contribution-actions';
import { SectionGuide } from './UserGuide';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ContributionPreview } from './ContributionPreview';
import { creatorCategories } from './creator-categories';
import { universityTypes } from './university-options';
import { useContributionToast } from './ContributionToasts';
import { ContributionWizard } from './ContributionWizard';
import {SelectField} from './SelectField';
import { ComboboxField } from './ComboboxField';
import { contributionCopy } from './contribution-copy';
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog } from 'radix-ui';
import { Github, Moon, Sun, LogOut, HeartHandshake, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { categories, labels, taxonomy } from './catalog';
import { CreatorAvatar, useCreatorProfile, followersLabel } from './CreatorProfile';
import { brazilRegions, type CommunityLocation } from './community-location';
import { communityAudiences, communityCategoryOrder, communityModalities, communityPlatforms } from './community-options';

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

function LoginButton({ enabled = true, compact = false }: { enabled?: boolean; compact?: boolean }) {
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

const typeNames: Record<string, string> = { courses: 'Cursos', platforms: 'Plataformas de cursos', universities: 'Faculdades', bootcamps: 'Bootcamps', roadmaps: 'Roadmaps', books: 'Livros', certifications: 'Certificações', news: 'Notícias', blogs: 'Blogs', newsletters: 'Newsletters', podcasts: 'Podcasts', youtube: 'YouTube', creators: 'Criadores', articles: 'Artigos', tutorials: 'Tutoriais', studies: 'Estudos', 'case-studies': 'Estudos de caso', reports: 'Relatórios', communities: 'Comunidades', events: 'Eventos', meetups: 'Meetups', conferences: 'Conferências', hackathons: 'Hackathons', tools: 'Ferramentas', 'open-source': 'Projetos open source', challenges: 'Desafios', labs: 'Laboratórios', jobs: 'Sites de vagas', scholarships: 'Bolsas de estudo', mentoring: 'Programas de mentoria', volunteering: 'Programas de voluntariado' };

export function ResourceContribution({initialCategory = "", onSubmitted}: {initialCategory?: string; onSubmitted?: () => void}) {
  const notify = useContributionToast();
  const session = useContext(SessionContext)?.session;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [successUrl, setSuccessUrl] = useState('');
  const [successLinkLabel, setSuccessLinkLabel] = useState('Abrir conversa');
  const [type, setType] = useState(initialCategory);
  const [area, setArea] = useState('');
  const [languages, setLanguages] = useState<string[]>(['pt-BR']);
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [communityScope, setCommunityScope] = useState<CommunityLocation['scope'] | ''>('');
  const [communityStates, setCommunityStates] = useState<string[]>([]);
  const [brazilStates, setBrazilStates] = useState<{ uf: string; name: string }[]>([]);
  useEffect(() => {
    if (communityScope !== 'regional' || brazilStates.length) return;
    let active = true;
    void import('./data/brazil-states.json').then(({ default: map }) => {
      if (active) setBrazilStates([...map.states].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    }).catch(() => { /* The region buttons still work without the state list. */ });
    return () => { active = false; };
  }, [communityScope, brazilStates.length]);
  const [communityPlatformIds, setCommunityPlatformIds] = useState<string[]>([]);
  const [communityModality, setCommunityModality] = useState('');
  const [communityAudience, setCommunityAudience] = useState('');
  const [memberCount, setMemberCount] = useState('');
  const [moreThan, setMoreThan] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const [universityType, setUniversityType] = useState('');
  const [communityUrls, setCommunityUrls] = useState<Record<string,string>>({});
  const [creatorCategoryIds, setCreatorCategoryIds] = useState<string[]>([]);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageError, setImageError] = useState('');
  useEffect(() => { if (!imageFile) { setImagePreview(''); return; } const objectUrl = URL.createObjectURL(imageFile); setImagePreview(objectUrl); return () => URL.revokeObjectURL(objectUrl); }, [imageFile]);
  const creatorCategory = type === 'creators' || type === 'youtube';
  const copy = contributionCopy(type);
  const catalogOnly = creatorCategory || type === 'communities';
  const lookup = useCreatorProfile(url, creatorCategory && !!session?.login);
  useEffect(() => {
    if (!lookup.profile) return;
    setName(lookup.profile.name.slice(0, 100));
    setSummary(lookup.profile.description.slice(0, 240));
    setDescription(lookup.profile.description.slice(0, 4000));
  }, [lookup.profile]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.login || busy) return;
    setBusy(true); setError(''); setSuccess('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const communityLocation = type === 'communities' && communityScope ? { scope: communityScope, ...(communityScope === 'regional' ? { states: communityStates } : {}) } : undefined;
    const proposal = { type, name: String(form.get('name') || '').trim(), url: String(form.get('url') || '').trim(), summary: String(form.get('summary') || '').trim(), description: String(form.get('description') || '').trim(), areas: area ? [area] : [], technologies, languages, communityLocation,
      ...(creatorCategory ? {creatorCategories: creatorCategoryIds} : {}),
      ...(type === 'universities' ? {universityType} : {}),
      ...(type === 'communities' ? {communityPlatforms:communityPlatformIds,communityModality,communityAudience,communityLinks:communityPlatformIds.map(platform=>({platform,url:(communityUrls[platform]||'').trim()}))} : {}) };
    const memberCount=String(form.get('communityMemberCount')||'').trim();
    const submission={...proposal,...(type==='communities' && memberCount ? {communityMembers:{count:Number(memberCount),moreThan:form.get('communityMembersMoreThan')==='on',checkedAt:new Date().toISOString().slice(0,10)}} : {})};
    try {
      let imageUploadId: string | undefined;
      if (imageFile) {
        const data = new FormData(); data.append('image', imageFile);
        const uploaded = await fetch('/api/contributions/images', {method:'POST', headers:{'X-CSRF-Token':session.csrfToken}, body:data});
        const result = await uploaded.json();
        if (!uploaded.ok) throw Error(result.error || 'A imagem não foi enviada. Tente novamente.');
        imageUploadId = result.id;
      }
      const response = await fetch('/api/contributions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken }, body: JSON.stringify({...submission, ...(imageUploadId ? {imageUploadId} : imageUrl.trim() ? {imageUrl:imageUrl.trim()} : {})}) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(result.error || 'Não foi possível enviar a contribuição.');
      if (result.kind === 'catalog' && result.url) {
        setSuccess('Sugestão enviada para revisão dos mantenedores. O cadastro aparece no guia após a aprovação.');
        setSuccessUrl(result.url); setSuccessLinkLabel('Acompanhar revisão');
      } else {
        setSuccess(`Sugestão enviada! A conversa #${result.number} já está aberta para comentários.`);
        setSuccessUrl(`/?conversa=${result.number}`); setSuccessLinkLabel('Abrir conversa');
      }
      notify(result.notice ?? { id: crypto.randomUUID(), login: session.login, name: proposal.name, category: proposal.type, url: result.kind === 'catalog' ? result.url : `/?conversa=${result.number}` });
      formElement.reset(); setType(''); setArea(''); setLanguages(['pt-BR']); setTechnologies([]);
      setUrl(''); setName(''); setSummary(''); setDescription('');
      setCommunityScope(''); setCommunityStates([]);
      setCommunityPlatformIds([]); setCommunityModality(''); setCreatorCategoryIds([]);
      setCommunityAudience(''); setCommunityUrls({});
      setUniversityType(''); setImageUrl(''); setImageFile(null); setMemberCount(''); setMoreThan(false);
      onSubmitted?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível enviar a contribuição.'); }
    finally { setBusy(false); }
  }
  if (!session?.login) return <div className="space-y-3 rounded-lg border p-5"><p>Entre com o GitHub para sugerir um recurso. Criadores e comunidades passam por revisão do catálogo. As outras sugestões abrem uma conversa no fórum.</p><LoginButton /></div>;
  return <ContributionWizard preview={<ContributionPreview name={name} summary={summary} description={description} category={typeNames[type] || type} area={labels[area] || area} languages={languages} image={imagePreview || imageUrl} url={url} details={[
      ['Tecnologias', technologies.map(id => labels[id] || id).join(', ')],
      ['Tipo de instituição', type === 'universities' ? universityTypes.find(item => item.id === universityType)?.name || '' : ''],
      ['Conteúdo', creatorCategory ? creatorCategories.filter(item => creatorCategoryIds.includes(item.id)).map(item => item.name).join(', ') : ''],
      ['Localização', type === 'communities' ? communityScope === 'national' ? 'Brasil inteiro' : communityScope === 'international' ? 'Internacional' : communityStates.join(', ') : ''],
      ['Público', type === 'communities' ? communityAudiences.find(item => item.id === communityAudience)?.name || '' : ''],
      ['Membros', type === 'communities' && memberCount ? (moreThan ? 'Mais de ' : '') + Number(memberCount).toLocaleString('pt-BR') : ''],
      ['Plataformas', type === 'communities' ? communityPlatforms.filter(item => communityPlatformIds.includes(item.id)).map(item => item.name).join(', ') : ''],
      ['Modalidade', type === 'communities' ? communityModalities.find(item => item.id === communityModality)?.name || '' : ''],
    ]} />} onSubmit={submit} category={type} busy={busy} rules={{ 'Categoria da comunidade': !!area, 'Categoria do guia': !!type, 'Tipo de instituição': !!universityType, 'Categorias de conteúdo': !!creatorCategoryIds.length, 'Localização da comunidade': !!communityScope && (communityScope !== 'regional' || !!communityStates.length), 'Público da comunidade': !!communityAudience, 'Modalidade': !!communityModality, 'Plataformas da comunidade': !!communityPlatformIds.length && communityPlatformIds.every(id => !!communityUrls[id]?.trim()), 'Idiomas disponíveis': !!languages.length }} footer={<>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{success && <p role="status" className="text-sm text-muted-foreground">{success} <a className="text-primary underline" href={successUrl}>{successLinkLabel}</a></p>}</>}>
    <div data-step-title="Categoria do guia" className="space-y-3"><SelectField label="Categoria do guia" name="type" required value={type} onChange={setType} placeholder="Escolha uma categoria" options={taxonomy.types.map((id: string) => ({id, name:typeNames[id] || categories.find(category => category.id === id)?.name || id}))} />{['jobs', 'scholarships', 'mentoring', 'volunteering'].includes(type) && <p className="text-xs text-muted-foreground">Sugira o site ou a página do programa. Consulte vagas e inscrições na fonte, sem cadastrar anúncios individuais.</p>}</div>
    {type === 'universities' && <SelectField label="Tipo de instituição" name="universityType" required value={universityType} onChange={setUniversityType} placeholder="Escolha o tipo" options={universityTypes.map(t => ({...t}))} />}
    {type === 'communities' && <fieldset className="space-y-3 rounded-md border p-4"><legend className="text-sm font-medium">Localização da comunidade</legend>
      <SelectField label="Área de atuação" name="communityScope" required value={communityScope} onChange={value=>setCommunityScope(value as CommunityLocation['scope'])} placeholder="Escolha o alcance" options={[{id:'regional',name:'Regional'},{id:'national',name:'Nacional'},{id:'international',name:'Internacional'}]} />
      {communityScope === 'regional' && <>
        <p className="text-xs text-muted-foreground">Marque os estados onde a comunidade atua ou selecione uma região inteira.</p>
        <div className="flex flex-wrap gap-2">{brazilRegions.map(region => <Button key={region.id} type="button" size="sm" variant="outline" onClick={() => setCommunityStates(current => [...new Set([...current, ...region.states])])}>{region.name}</Button>)}</div>
        <div className="grid gap-2 sm:grid-cols-2">{brazilStates.map(state => <Label key={state.uf} className="flex items-center gap-2 text-xs"><Checkbox name="communityStates" value={state.uf} checked={communityStates.includes(state.uf)} onCheckedChange={checked => setCommunityStates(current => checked === true ? [...current, state.uf] : current.filter(uf => uf !== state.uf))} />{state.name} ({state.uf})</Label>)}</div>
      </>}
    </fieldset>}
    {type === 'communities' && <SelectField label="Público da comunidade" name="communityAudience" required value={communityAudience} onChange={setCommunityAudience} placeholder="Escolha o público" options={communityAudiences} />}
    {type === 'communities' && <div data-step-title="Quantidade de membros" className="space-y-3">
      <Label className="block space-y-2 text-sm font-medium">Quantidade de membros (opcional)<Input name="communityMemberCount" type="number" min={0} max={2147483647} step={1} placeholder="Ex.: 4000" disabled={busy} value={memberCount} onChange={event => setMemberCount(event.target.value)} /></Label>
      <Label className="flex items-center gap-2 text-sm"><Checkbox name="communityMembersMoreThan" disabled={busy} checked={moreThan} onCheckedChange={checked => setMoreThan(checked === true)} />A comunidade tem mais membros que esse número</Label>
      <p className="text-xs text-muted-foreground">Informe uma contagem confirmada. Evite somar a mesma pessoa em plataformas diferentes.</p>
    </div>}
    {type === 'communities' && <fieldset className="space-y-3"><legend className="text-sm font-medium">Plataformas da comunidade</legend><p className="text-xs text-muted-foreground">Marque as plataformas usadas pela comunidade e informe o link de cada uma.</p>
      <div className="grid gap-2 sm:grid-cols-2">{communityPlatforms.map(item=><Label key={item.id} className="flex items-center gap-2 text-sm"><Checkbox name="communityPlatforms" value={item.id} checked={communityPlatformIds.includes(item.id)} onCheckedChange={checked => setCommunityPlatformIds(current=>checked === true?[...current,item.id]:current.filter(id=>id!==item.id))} />{item.name}</Label>)}</div>
      {communityPlatforms.filter(item=>communityPlatformIds.includes(item.id)).map(item=><Label key={item.id} className="block space-y-2 text-sm font-medium">Link no {item.name}<Input name={`communityLink-${item.id}`} type="url" required maxLength={500} placeholder="https://" value={communityUrls[item.id]||''} disabled={busy} onChange={event=>setCommunityUrls(current=>({...current,[item.id]:event.target.value}))} /></Label>)}
    </fieldset>}
    {type === 'communities' && <SelectField label="Modalidade" name="communityModality" required value={communityModality} onChange={setCommunityModality} placeholder="Escolha a modalidade" options={communityModalities} />}
    <div data-step-title={copy.url} className="space-y-4"><Label className="block space-y-2 text-sm font-medium">{copy.url}<Input name="url" type="url" required maxLength={500} placeholder="https://" value={url} onChange={event => {
      setUrl(event.target.value);
      if (creatorCategory) { setName(''); setSummary(''); setDescription(''); }
    }} /></Label><p className="text-sm text-muted-foreground">{copy.urlHelp}</p>
    {creatorCategory && <div aria-live="polite" className="space-y-2 text-sm text-muted-foreground">
      <p>Cole o link do perfil para buscar os dados automaticamente. Confira as informações antes de enviar.</p>
      {lookup.loading && <p role="status">Buscando perfil…</p>}
      {lookup.error && <p role="status">{lookup.error}</p>}
      {lookup.profile && <div className="flex items-center gap-3 rounded-md border p-3"><CreatorAvatar profile={lookup.profile} name={lookup.profile.name} /><div><p className="font-medium text-foreground">{lookup.profile.name}</p><p>{followersLabel(lookup.profile)}</p></div></div>}
    </div>}
    </div>
    <div data-step-title="Imagem" className="space-y-4">
      <Label className="grid gap-2">Enviar imagem<Input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => {const file = event.target.files?.[0] || null; if (file && (file.size > 2 * 1024 * 1024 || !['image/png','image/jpeg','image/webp'].includes(file.type))) { setImageError('Escolha uma imagem PNG, JPG ou WebP de até 2 MB.'); setImageFile(null); event.target.value = ''; return; } setImageError(''); setImageFile(file); if (file) setImageUrl(''); }} /></Label>
      <Label className="grid gap-2">Ou usar link da imagem<Input name="imageUrl" type="url" value={imageUrl} placeholder="https://" maxLength={500} disabled={busy || !!imageFile} onChange={event => setImageUrl(event.target.value)} /></Label>
      {imageFile && <Button type="button" variant="outline" onClick={() => { setImageFile(null); if (imageInput.current) imageInput.current.value = ''; }}>Remover arquivo</Button>}
      <p className="text-xs text-muted-foreground">Imagem opcional. Envie PNG, JPG ou WebP de até 2 MB ou informe um link HTTPS.</p>
      {imageError && <p role="alert" className="text-sm text-destructive">{imageError}</p>}
    </div>
    <div data-step-title={copy.name} className="space-y-3"><Label className="block space-y-2 text-sm font-medium">{copy.name}<Input name="name" required minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder={type === 'communities' ? 'Ex.: FullDev' : copy.name} /></Label></div>
    <div data-step-title={copy.summary} className="space-y-3"><Label className="block space-y-2 text-sm font-medium">{copy.summary}<Input name="summary" required minLength={10} maxLength={240} value={summary} onChange={event => setSummary(event.target.value)} /></Label><p className="text-sm text-muted-foreground">{copy.summaryHelp}</p></div>
    <div data-step-title={copy.description} className="space-y-3"><Label className="block space-y-2 text-sm font-medium">{copy.description}<Textarea name="description" required minLength={10} maxLength={4000} rows={4} value={description} onChange={event => setDescription(event.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-normal" /></Label><p className="text-sm text-muted-foreground">{copy.descriptionHelp}</p></div>
    {creatorCategory && <fieldset className="space-y-3 rounded-md border p-4"><legend className="text-sm font-medium">Categorias de conteúdo</legend>
      <p className="text-xs text-muted-foreground">Escolha pelo menos uma categoria. Um perfil pode abordar vários tipos de conteúdo.</p>
      <div className="grid gap-2 sm:grid-cols-2">{creatorCategories.map(item => <Label key={item.id} className="flex items-center gap-2 text-sm"><Checkbox name="creatorCategories" value={item.id} checked={creatorCategoryIds.includes(item.id)} disabled={busy} onCheckedChange={checked => setCreatorCategoryIds(current => checked === true ? [...current, item.id] : current.filter(id => id !== item.id))} />{item.name}</Label>)}</div>
    </fieldset>}
    {type === 'communities' ? <div data-step-title="Categoria da comunidade"><ComboboxField label="Categoria da comunidade" name="area" value={area} onChange={setArea} disabled={busy} options={[...communityCategoryOrder, ...taxonomy.areas.filter(id=>!communityCategoryOrder.includes(id))].map(id=>({id,name:labels[id]||id}))} /></div> : <SelectField label="Assunto principal" name="area" required value={area} onChange={setArea} placeholder="Escolha um assunto" options={taxonomy.areas.map(id => ({id, name:labels[id] || id}))} />}
    <fieldset className="space-y-2"><legend className="text-sm font-medium">Tecnologias (opcional)</legend><div className="flex flex-wrap gap-4">{taxonomy.technologies.map((technology: string) => <Label key={technology} className="flex items-center gap-2 text-sm"><Checkbox checked={technologies.includes(technology)} onCheckedChange={checked => setTechnologies(current => checked === true ? [...current, technology] : current.filter(item => item !== technology))} />{labels[technology] || technology}</Label>)}</div></fieldset>
    <fieldset className="space-y-2"><legend className="text-sm font-medium">Idiomas disponíveis</legend><div className="flex flex-wrap gap-4">{taxonomy.languages.map((language: string) => <Label key={language} className="flex items-center gap-2 text-sm"><Checkbox checked={languages.includes(language)} onCheckedChange={checked => setLanguages(current => checked === true ? [...current, language] : current.filter(item => item !== language))} />{language}</Label>)}</div></fieldset>
    <div data-step-title="Revisar e enviar" className="space-y-5"><dl className="grid gap-4 text-sm sm:grid-cols-2">{[['Categoria',typeNames[type] || type],[copy.name,name],[copy.url,url],[copy.summary,summary],[copy.description,description],['Assunto',labels[area] || area],['Idiomas',languages.join(', ')]].map(([label,value])=><div key={label} className="min-w-0 space-y-1"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{value || 'Não informado'}</dd></div>)}</dl><p className="text-xs text-muted-foreground">{catalogOnly ? 'Os mantenedores revisam sua sugestão antes de incluí-la no catálogo. Criadores e comunidades não abrem tópicos no fórum. Para enviar a proposta, o GitHub pode criar uma cópia do catálogo na sua conta.' : 'Sua sugestão abre um tópico em Ideias para a comunidade comentar. Depois da revisão, um mantenedor prepara o cadastro para o catálogo.'}</p>
    <Button type="submit" disabled={busy || !type || !area || !languages.length || type === 'universities' && !universityType || creatorCategory && !creatorCategoryIds.length || type === 'communities' && (!communityAudience || !communityScope || communityScope === 'regional' && !communityStates.length || !communityModality || !communityPlatformIds.length || communityPlatformIds.some(id=>!communityUrls[id]?.trim()))}>{busy ? 'Enviando…' : catalogOnly ? 'Enviar para revisão' : 'Enviar sugestão e abrir conversa'}</Button>
    </div>
  </ContributionWizard>;
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
