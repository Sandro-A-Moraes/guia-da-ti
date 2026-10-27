import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SessionContext, LoginButton } from './Participation';
import { useContributionToast } from './ContributionToasts';
import { ContributionWizard } from './ContributionWizard';
import { SelectField } from './SelectField';
import { RoadmapTreeEditor } from './RoadmapTreeEditor';
import { RoadmapView } from './RoadmapView';
import { labels, resources, taxonomy, type Resource } from './catalog';
import { clearDraft, emptyForm, formFromSource, isEditConflict, outlineText, readDraft, roadmapSlug, toProposal, writeDraft, type RoadmapForm } from './roadmap-editor';
import { roadmapLevels } from './roadmap-view';
import { countNodes, treeProblems } from './roadmap-tree';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Source = { status: 'loading' } | { status: 'ready' } | { status: 'missing' | 'unauthorized' | 'error'; message: string };
const levelOptions = Object.entries(roadmapLevels).map(([id, name]) => ({ id, name }));
const same = (a: RoadmapForm, b: RoadmapForm) => JSON.stringify(a) === JSON.stringify(b);

export function RoadmapEditor({ slug, onSubmitted }: { slug?: string; onSubmitted?: () => void }) {
  const notify = useContributionToast();
  const session = useContext(SessionContext)?.session;
  const login = session?.login;
  const [source, setSource] = useState<Source>(slug ? { status: 'loading' } : { status: 'ready' });
  const [baseSha, setBaseSha] = useState<string>();
  const [original, setOriginal] = useState<RoadmapForm>(emptyForm);
  const [form, setForm] = useState<RoadmapForm>(emptyForm);
  const [restored, setRestored] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState('');
  const [done, setDone] = useState<{ url: string } | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const ready = source.status === 'ready';

  // Opens the draft kept in this browser, unless the roadmap changed since it was saved.
  const open = useCallback((base: RoadmapForm, sha?: string) => {
    setOriginal(base); setBaseSha(sha);
    const draft = readDraft(slug);
    const usable = draft && (!slug || draft.baseSha === sha) && !same(draft.form, base);
    setForm(usable ? draft.form : base); setRestored(!!usable);
    setSource({ status: 'ready' });
  }, [slug]);

  const loadSource = useCallback(async (signal?: AbortSignal) => {
    if (!slug) { open(emptyForm()); return; }
    setSource({ status: 'loading' });
    try {
      const response = await fetch(`/api/roadmaps/${encodeURIComponent(slug)}/source`, { signal, cache: 'no-store' });
      if (signal?.aborted) return;
      if (response.status === 404) { setSource({ status: 'missing', message: 'Não encontramos este roadmap.' }); return; }
      if (response.status === 401) { setSource({ status: 'unauthorized', message: 'Entre com o GitHub para editar.' }); return; }
      if (!response.ok) throw Error();
      const data = await response.json() as { sha: string; roadmap: Parameters<typeof formFromSource>[0] };
      if (!signal?.aborted) open(formFromSource(data.roadmap), data.sha);
    } catch { if (!signal?.aborted) setSource({ status: 'error', message: 'Não foi possível abrir o roadmap. Tente novamente.' }); }
  }, [slug, open]);

  useEffect(() => {
    if (!login) return;
    const controller = new AbortController();
    void loadSource(controller.signal);
    return () => controller.abort();
  }, [login, loadSource]);

  // The draft is saved a moment after the last change.
  useEffect(() => {
    if (!ready || done) return;
    const timer = window.setTimeout(() => { if (same(form, original)) clearDraft(slug); else writeDraft(slug, { baseSha, form }); }, 500);
    return () => window.clearTimeout(timer);
  }, [form, original, ready, done, slug, baseSha]);

  const set = <K extends keyof RoadmapForm>(key: K, value: RoadmapForm[K]) => setForm(current => ({ ...current, [key]: value }));
  const toggle = (key: 'technologies' | 'languages', id: string, checked: boolean) => setForm(current => ({ ...current, [key]: checked ? [...current[key], id] : current[key].filter(item => item !== id) }));

  const address = slug ?? roadmapSlug(form.name);
  const taken = !slug && !!address && resources.some(resource => resource.type === 'roadmaps' && resource.slug === address);
  const problems = treeProblems(form.sections);
  const nodes = countNodes(form.sections);
  const preview: Resource = useMemo(() => ({
    slug: address || 'novo', type: 'roadmaps', name: form.name, summary: form.summary, description: form.description, areas: form.area ? [form.area] : [],
    technologies: form.technologies, languages: form.languages, updatedAt: new Date().toISOString().slice(0, 10),
    roadmap: { level: form.level || 'beginner', sectionCount: form.sections.length, stepCount: nodes },
  }), [address, form, nodes]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!login || !session || busy || !accepted) return;
    setBusy(true); setError(''); setConflict('');
    try {
      let imageUploadId: string | undefined;
      if (imageFile) {
        const data = new FormData(); data.append('image', imageFile);
        const uploaded = await fetch('/api/contributions/images', { method: 'POST', headers: { 'X-CSRF-Token': session.csrfToken }, body: data });
        const result = await uploaded.json().catch(() => ({}));
        if (!uploaded.ok) throw Error(result.error || 'A imagem não foi enviada. Tente novamente.');
        imageUploadId = result.id;
      }
      const response = await fetch('/api/roadmaps/proposals', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken }, body: JSON.stringify(toProposal(form, { slug, baseSha, imageUploadId })) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (isEditConflict(result.error)) setConflict(result.error);
        throw Error(result.error || 'Não foi possível enviar o roadmap.');
      }
      if (typeof result.url !== 'string') throw Error('O GitHub não retornou o link do PR. Confira seus Pull Requests antes de enviar novamente.');
      clearDraft(slug);
      notify(result.notice ?? { id: crypto.randomUUID(), login, name: form.name.trim(), category: 'roadmaps', url: result.url });
      setDone({ url: result.url });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível enviar o roadmap.'); }
    finally { setBusy(false); }
  }

  if (!login) return <div className="space-y-3 rounded-lg border p-5"><p>Entre com o GitHub para montar um roadmap. Cada envio abre um PR para revisão dos mantenedores.</p><LoginButton /></div>;
  if (source.status === 'loading') return <p role="status" className="text-sm text-muted-foreground">Abrindo o roadmap…</p>;
  if (source.status !== 'ready') return <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive"><p>{source.message}</p>{source.status === 'error' && <Button type="button" size="sm" variant="outline" onClick={() => void loadSource()}>Tentar novamente</Button>}</div>;
  if (done) return <div role="status" className="space-y-3 rounded-lg border p-5">
    <p className="font-medium">PR aberto para revisão.</p>
    <p className="text-sm text-muted-foreground">O {slug ? 'ajuste entra' : 'roadmap entra'} no guia após o merge e a publicação do catálogo.</p>
    <div className="flex flex-wrap gap-2"><Button asChild><a href={done.url}>Acompanhar PR</a></Button><Button type="button" variant="outline" onClick={() => onSubmitted?.()}>Fechar</Button></div>
  </div>;

  const reviewItems: [string, string][] = [['Nome', form.name], ['Resumo', form.summary], ['Descrição', form.description], ['Assunto', labels[form.area] || form.area], ['Nível', form.level ? roadmapLevels[form.level] : ''],
    ['Idiomas', form.languages.join(', ')], ['Endereço', `/roadmaps/${address}`], ['Estrutura', `${form.sections.length} blocos e ${nodes} etapas e subetapas`]];
  const canSend = !busy && accepted && !!form.area && !!form.level && !!form.languages.length && !problems.length && !taken;
  return <ContributionWizard category={slug ?? 'novo'} busy={busy} onSubmit={submit}
    rules={{ 'Identificação': !taken, 'Classificação': !!form.area && !!form.level && !!form.languages.length, 'Estrutura': !problems.length }}
    footer={<div className="space-y-3">
      {restored && <Alert role="status"><AlertTitle>Rascunho recuperado</AlertTitle><AlertDescription><p>Continuamos de onde você parou neste navegador.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => { clearDraft(slug); setForm(original); setRestored(false); }}>Descartar rascunho</Button></AlertDescription></Alert>}
      {conflict && <Alert role="alert" variant="destructive"><AlertTitle>O roadmap mudou</AlertTitle><AlertDescription>
        <p>{conflict}</p>
        <p>Abrir de novo carrega a versão atual e troca o que você digitou. Copie seu texto antes, se quiser guardar.</p>
        <Textarea readOnly rows={5} aria-label="Seu texto, para copiar" value={outlineText(form)} className="w-full text-xs" />
        <Button type="button" size="sm" variant="outline" onClick={() => { clearDraft(slug); setConflict(''); setError(''); setAccepted(false); void loadSource(); }}>Abrir o editor de novo</Button>
      </AlertDescription></Alert>}
      {error && !conflict && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>}>
    <div data-step-title="Identificação" className="space-y-4">
      <Label className="block space-y-2 text-sm font-medium">Nome do roadmap<Input name="name" required minLength={2} maxLength={100} value={form.name} onChange={event => set('name', event.target.value)} placeholder="Ex.: Front-end para quem está começando" /></Label>
      {slug ? <p className="text-xs text-muted-foreground">O endereço continua /roadmaps/{slug}.</p> : address && <p className={`text-xs ${taken ? 'text-destructive' : 'text-muted-foreground'}`} role={taken ? 'alert' : undefined}>{taken ? `Já existe um roadmap em /roadmaps/${address}. Edite o existente ou escolha outro nome.` : `O endereço será /roadmaps/${address}`}</p>}
      <Label className="block space-y-2 text-sm font-medium">Resumo<Input name="summary" required minLength={10} maxLength={240} value={form.summary} onChange={event => set('summary', event.target.value)} /></Label>
      <Label className="block space-y-2 text-sm font-medium">Descrição<Textarea name="description" required minLength={10} maxLength={4000} rows={5} value={form.description} onChange={event => set('description', event.target.value)} className="w-full text-sm font-normal" /></Label>
      <p className="text-xs text-muted-foreground">Diga para quem é o roadmap e o que a pessoa sabe fazer ao final.</p>
      <div className="space-y-2">
        <Label className="grid gap-2 text-sm font-medium">Enviar imagem (opcional)<Input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => {
          const file = event.target.files?.[0] || null;
          if (file && (file.size > 2 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) { setImageError('Escolha uma imagem PNG, JPG ou WebP de até 2 MB.'); setImageFile(null); event.target.value = ''; return; }
          setImageError(''); setImageFile(file); if (file) set('imageUrl', '');
        }} /></Label>
        <Label className="grid gap-2 text-sm font-medium">Ou usar link da imagem<Input name="imageUrl" type="url" maxLength={500} placeholder="https://" value={form.imageUrl} disabled={busy || !!imageFile} onChange={event => set('imageUrl', event.target.value)} /></Label>
        {imageFile && <Button type="button" size="sm" variant="outline" onClick={() => { setImageFile(null); if (imageInput.current) imageInput.current.value = ''; }}>Remover arquivo</Button>}
        {imageError && <p role="alert" className="text-sm text-destructive">{imageError}</p>}
      </div>
    </div>
    <div data-step-title="Classificação" className="space-y-4">
      <SelectField label="Assunto principal" name="area" required value={form.area} onChange={value => set('area', value)} placeholder="Escolha um assunto" options={taxonomy.areas.map((id: string) => ({ id, name: labels[id] || id }))} />
      <SelectField label="Nível de quem vai estudar" name="level" required value={form.level} onChange={value => set('level', value as RoadmapForm['level'])} placeholder="Escolha o nível" options={levelOptions} />
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Tecnologias (opcional)</legend><div className="flex flex-wrap gap-4">{taxonomy.technologies.map((id: string) => <Label key={id} className="flex items-center gap-2 text-sm"><Checkbox checked={form.technologies.includes(id)} onCheckedChange={checked => toggle('technologies', id, checked === true)} />{labels[id] || id}</Label>)}</div></fieldset>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Idiomas dos materiais</legend><div className="flex flex-wrap gap-4">{taxonomy.languages.map((id: string) => <Label key={id} className="flex items-center gap-2 text-sm"><Checkbox checked={form.languages.includes(id)} onCheckedChange={checked => toggle('languages', id, checked === true)} />{id}</Label>)}</div></fieldset>
    </div>
    <div data-step-title="Estrutura" className="space-y-3">
      <p className="text-sm text-muted-foreground">Monte os blocos e as etapas na ordem de estudo. Cada etapa pode apontar para recursos do catálogo.</p>
      <RoadmapTreeEditor sections={form.sections} onChange={sections => set('sections', sections)} disabled={busy} />
    </div>
    <div data-step-title="Revisar e enviar" className="space-y-5">
      <dl className="grid gap-4 text-sm sm:grid-cols-2">{reviewItems.map(([label, value]) => <div key={label} className="min-w-0 space-y-1"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{value || 'Não informado'}</dd></div>)}</dl>
      <div className="max-h-96 overflow-y-auto rounded-lg border p-3 sm:p-4"><RoadmapView resource={preview} tree={{ level: form.level || 'beginner', sections: form.sections }} /></div>
      <Label className="flex items-start gap-2 text-sm font-normal"><Checkbox checked={accepted} onCheckedChange={checked => setAccepted(checked === true)} className="mt-0.5" />Entendo que o conteúdo enviado entra no catálogo público do Guia.</Label>
      <p className="text-xs text-muted-foreground">Sua sugestão abre um PR para revisão dos mantenedores. {slug ? 'O ajuste entra' : 'O roadmap entra'} no guia após o merge e a publicação do catálogo.</p>
      <Button type="submit" disabled={!canSend}>{busy ? 'Enviando…' : 'Enviar para revisão'}</Button>
    </div>
  </ContributionWizard>;
}
