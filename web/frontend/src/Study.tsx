import { useContext, useEffect, useId, useState } from "react";
import {
  BookOpen,
  Flame,
  LayoutGrid,
  List,
  MessageSquareText,
  Star,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resourcePath, type Resource } from "./catalog";
import { SessionContext } from "./Participation";
import { DiscussionThread } from "./Discussions";
import { ResourceSearch } from "./ResourceSearch";
import { ResourcePagination } from "./ResourcePagination";
import imageSources from "./assets/study/sources.json";
import { universityTypes } from "./university-options";
import { LoadingImage } from "./LoadingImage";
import { resourceImage } from './resource-image';
import { ResourcePreview } from './ResourcePreview';
import { isSponsored, pinSponsored } from './sponsored-resources';
import { paginate, readPage } from "./pagination";
import {
  rankStudy,
  studyKey,
  studySorts,
  type StudyActivity,
  type StudySort,
} from "./study-ranking";

function useStudyActivity() {
  const auth = useContext(SessionContext);
  const [activity, setActivity] = useState<Record<string, StudyActivity>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/study/activity", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw Error();
        return response.json() as Promise<StudyActivity[]>;
      })
      .then((items) => {
        if (!controller.signal.aborted)
          setActivity(Object.fromEntries(items.map((a) => [a.key, a])));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setActivity({});
          setError("A atividade dos itens não carregou. Tente novamente.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [auth?.session?.login, revision]);
  return { activity, error, loading, refresh: () => setRevision((v) => v + 1) };
}

export function StudyBadges({ activity }: { activity?: StudyActivity }) {
  const format = (n: number | null | undefined) =>
    n == null ? "—" : n.toLocaleString("pt-BR");
  return (
    <div role="group" aria-label="Atividade do recurso" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1 whitespace-nowrap"><MessageSquareText aria-hidden="true" className="size-3" /><span><strong className="font-medium text-foreground">{format(activity?.comments)}</strong> comentários</span></span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap"><Flame aria-hidden="true" className="size-3" /><span><strong className="font-medium text-foreground">{format(activity?.hypes)}</strong> hypes</span></span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap"><Star aria-hidden="true" className="size-3" /><span>{activity?.ratings ? <><strong className="font-medium text-foreground">{activity.average?.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) ?? "—"}</strong> ({format(activity.ratings)})</> : activity ? "Sem avaliações" : "—"}</span></span>
    </div>
  );
}

// Covers are optional, versioned assets; no third-party thumbnail tracking or fake images.
export function StudyCover({
  resource,
  small = false,
  priority = false,
}: {
  resource: Resource;
  small?: boolean;
  priority?: boolean;
}) {
  const cover = resourceImage(resource);
  const imageSource = imageSources.find(
    (image) => image.key === studyKey(resource),
  );
  return (
    <div
      aria-hidden="true"
      style={
        cover
          ? {
              backgroundColor: imageSource?.background,
            }
          : undefined
      }
      className={
        small
          ? "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded bg-muted/50"
          : "flex h-28 items-center justify-center overflow-hidden rounded-t-lg border-b bg-muted/40"
      }
    >
      {cover ? (
        <LoadingImage
          src={cover}
          alt=""
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          className="h-full min-h-0 w-full min-w-0"
          imageClassName={resource.type !== "books" && imageSource?.kind === "social" ? "object-cover" : resource.type === "books" ? "object-contain p-3" : "object-contain p-2"}
          fallback={<span className="flex size-full items-center justify-center"><BookOpen className={small ? "size-5 text-primary/70" : "size-9 text-primary/60"} /></span>}
        />
      ) : (
        <BookOpen
          className={
            small ? "size-5 text-primary/70" : "size-9 text-primary/60"
          }
        />
      )}
    </div>
  );
}

export function StudyListing({
  category,
  items,
  title,
  query,
  onSearch,
}: {
  category: string;
  items: Resource[];
  title: string;
  query: string;
  onSearch: (value: string) => void;
}) {
  const { activity, error, loading, refresh } = useStudyActivity();
  const [sort, setSort] = useState<StudySort>("hypes");
  const [view, setView] = useState("cards");
  const [page, setPage] = useState(1);
  const [institution, setInstitution] = useState("all");
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      const sort = params.get("ordem");
      const institution = params.get("instituicao");
      setInstitution(
        category === "universities" &&
          universityTypes.some((t) => t.id === institution)
          ? institution!
          : "all",
      );
      setSort(
        sort && Object.hasOwn(studySorts, sort) ? (sort as StudySort) : "hypes",
      );
      setView(params.get("visualizacao") === "lista" ? "list" : "cards");
      setPage(readPage(window.location.search));
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [category]);
  useEffect(() => {
    setPage(readPage(window.location.search));
  }, [query]);
  function update(key: string, value: string, reset = true) {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    if (key === "instituicao" && value === "all") url.searchParams.delete(key);
    if (reset) {
      url.searchParams.delete("pagina");
      setPage(1);
    }
    window.history.replaceState(null, "", url);
  }
  const filteredItems =
    category === "universities" && institution !== "all"
      ? items.filter((r) => r.universityType === institution)
      : items;
  const listing = paginate(pinSponsored(rankStudy(filteredItems, activity, sort), "studying"), page);
  const changePage = (next: number) => {
    setPage(next);
    update("pagina", String(next), false);
  };
  const detail = (r: Resource, showActivity = true) => (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <a
          className="text-sm font-semibold after:absolute after:inset-0 after:rounded-lg hover:text-primary focus-visible:outline-none"
          href={resourcePath(r)}
        >
          {r.name}
        </a>
        {r.demo && <Badge variant="outline">Exemplo</Badge>}
        {isSponsored(r, "studying") && <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300">Patrocinado</Badge>}
        {r.universityType && (
          <Badge variant="outline">
            {universityTypes.find((t) => t.id === r.universityType)?.name}
          </Badge>
        )}
      </div>
      <p className="my-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {r.summary}
      </p>
      {showActivity && <StudyBadges activity={activity[studyKey(r)]} />}
    </>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <span aria-live="polite" className="text-xs text-muted-foreground">
          {listing.pages > 1
            ? `${listing.start}–${listing.end} de ${filteredItems.length} itens`
            : `${filteredItems.length} ${filteredItems.length === 1 ? "item na lista" : "itens na lista"}`}
        </span>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as StudySort);
              update("ordem", value);
            }}
          >
            <SelectTrigger
              aria-label="Ordenar por"
              size="sm"
              className="h-8 w-40 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(studySorts).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {category === "universities" && (
            <Select
              value={institution}
              onValueChange={(value) => {
                setInstitution(value);
                update("instituicao", value);
              }}
            >
              <SelectTrigger
                aria-label="Tipo de instituição"
                size="sm"
                className="h-8 w-40 text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as instituições</SelectItem>
                {universityTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <ResourceSearch value={query} onChange={onSearch} />
          <div
            role="group"
            aria-label="Visualização da listagem"
            className="flex gap-1"
          >
            <Button
              size="icon-sm"
              variant={view === "cards" ? "default" : "outline"}
              aria-label="Exibir cards"
              aria-pressed={view === "cards"}
              onClick={() => {
                setView("cards");
                update("visualizacao", "cards", false);
              }}
            >
              <LayoutGrid />
            </Button>
            <Button
              size="icon-sm"
              variant={view === "list" ? "default" : "outline"}
              aria-label="Exibir lista"
              aria-pressed={view === "list"}
              onClick={() => {
                setView("list");
                update("visualizacao", "lista", false);
              }}
            >
              <List />
            </Button>
          </div>
        </div>
      </div>
      {loading && (
        <p role="status" className="text-xs text-muted-foreground">
          Carregando avaliações e atividade…
        </p>
      )}
      {error && (
        <div role="alert" className="flex items-center gap-2 text-xs">
          <p>{error}</p>
          <Button size="xs" variant="outline" onClick={refresh}>
            Tentar novamente
          </Button>
        </div>
      )}
      {filteredItems.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground">
          {query || institution !== "all"
            ? "Nenhum resultado para esta pesquisa."
            : "Ainda não há itens nesta categoria. Sugira o primeiro."}
        </p>
      ) : view === "cards" ? (
        <div
          aria-label={`Cards: ${title}`}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {listing.items.map((r, index) => (
            <ResourcePreview key={studyKey(r)} resource={r}>
            <article
              data-motion
              key={studyKey(r)}
              className={`relative flex min-w-0 cursor-pointer flex-col rounded-lg border bg-card transition-colors hover:bg-muted/30 focus-within:bg-muted/30 focus-within:outline-2 focus-within:outline-ring ${isSponsored(r, "studying") ? 'border-l-4 border-l-amber-500 bg-amber-500/5' : ''}`}
            >
              <div className="flex flex-1 flex-col p-3">
                <div className="flex flex-1 flex-col">
                  <div className="flex min-w-0 items-start gap-3">
                    <a href={resourcePath(r)} tabIndex={-1} aria-hidden="true" className="relative z-10 rounded">
                      <StudyCover small resource={r} priority={index < 4} />
                    </a>
                    <div className="min-w-0 flex-1">{detail(r, false)}</div>
                  </div>
                  <div className="mt-3"><StudyBadges activity={activity[studyKey(r)]} /></div>
                </div>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full"
                >
                  <a href={resourcePath(r)}>Ver detalhes</a>
                </Button>
              </div>
            </article>
            </ResourcePreview>
          ))}
        </div>
      ) : (
        <div
          aria-label={`Lista: ${title}`}
          className="divide-y rounded-lg border bg-card"
        >
          {listing.items.map((r, index) => (
            <ResourcePreview key={studyKey(r)} resource={r}>
            <article
              data-motion
              key={studyKey(r)}
              className={`relative flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/30 focus-within:bg-muted/30 focus-within:outline-2 focus-within:outline-ring ${isSponsored(r, "studying") ? 'border-l-4 border-l-amber-500 bg-amber-500/5' : ''}`}
            >
              <StudyCover small resource={r} priority={index < 4} />
              <div className="min-w-0 flex-1">{detail(r)}</div>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="hidden sm:inline-flex"
              >
                <a href={resourcePath(r)}>Ver detalhes</a>
              </Button>
            </article>
            </ResourcePreview>
          ))}
        </div>
      )}
      <ResourcePagination
        page={listing.page}
        pages={listing.pages}
        onChange={changePage}
      />
    </div>
  );
}

