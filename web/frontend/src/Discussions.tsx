import { Fragment, useEffect, useRef, useState } from 'react';
import { Advertisement } from './Advertisement';
import { PublicationActions } from './PublicationActions';
import { ApproveContribution, Composer } from './Participation';
import { DiscussionSkeleton } from './Loading';
import { ArrowLeft, ArrowUpRight, ChevronDown, MessageSquareText, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { categories, labels, resources, resourcePath } from './catalog';
import { DiscussionBody } from './DiscussionBody';
import { LoadingImage } from './LoadingImage';

type Category = { id: string; name: string };
type PageInfo = { hasNextPage: boolean; endCursor: string | null };
type Discussion = { number: number; title: string; preview: string; imageUrl?: string | null; category: Category; author: string; updatedAt: string; commentCount: number; isAnswered: boolean; locked: boolean; url: string };
type Comment = { id: string; author: string; avatarUrl: string | null; body: string; createdAt: string; isAnswer: boolean; isDeleted: boolean; replies: Comment[]; replyCount: number };
type DiscussionList = { status: 'ready'; repositoryUrl: string; categories: Category[]; items: Discussion[]; pageInfo: PageInfo; totalCount?: number | null };
type Thread = { status: 'ready'; discussion: Discussion; body: string; comments: Comment[]; pageInfo: PageInfo };
type DiscussionResource = { type: string; slug: string; name: string; summary: string; description: string; url: string; imageUrl?: string; areas: string[]; technologies: string[]; languages: string[]; updatedAt: string };

function DiscussionResourceContext({ number }: { number: number }) {
  const [resource, setResource] = useState<DiscussionResource | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/discussions/${number}/resource-context`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => { if (!controller.signal.aborted) setResource(result.resource); })
      .catch(() => {});
    return () => controller.abort();
  }, [number]);
  if (!resource) return null;
  const catalogResource = resources.find(item => item.type === resource.type && item.slug === resource.slug);
  const category = catalogResource && categories.find(item => item.id === catalogResource.type);
  return <aside aria-label="Recurso comentado" className="overflow-hidden rounded-lg border bg-card">
    {resource.imageUrl && <LoadingImage src={resource.imageUrl} alt="" className="aspect-[16/5] w-full bg-muted object-cover" imageClassName="size-full object-cover" />}
    <div className="space-y-3 p-4 sm:p-5">
      <p className="text-xs font-medium text-muted-foreground">{category?.name || 'Recurso do Guia'}</p>
      <h3 className="text-lg font-semibold">{resource.name}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{resource.summary}</p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{resource.description}</p>
      <div className="flex flex-wrap gap-2">{resource.areas.map(area => <Badge key={area} variant="outline">{labels[area] || area}</Badge>)}{resource.technologies.map(technology => <Badge key={technology} variant="secondary">{labels[technology] || technology}</Badge>)}{resource.languages.map(language => <Badge key={language} variant="secondary">{language}</Badge>)}</div>
      {catalogResource && <Button asChild variant="outline" size="sm"><a href={resourcePath(catalogResource)}>Ver recurso no Guia<ArrowUpRight /></a></Button>}
    </div>
  </aside>;
}

function useDiscussions<T>(url: string) {
  const [result, setResult] = useState<T | { status: 'unconfigured' } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError('');
    fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 404 ? 'Esta conversa não foi encontrada.' : 'Não foi possível carregar as conversas. Tente novamente.');
        return response.json();
      })
      .then(data => { if (!controller.signal.aborted) setResult(data); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof SyntaxError ? 'Não foi possível carregar as conversas. Tente novamente.' : reason.message || 'Não foi possível conectar. Tente novamente.'); });
    return () => controller.abort();
  }, [url, attempt]);
  return { result, error, retry: () => setAttempt(value => value + 1) };
}

function DateLabel({ value }: { value: string }) {
  return <time dateTime={value}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(new Date(value))}</time>;
}

function RequestState({ error, unconfigured, retry }: { error: string; unconfigured: boolean; retry: () => void }) {
  if (error) return <div role="alert" className="space-y-3 rounded-lg border p-6"><p>{error}</p><Button variant="outline" onClick={retry}>Tentar novamente</Button></div>;
  if (unconfigured) return <Empty className="min-h-52 border bg-card"><EmptyHeader><EmptyMedia variant="icon"><MessageSquareText /></EmptyMedia><EmptyTitle>As conversas da comunidade vão aparecer aqui</EmptyTitle><EmptyDescription>Estamos preparando o fórum para você tirar dúvidas e compartilhar experiências.</EmptyDescription></EmptyHeader></Empty>;
  return <DiscussionSkeleton />;
}

function Pagination({ pageInfo, cursors, setCursors }: { pageInfo: PageInfo; cursors: string[]; setCursors: (cursors: string[]) => void }) {
  if (!cursors.length && !pageInfo.hasNextPage) return null;
  return <nav aria-label="Paginação das conversas" className="flex items-center justify-between gap-3">
    <Button variant="outline" disabled={!cursors.length} onClick={() => setCursors(cursors.slice(0, -1))}>Anterior</Button>
    <span className="text-sm text-muted-foreground" aria-live="polite">Página {cursors.length + 1}</span>
    <Button variant="outline" disabled={!pageInfo.hasNextPage || !pageInfo.endCursor} onClick={() => setCursors([...cursors, pageInfo.endCursor!])}>Próxima</Button>
  </nav>;
}

function CommentCard({ comment, url, number, onPublished, rootId, locked = false }: { comment: Comment; url: string; number: number; onPublished: () => void; rootId?: string; locked?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const avatarUrl = comment.avatarUrl || (comment.author !== 'Usuário removido' ? `https://github.com/${encodeURIComponent(comment.author)}.png?size=64` : null);
  return <article data-motion className={`min-w-0 ${rootId ? 'rounded-lg bg-muted/20 p-3' : 'p-4 sm:p-5'}`}>
    <div className="flex items-start gap-1">
      <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)} className="min-w-0 flex-1">
        <summary className="flex w-full cursor-pointer list-none items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          {avatarUrl ? <LoadingImage src={avatarUrl} alt="" width={28} height={28} referrerPolicy="no-referrer" className="size-7 shrink-0 rounded-full bg-muted" imageClassName="rounded-full object-cover" fallback={<span aria-hidden="true" className="flex size-full items-center justify-center font-semibold uppercase text-muted-foreground">{comment.author.slice(0, 1)}</span>} /> : <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-semibold uppercase text-muted-foreground">{comment.author.slice(0, 1)}</span>}
          <span className="min-w-0 flex-1 truncate font-semibold">{comment.author}<span className="ml-2 font-normal text-muted-foreground"><DateLabel value={comment.createdAt} /></span></span>
          {comment.isAnswer && <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">Resposta aceita</Badge>}
          <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </summary>
        <div className="ml-3.5 space-y-3 border-l pl-4 pt-3 pb-1 sm:pl-5">
          <p className={`whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere] ${comment.isDeleted ? 'italic text-muted-foreground' : ''}`}>{comment.isDeleted ? 'Comentário excluído. As respostas continuam abaixo.' : comment.body}</p>
          {number > 0 && !locked && !comment.isDeleted && <Composer compact number={number} replyToId={rootId || comment.id} githubUrl={url} onPublished={onPublished} label="Responder" />}
          {comment.replies.length > 0 && <div aria-label="Respostas ao comentário" className="space-y-3 pt-2">{comment.replies.map(reply => <CommentCard key={reply.id} comment={reply} url={url} number={number} locked={locked} onPublished={onPublished} rootId={rootId || comment.id} />)}</div>}
          {comment.replyCount > comment.replies.length && <a className="inline-block text-xs text-muted-foreground hover:text-primary" href={url} target="_blank" rel="noopener noreferrer">Ver todas as {comment.replyCount} respostas no GitHub</a>}
        </div>
      </details>
      {!comment.isDeleted && <div className="shrink-0 pt-1"><PublicationActions author={comment.author} number={number} commentId={comment.id} body={comment.body} hasReplies={comment.replyCount > 0} onChanged={onPublished} /></div>}
    </div>
  </article>;
}

