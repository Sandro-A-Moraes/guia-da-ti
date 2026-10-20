import { useContext, useEffect, useRef, useState } from 'react';
import { SessionContext, LoginButton } from './Participation';
import { useContributionToast } from './ContributionToasts';
import { ContributionWizard } from './ContributionWizard';
import { ContributionPreview } from './ContributionPreview';
import { contributionCopy } from './contribution-copy';
import { SelectField } from './SelectField';
import { ComboboxField } from './ComboboxField';
import { CreatorAvatar, useCreatorProfile, followersLabel } from './CreatorProfile';
import { creatorCategories } from './creator-categories';
import { universityTypes } from './university-options';
import { categories, labels, taxonomy } from './catalog';
import { requestBrazilStates } from './brazil-states';
import { brazilRegions, type CommunityLocation } from './community-location';
import { communityAudiences, communityCategoryOrder, communityModalities, communityPlatforms } from './community-options';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

const typeNames: Record<string, string> = { courses: 'Cursos', platforms: 'Plataformas de cursos', universities: 'Faculdades', bootcamps: 'Bootcamps', roadmaps: 'Roadmaps', books: 'Livros', certifications: 'Certificações', news: 'Notícias', blogs: 'Blogs', newsletters: 'Newsletters', podcasts: 'Podcasts', youtube: 'YouTube', creators: 'Criadores', articles: 'Artigos', tutorials: 'Tutoriais', studies: 'Estudos', 'case-studies': 'Estudos de caso', reports: 'Relatórios', communities: 'Comunidades', events: 'Eventos', meetups: 'Meetups', conferences: 'Conferências', hackathons: 'Hackathons', tools: 'Ferramentas', 'open-source': 'Projetos open source', challenges: 'Desafios', labs: 'Laboratórios', jobs: 'Sites de vagas', scholarships: 'Bolsas de estudo', mentoring: 'Programas de mentoria', volunteering: 'Programas de voluntariado' };

export function ResourceContribution({initialCategory = "", onSubmitted}: {initialCategory?: string; onSubmitted?: () => void}) {
  const notify = useContributionToast();
  const session = useContext(SessionContext)?.session;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [successUrl, setSuccessUrl] = useState('');
  const successLinkLabel = 'Acompanhar PR';
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
    void requestBrazilStates().then(map => {
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
      if (typeof result.url !== 'string') throw Error('O GitHub não retornou o link do PR. Confira seus Pull Requests antes de enviar novamente.');
      setSuccess('PR aberto para revisão. O cadastro entra no guia após o merge e a publicação do catálogo.');
      setSuccessUrl(result.url);
      notify(result.notice ?? { id: crypto.randomUUID(), login: session.login, name: proposal.name, category: proposal.type, url: result.url });
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
  if (!session?.login) return <div className="space-y-3 rounded-lg border p-5"><p>Entre com o GitHub para enviar uma sugestão. Cada envio abre um PR para revisão dos mantenedores.</p><LoginButton /></div>;
  return <ContributionWizard preview={<ContributionPreview name={name} summary={summary} description={description} category={typeNames[type] || type} area={labels[area] || area} languages={languages} image={imagePreview || imageUrl} url={url} details={[
      ['Tecnologias', technologies.map(id => labels[id] || id).join(', ')],
      ['Tipo de instituição', type === 'universities' ? universityTypes.find(item => item.id === universityType)?.name || '' : ''],
      ['Conteúdo', creatorCategory ? creatorCategories.filter(item => creatorCategoryIds.includes(item.id)).map(item => item.name).join(', ') : ''],
      ['Localização', type === 'communities' ? communityScope === 'national' ? 'Brasil inteiro' : communityScope === 'international' ? 'Internacional' : communityStates.join(', ') : ''],
      ['Público', type === 'communities' ? communityAudiences.find(item => item.id === communityAudience)?.name || '' : ''],
      ['Membros', type === 'communities' && memberCount ? (moreThan ? 'Mais de ' : '') + Number(memberCount).toLocaleString('pt-BR') : ''],
      ['Plataformas', type === 'communities' ? communityPlatforms.filter(item => communityPlatformIds.includes(item.id)).map(item => item.name).join(', ') : ''],
      ['Modalidade', type === 'communities' ? communityModalities.find(item => item.id === communityModality)?.name || '' : ''],
    ]} />} onSubmit={submit} category={type} busy={busy} rules={{ 'Categoria da comunidade': !!area, 'Categoria do guia': !!type, ...(type === 'universities' ? { 'Tipo de instituição': !!universityType } : {}), 'Categorias de conteúdo': !!creatorCategoryIds.length, 'Localização da comunidade': !!communityScope && (communityScope !== 'regional' || !!communityStates.length), 'Público da comunidade': !!communityAudience, 'Modalidade': !!communityModality, 'Plataformas da comunidade': !!communityPlatformIds.length && communityPlatformIds.every(id => !!communityUrls[id]?.trim()), 'Idiomas disponíveis': !!languages.length }} footer={<>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{success && <p role="status" className="text-sm text-muted-foreground">{success} <a className="text-primary underline" href={successUrl}>{successLinkLabel}</a></p>}</>}>
    <div data-step-title="Categoria do guia" className="space-y-3"><SelectField label="Categoria do guia" name="type" required value={type} onChange={setType} placeholder="Escolha uma categoria" options={taxonomy.types.map((id: string) => ({id, name:typeNames[id] || categories.find(category => category.id === id)?.name || id}))} />{['jobs', 'scholarships', 'mentoring', 'volunteering'].includes(type) && <p className="text-xs text-muted-foreground">Sugira o site ou a página do programa. Consulte vagas e inscrições na fonte, sem cadastrar anúncios individuais.</p>}</div>
    {type === 'universities' && <div data-step-title="Tipo de instituição"><SelectField label="Tipo de instituição" name="universityType" required value={universityType} onChange={setUniversityType} placeholder="Escolha o tipo" options={universityTypes.map(t => ({...t}))} /></div>}
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
    <div data-step-title="Revisar e enviar" className="space-y-5"><dl className="grid gap-4 text-sm sm:grid-cols-2">{[['Categoria',typeNames[type] || type],[copy.name,name],[copy.url,url],[copy.summary,summary],[copy.description,description],['Assunto',labels[area] || area],['Idiomas',languages.join(', ')]].map(([label,value])=><div key={label} className="min-w-0 space-y-1"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{value || 'Não informado'}</dd></div>)}</dl><p className="text-xs text-muted-foreground">Sua sugestão abre um PR para revisão dos mantenedores. O fórum continua separado para conversas. O cadastro entra no guia após o merge e a publicação do catálogo.</p>
    <Button type="submit" disabled={busy || !type || !area || !languages.length || type === 'universities' && !universityType || creatorCategory && !creatorCategoryIds.length || type === 'communities' && (!communityAudience || !communityScope || communityScope === 'regional' && !communityStates.length || !communityModality || !communityPlatformIds.length || communityPlatformIds.some(id=>!communityUrls[id]?.trim()))}>{busy ? 'Enviando…' : 'Enviar para revisão'}</Button>
    </div>
  </ContributionWizard>;
}