export function StudyDetail({ resource }: { resource: Resource }) {
  const auth = useContext(SessionContext);
  const { activity, error, loading, refresh } = useStudyActivity();
  const a = activity[studyKey(resource)];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [body, setBody] = useState("");
  const id = useId();
  async function publish(kind: "vote" | "comments", data: unknown) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/study/${studyKey(resource)}/${kind}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": auth?.session?.csrfToken || "",
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(
          result.error || "Entre novamente com o GitHub para participar.",
        );
      setMessage(
        kind === "vote" ? "Avaliação salva." : "Comentário publicado no fórum.",
      );
      if (kind === "comments") setBody("");
      refresh();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Não conseguimos salvar. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Avaliações e discussão" className="space-y-4">
      <section aria-label="Avaliações" className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Avaliações</h2>
            <p className="text-xs text-muted-foreground">Você pode dar uma nota e um hype por conta.</p>
          </div>
          <StudyBadges activity={a} />
        </div>
        {(loading || error) && <div className="border-b px-4 py-2 sm:px-5">{loading && <p role="status" className="text-xs text-muted-foreground">Carregando atividade…</p>}
         {error && ( 
          <div role="alert" className="flex-items center gap-2 text-xs"> 
            <p  className="text-xs text-destructive">{error} <Button 
                                                              type="button" 
                                                              size="xs" 
                                                              variant="outline" 
                                                              className="bg-transparente b-0 p-0 font-inherit inline underline cursor pointer border-none"
                                                              onClick={refresh}>tentar novamente</Button>
            </p> 
          </div>)} 
          </div>}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          {resource.demo ? (
            <p className="text-sm text-muted-foreground">Este item é fictício e não recebe avaliações ou comentários.</p>
          ) : !auth?.session?.login ? (
            <Button size="sm" disabled={auth?.loading || auth?.pending || !auth?.session?.enabled} onClick={auth?.startLogin}>Entrar com GitHub para avaliar</Button>
          ) : (
            <>
              <fieldset disabled={busy || loading || !!error} className="flex items-center gap-3">
                <legend className="sr-only">Sua nota</legend>
                <span aria-hidden="true" className="text-sm font-medium">Sua nota</span>
                <div role="radiogroup" aria-label="Nota de 1 a 5 estrelas" className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Button
                      key={n}
                      role="radio"
                      aria-checked={a?.myRating === n}
                      tabIndex={n === (a?.myRating || 1) ? 0 : -1}
                      onKeyDown={(event) => {
                        const direction = ["ArrowRight", "ArrowUp"].includes(event.key) ? 1 : ["ArrowLeft", "ArrowDown"].includes(event.key) ? -1 : 0;
                        if (direction) {
                          event.preventDefault();
                          const next = Math.max(1, Math.min(5, n + direction));
                          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next - 1]?.focus();
                          void publish("vote", { rating: next });
                        }
                      }}
                      aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => void publish("vote", { rating: n })}
                    >
                      <Star className={n <= (a?.myRating || 0) ? "fill-primary text-primary" : "text-muted-foreground"} />
                    </Button>
                  ))}
                </div>
              </fieldset>
              <Button size="sm" disabled={busy || loading || !!error} variant={a?.myHype ? "default" : "outline"} aria-pressed={a?.myHype || false} onClick={() => void publish("vote", { hype: !a?.myHype })}>
                <Flame aria-hidden="true" />{a?.myHype ? "Remover hype" : "Dar hype"}
              </Button>
            </>
          )}
        </div>
        {message && <p role="status" className="border-t px-4 py-2 text-xs text-muted-foreground sm:px-5">{message}</p>}
      </section>
      {!a?.discussion && !resource.demo && !!auth?.session?.login && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void publish("comments", { body });
              }}
              className="space-y-3 rounded-lg border bg-card p-4 sm:p-6"
            >
              <h2 className="text-xl font-semibold">Discussão</h2>
              <label htmlFor={id} className="text-sm font-medium">
                Comente sua experiência
              </label>
              <Textarea
                id={id}
                required
                maxLength={9000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                disabled={busy || loading || !!error}
              />
              <p className="text-xs text-muted-foreground">
                Seu comentário aparecerá no Guia e no GitHub com o nome de{" "}
                {auth?.session?.login}, na discussão deste recurso.
              </p>
              <Button
                type="submit"
                disabled={busy || loading || !!error || !body.trim()}
              >
                {busy ? "Publicando…" : "Publicar comentário"}
              </Button>
            </form>
      )}
      {a?.discussion ? (
        <DiscussionThread
          key={a.discussion}
          number={a.discussion}
          embedded
          onPublished={refresh}
        />
      ) : (
        !(auth?.session?.login && !resource.demo) && <section aria-label="Discussão" className="space-y-2 rounded-lg border bg-card p-4 sm:p-6"><h2 className="text-xl font-semibold">Discussão</h2><p className="text-sm text-muted-foreground">Ainda não há uma conversa para este item.</p></section>
      )}
    </section>
  );
}