export function DiscussionThread({ number, embedded = false, onPublished }: { number: number; embedded?: boolean; onPublished?: () => void }) {
  const [cursors, setCursors] = useState<string[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const { result, error, retry } = useDiscussions<Thread>(`/api/discussions/${number}?${new URLSearchParams(cursors.length ? { after: cursors[cursors.length - 1] } : {})}`);
  const ready = result?.status === 'ready' ? result : null;
  function published() { retry(); onPublished?.(); }
  const returnParameters = new URLSearchParams(window.location.search);
  returnParameters.delete('conversa');
  const returnUrl = returnParameters.size ? `/?${returnParameters}` : '/';
  useEffect(() => { if (ready && !embedded) heading.current?.focus(); }, [ready, embedded]);
  return <section className={`space-y-5 ${embedded ? '' : 'mx-auto w-full max-w-4xl'}`} aria-label="Conversa">
    {!embedded && <Button asChild variant="ghost" className="-ml-3"><a href={returnUrl}><ArrowLeft />{returnParameters.has('q') ? 'Voltar à busca' : 'Todas as conversas'}</a></Button>}
    {!ready ? <RequestState error={error} unconfigured={result?.status === 'unconfigured'} retry={retry} /> : <>
      {!embedded && <DiscussionResourceContext number={number} />}
      <article data-motion className="overflow-hidden rounded-lg border bg-card">
        <header className="space-y-4 border-b p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-muted font-semibold uppercase">{ready.discussion.author.slice(0, 1)}</span><span className="font-semibold text-foreground">{ready.discussion.author}</span><span>·</span><DateLabel value={ready.discussion.updatedAt} /><span className="ml-auto"><PublicationActions author={ready.discussion.author} number={number} title={ready.discussion.title} body={ready.body} onChanged={published} onDeleted={() => { if (embedded) published(); else window.location.assign(returnUrl); }} /></span></div>
        <h2 ref={heading} tabIndex={-1} className="break-words text-2xl font-semibold tracking-tight outline-none [overflow-wrap:anywhere]">{embedded ? 'Discussão' : ready.discussion.title}</h2>
        <div className="flex flex-wrap gap-2"><Badge variant="secondary">{ready.discussion.category.name}</Badge>{ready.discussion.isAnswered && <Badge variant="outline">Respondida</Badge>}{ready.discussion.locked && <Badge variant="outline">Conversa encerrada</Badge>}</div>
        </header>
        <div className="p-4 sm:p-6"><DiscussionBody body={embedded ? ready.body.split('\n').filter(line => !/^(Recurso do guia|Site):/.test(line)).join('\n').trim() : ready.body} title={ready.discussion.title} /></div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/10 px-4 py-3 sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded border bg-card px-2.5 py-1.5 text-xs text-muted-foreground"><MessageSquareText className="size-3.5" />{ready.discussion.commentCount} comentários</span>
          <div className="flex flex-wrap items-center gap-2">{ready.body.includes('Categoria do guia:') && <ApproveContribution number={number} />}<Button asChild variant="ghost" size="xs"><a href={ready.discussion.url} target="_blank" rel="noopener noreferrer">Ver no GitHub<ArrowUpRight /></a></Button></div>
        </footer>
      </article>
      <Advertisement placement={embedded ? 'study-topic' : 'forum-topic'} />
      {!ready.discussion.locked && <div className="rounded-lg border bg-card p-4"><Composer prompt number={number} githubUrl={ready.discussion.url} onPublished={() => { setCursors([]); published(); }} /></div>}
      <section aria-label="Comentários" className="overflow-hidden rounded-lg border bg-card">
        <h3 className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold sm:px-5"><MessageSquareText className="size-4 text-muted-foreground" />Comentários ({ready.discussion.commentCount})</h3>
        <div className="divide-y">{ready.comments.length ? ready.comments.map(comment => <CommentCard key={comment.id} comment={comment} url={ready.discussion.url} number={number} locked={ready.discussion.locked} onPublished={published} />) : <p className="p-5 text-sm text-muted-foreground">Ainda não há comentários. Participe da conversa!</p>}</div>
      </section>
      <Pagination pageInfo={ready.pageInfo} cursors={cursors} setCursors={setCursors} />
    </>}
  </section>;
}

function DiscussionFeed() {
  const [category, setCategory] = useState(() => new URLSearchParams(window.location.search).get('categoria') || 'all');
  const [query, setQuery] = useState(() => (new URLSearchParams(window.location.search).get('q') || '').slice(0, 200).trim());
  const [draft, setDraft] = useState(query);
  const [cursors, setCursors] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const parameters = new URLSearchParams();
  if (category !== 'all') parameters.set('category', category);
  if (query) parameters.set('q', query);
  if (cursors.length) parameters.set('after', cursors[cursors.length - 1]);
  const { result, error, retry } = useDiscussions<DiscussionList>(`/api/discussions?${parameters}`);
  const ready = result?.status === 'ready' ? result : null;
  useEffect(() => { if (ready) setCategories(ready.categories); }, [ready]);
  function applyFilters(nextQuery: string, nextCategory = category) {
    setQuery(nextQuery);
    setCategory(nextCategory);
    setCursors([]);
    const url = new URL(window.location.href);
    if (nextQuery) url.searchParams.set('q', nextQuery); else url.searchParams.delete('q');
    if (nextCategory !== 'all') url.searchParams.set('categoria', nextCategory); else url.searchParams.delete('categoria');
    window.history.replaceState(null, '', url);
  }
  function discussionUrl(number: number) {
    const filters = new URLSearchParams({ conversa: String(number) });
    if (query) filters.set('q', query);
    if (category !== 'all') filters.set('categoria', category);
    return `/?${filters}`;
  }
  useEffect(() => {
    if (draft.trim() === query) return;
    const timer = window.setTimeout(() => applyFilters(draft.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [draft, query, category]);
  const advertisementAfter = ready ? Math.min(3, Math.max(1, ready.items.length - 1)) : 0;
  return <div className="space-y-3">
    <div aria-label="Ferramentas do fórum" className="flex min-w-0 flex-nowrap items-center gap-2">
      <form role="search" aria-label="Buscar conversas" className="flex min-w-0 flex-1 gap-1" onSubmit={event => { event.preventDefault(); applyFilters(draft.trim()); }}>
        <label htmlFor="discussion-search" className="sr-only">Buscar tópicos</label>
        <div className="relative min-w-0 flex-1"><Search aria-hidden="true" className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input id="discussion-search" type="search" maxLength={200} placeholder="Buscar" value={draft} onChange={event => setDraft(event.target.value)} className="h-9 pl-9 text-sm font-normal" /></div>
      </form>
      {(ready || categories.length > 0) && <Select value={category === 'all' ? '' : category} onValueChange={value => applyFilters(query, value)}><SelectTrigger aria-label="Categoria das conversas" className="h-9 w-[9.5rem] min-w-0 shrink-0 font-normal sm:w-44"><SelectValue placeholder="Categorias" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{categories.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>}
      {ready && <Composer compact mobileIcon={<Plus aria-hidden="true" className="size-5" strokeWidth={2} />} categories={categories} githubUrl={`${ready.repositoryUrl}/new`} label="Novo tópico" onPublished={number => { window.location.assign(`/?conversa=${number}`); }} />}
    </div>
    {query && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><p role="status">{ready ? `${ready.totalCount ?? ready.items.length} ${(ready.totalCount ?? ready.items.length) === 1 ? 'conversa encontrada' : 'conversas encontradas'} para “${query}”.` : 'Buscando…'}</p><Button type="button" variant="ghost" size="sm" onClick={() => { setDraft(''); applyFilters(''); }}>Limpar busca</Button></div>}
    {!ready ? <RequestState error={error} unconfigured={result?.status === 'unconfigured'} retry={retry} /> : <>
      {ready.items.length ? <ul className="divide-y border-y" aria-label="Conversas">{ready.items.map((discussion, index) => <Fragment key={discussion.number}><li>
        <article data-motion className="relative min-w-0 cursor-pointer space-y-2 px-1 py-4 transition-colors hover:bg-muted/30 focus-within:bg-muted/30">
          {discussion.imageUrl && <LoadingImage src={discussion.imageUrl} alt={`Imagem de ${discussion.title}`} loading="lazy" className="mb-3 h-36 w-full overflow-hidden rounded-lg bg-muted" imageClassName="object-cover" />}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">{discussion.category.name}</span><span aria-hidden="true">·</span><span>{discussion.author}</span><span aria-hidden="true">·</span><DateLabel value={discussion.updatedAt} />{discussion.isAnswered && <Badge variant="secondary" className="text-[10px]">Respondida</Badge>}{discussion.locked && <Badge variant="outline" className="text-[10px]">Encerrada</Badge>}</div>
          <h2 className="text-base font-semibold leading-snug sm:text-lg"><a className="rounded-sm hover:text-primary after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring [overflow-wrap:anywhere]" href={discussionUrl(discussion.number)}>{discussion.title}</a></h2>
          {discussion.preview && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{discussion.preview}</p>}
          <Button asChild variant="secondary" size="xs" className="relative"><a href={discussionUrl(discussion.number)} aria-label={`${discussion.commentCount} comentários em ${discussion.title}`}><MessageSquareText aria-hidden="true" />{discussion.commentCount} {discussion.commentCount === 1 ? 'comentário' : 'comentários'}</a></Button>
        </article>
      </li>{index + 1 === advertisementAfter && <Advertisement listItem />}</Fragment>)}</ul> : <Empty className="border"><EmptyHeader><EmptyMedia variant="icon"><MessageSquareText /></EmptyMedia><EmptyTitle>{query ? 'Nenhuma conversa encontrada' : category === 'all' ? 'Comece a primeira conversa' : 'Ainda não há conversas nesta categoria'}</EmptyTitle><EmptyDescription>{query ? 'Tente outras palavras ou selecione todas as categorias. Você também pode abrir uma nova conversa.' : 'Compartilhe uma dúvida, uma descoberta ou uma experiência com a comunidade.'}</EmptyDescription></EmptyHeader></Empty>}
      <Pagination pageInfo={ready.pageInfo} cursors={cursors} setCursors={setCursors} />
    </>}
  </div>;
}

export function Discussions({ className = '' }: { className?: string }) {
  // Read the URL after hydration so the pre-rendered homepage remains consistent.
  const [number, setNumber] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('conversa');
    const parsed = value && /^\d+$/.test(value) ? Number(value) : 0;
    setNumber(Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2147483647 ? parsed : null);
  }, []);
  return <section id="comunidade" aria-labelledby="discussions-title" className={`mx-auto max-w-4xl space-y-3 ${className}`}>
    <h1 id="discussions-title" className="sr-only">Fórum do Guia da TI</h1>
    {number === undefined ? <DiscussionSkeleton /> : number ? <DiscussionThread number={number} /> : <DiscussionFeed />}
  </section>;
}
