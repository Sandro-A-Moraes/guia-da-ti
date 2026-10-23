import {ContributionDialog} from './ContributionDialog';
import { SectionGuide } from './UserGuide';
import { GuideLanding } from './GuideLanding';
import { guideSectionForGroup } from './guide-steps';
import {openContribution} from './contribution-actions';
import { useEffect, useState, type ReactNode } from 'react';
import { Discussions } from './Discussions';
import { StudyCover, StudyDetail, StudyListing } from './Study';
import { studyTypes } from './study-ranking';
import { ResourcePreview } from './ResourcePreview';
import { resourceImage } from './resource-image';
import { shouldOpenRow, openRowLink } from './row-navigation';
import { Community } from './Community';
import { Companies } from './Companies';
import { Advertisement } from './Advertisement';
import { isSponsored, pinSponsored, type SponsoredPlacement } from './sponsored-resources';
import { AdvertisingAdmin } from './AdvertisingAdmin';
import { CommunityTabs } from './CommunityTabs';
import { CommunityFiltersDialog } from './CommunityFiltersDialog';
import { SuggestResource } from './SuggestResource';
import { communityAudiences, communityMembersLabel, communityPlatforms, communityModalities } from './community-options';
import { compareCommunities, matchesCommunityFilters, readCommunityFilters, emptyCommunityFilters, type CommunityFilters } from './community-location';
import { CreatorTabs, PlatformTabsRoot, PlatformTabPanel, creatorNetworks } from './CreatorTabs';
import { CreatorAvatar, useCreatorProfile, followersLabel } from './CreatorProfile';
import { creatorCategories, creatorCategoryLabels, readCreatorCategory } from './creator-categories';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResourcePagination } from './ResourcePagination';
import { paginate, readPage } from './pagination';
import { ResourceSearch } from './ResourceSearch';
import { matchesResourceSearch, readSearch } from './resource-search';
import { ActiveUsers, CommunityMetricsProvider } from './CommunityMetrics';
import { MaintainersProvider } from './Maintainers';
import { ContributionToasts } from './ContributionToasts';
import { NavigationCard } from './NavigationCard';
import { BrandMark } from './BrandMark';
import { Motion } from './Motion';
import { Participation, UserControls } from './Participation';
import { ArrowLeft, ArrowUpRight, Award, BookOpen, BriefcaseBusiness, CalendarDays, ChevronDown, Code, ExternalLink, FileText, FlaskConical, Github, Globe2, GraduationCap, Headphones, Instagram, Linkedin, Mail, Map, Menu, Newspaper, Pin, Twitter, Users, Wrench, X, Youtube, type LucideIcon } from 'lucide-react';
import { Accordion } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from '@/components/ui/navigation-menu';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Dialog } from 'radix-ui';
import { categories, groups, labels, pageInfo, resourcePath, resources, type Resource } from './catalog';

const repositoryValue = import.meta.env.VITE_DATA_REPOSITORY || 'https://github.com/guia-da-ti/guia-da-ti-dados';
const repository = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(repositoryValue) ? repositoryValue.replace(/\/$/, '') : '';

const resourceIcons: Record<string, LucideIcon> = {
  courses: GraduationCap, platforms: BookOpen, universities: GraduationCap, bootcamps: Code, roadmaps: Map, books: BookOpen, certifications: Award,
  news: Newspaper, blogs: FileText, newsletters: Mail, podcasts: Headphones, youtube: Youtube, creators: Users, articles: FileText, tutorials: Code,
  studies: FlaskConical, 'case-studies': BriefcaseBusiness, reports: FileText, communities: Users, events: CalendarDays, meetups: Users,
  conferences: CalendarDays, hackathons: Code, tools: Wrench, 'open-source': Code, challenges: Award, labs: FlaskConical, jobs: BriefcaseBusiness,
  scholarships: BookOpen, mentoring: Users, volunteering: Users,
};
const platformIcons: Record<string, LucideIcon> = { youtube: Youtube, instagram: Instagram, linkedin: Linkedin, twitter: Twitter, tiktok: Globe2 };
const dialogTypes = new Set(['articles', 'tutorials', 'studies', 'case-studies', 'reports', 'news', 'blogs', 'newsletters', 'podcasts', 'communities']);
const profileTypes = new Set(['creators', 'youtube']);

function resourceExtra(resource: Resource) {
  if (resource.type === 'communities') {
    const location = resource.communityLocation;
    return location?.scope === 'national' ? 'Brasil inteiro' : location?.scope === 'international' ? 'Internacional' :
      location?.scope === 'regional' ? location.states?.join(' · ') || '' : 'Localização não informada';
  }
  if (profileTypes.has(resource.type)) {
    try { return new URL(resource.url).hostname.replace(/^www\./, ''); } catch { return 'Perfil externo'; }
  }
  if (['jobs', 'scholarships', 'events', 'meetups', 'conferences', 'hackathons'].includes(resource.type)) {
    return resource.countries?.length ? resource.countries.map(country => labels[country] || country).join(' · ') : resource.areas.map(area => labels[area] || area).join(' · ');
  }
  if (resource.technologies.length) return resource.technologies.map(technology => labels[technology] || technology).join(' · ');
  return resource.areas.map(area => labels[area] || area).join(' · ');
}

function ResourceIcon({ resource, platform }: { resource: Resource; platform: string | null }) {
  const Icon = platformIcons[platform || resource.type] || resourceIcons[resource.type] || Globe2;
  return <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded bg-muted/50 text-primary"><Icon className="size-3.5" /></span>;
}

function ResourceDetailDialog({ resource, extra }: { resource: Resource; extra: string }) {
  return <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/55" /><Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl">
    <div className="relative shrink-0 border-b px-6 py-4 pr-12"><Dialog.Title className="text-xl font-semibold">{resource.name}</Dialog.Title><Dialog.Close aria-label="Fechar detalhes" className="absolute right-4 top-4 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><X aria-hidden="true" className="size-4" /></Dialog.Close></div>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
    <Dialog.Description className="text-sm leading-relaxed text-muted-foreground">{resource.summary}</Dialog.Description>
    {resource.imageUrl && <StudyCover resource={resource} priority />}
    <p className="whitespace-pre-wrap text-sm leading-relaxed">{resource.description}</p>
    {extra && <p className="text-sm text-muted-foreground">{extra}</p>}
    {resource.type==='communities' && <p className="text-sm text-muted-foreground">{[resource.communityAudience && `Público: ${communityAudiences.find(item=>item.id===resource.communityAudience)?.name}`,communityModalities.find(item=>item.id===resource.communityModality)?.name].filter(Boolean).join(' · ')}</p>}
    {resource.communityMembers && <p className="text-sm"><span className="font-medium">{communityMembersLabel(resource.communityMembers)}</span><span className="ml-2 text-xs text-muted-foreground">Informado em {resource.communityMembers.checkedAt.split('-').reverse().join('/')}</span></p>}
    <div className="flex flex-wrap gap-2">{resource.areas.map(area => <Badge asChild variant="outline" key={area}><a href={`/areas/${area}`}>{labels[area] || area}</a></Badge>)}{resource.languages.map(language => <Badge variant="secondary" key={language}>{language}</Badge>)}</div>
    {resource.type==='communities' && !!resource.communityLinks?.length && <div className="space-y-2"><p className="text-sm font-medium">Onde encontrar a comunidade</p><div className="flex flex-wrap gap-2">{resource.communityLinks.map(link=><Button asChild variant="outline" key={link.platform}><a href={link.url} target="_blank" rel="noopener noreferrer">{communityPlatforms.find(item=>item.id===link.platform)?.name}<ArrowUpRight /></a></Button>)}</div></div>}
    </div><div className="flex shrink-0 flex-wrap gap-2 border-t px-6 py-4">{(resource.type!=='communities' || !resource.communityLinks?.length) && <Button asChild><a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.type==='communities'?'Abrir site':'Abrir conteúdo'}<ExternalLink /></a></Button>}<Dialog.Close asChild><Button variant="outline">Fechar</Button></Dialog.Close></div>
  </Dialog.Content></Dialog.Portal>;
}

function ResourceRow({ resource, platform, locationColumn = false, sponsored = false }: { resource: Resource; platform: string | null; locationColumn?: boolean; sponsored?: boolean }) {
  const [open, setOpen] = useState(false);
  const extra = resourceExtra(resource);
  const profile = profileTypes.has(resource.type);
  const { profile: creator, loading: profileLoading } = useCreatorProfile(resource.url, profile && !resource.demo, 0);
  const displayName = creator?.name || resource.name;
  const displaySummary = creator?.description || resource.summary;
  const imageUrl = resourceImage(resource) || creator?.avatarUrl || undefined;
  const communityImageUrl = resource.type === 'communities' && !imageUrl
    ? `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(resource.url)}&sz=128`
    : undefined;
  const dialog = dialogTypes.has(resource.type);
  const href = profile ? resource.url : resourcePath(resource);
  const category = profile ? resource.creatorCategories?.map(id => creatorCategoryLabels[id] || id).join(' · ') || 'Categoria não informada' : categories.find(item => item.id === resource.type)?.name || resource.type;
  const titleClass = 'block max-w-full truncate rounded-sm text-left text-[13px] font-medium leading-5 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring';
  const title: ReactNode = dialog
    ? <Dialog.Trigger asChild><button type="button" className={titleClass}>{resource.name}</button></Dialog.Trigger>
    : <a href={href} target={profile ? '_blank' : undefined} rel={profile ? 'noopener noreferrer' : undefined} className={titleClass}>{displayName}</a>;
  const communityDetails = [
    communityModalities.find(item => item.id === resource.communityModality)?.name,
    ...(resource.communityPlatforms || []).map(id => communityPlatforms.find(item => item.id === id)?.name),
    resource.communityAudience && `Público: ${communityAudiences.find(item => item.id === resource.communityAudience)?.name}`,
    resource.communityMembers && communityMembersLabel(resource.communityMembers),
  ].filter(Boolean).join(' · ');
  const row = <tr className={`cursor-pointer border-t transition-colors hover:bg-muted/30 focus-within:bg-muted/30 ${sponsored ? 'bg-amber-500/5' : ''}`} onClick={event => {
    if (!shouldOpenRow(event)) return;
    if (dialog) setOpen(true); else openRowLink(event, href, profile);
  }}>
    <td className={`px-3 py-2.5 align-middle sm:px-4 ${sponsored ? 'border-l-4 border-l-amber-500' : ''}`}>
      <div className="flex min-w-0 items-center gap-3">
      {(profile || imageUrl || communityImageUrl) && <CreatorAvatar profile={creator} name={displayName} imageUrl={imageUrl || communityImageUrl} loading={profileLoading} />}
      <div className="group relative min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2"><div className="min-w-0">{title}</div>{resource.demo && <Badge variant="outline" className="shrink-0 text-[10px]">Exemplo</Badge>}</div>
        <p className="truncate text-[11px] leading-5 text-muted-foreground" title={sponsored ? `Patrocinado · ${displaySummary}` : displaySummary}>{sponsored && <><Pin aria-hidden="true" className="mr-1 inline size-3 text-amber-700 dark:text-amber-300" /><span className="font-semibold text-amber-700 dark:text-amber-300">Patrocinado</span><span aria-hidden="true"> · </span></>}{displaySummary}</p>
        {resource.type === 'communities' && communityDetails && <p className="truncate text-[11px] text-muted-foreground" title={communityDetails}>{communityDetails}</p>}
        {profile && <p className="text-[11px] text-muted-foreground">{resource.demo ? 'Perfil de exemplo' : followersLabel(creator)}</p>}
        <p className="truncate text-[11px] text-muted-foreground sm:hidden">{category}</p>
      </div>
      </div>
    </td>
    <td className="hidden px-3 py-2.5 align-middle sm:table-cell"><span className="inline-flex max-w-full items-center gap-1.5"><ResourceIcon resource={resource} platform={platform} /><span className="truncate text-xs text-muted-foreground">{locationColumn ? extra : category}</span></span></td>
    <td className="hidden px-3 py-2.5 align-middle font-mono text-[11px] text-muted-foreground lg:table-cell"><time dateTime={resource.updatedAt}>{resource.updatedAt.split('-').reverse().join('/')}</time></td>
  </tr>;
  const preview = <ResourcePreview resource={{ ...resource, name: displayName, description: creator?.description || resource.description, imageUrl: imageUrl || communityImageUrl }} extra={extra} disabled={open}>{row}</ResourcePreview>;
  return dialog ? <Dialog.Root open={open} onOpenChange={setOpen}>{preview}<ResourceDetailDialog resource={resource} extra={extra} /></Dialog.Root> : preview;
}

export function App({ path }: { path: string }) {
  const page = pageInfo(path);
  const home = path === '/';
  const forumPage = path === '/forum';
  const creatorsPage = path === '/criadores';
  const communitiesPage = path === '/comunidades';
  const communitiesActive = communitiesPage || page.category?.id === 'communities';
  const sponsoredPlacement: SponsoredPlacement | null = creatorsPage ? 'creators' : communitiesPage ? 'communities' : page.category && (studyTypes.has(page.category.id) || page.category.id === 'tutorials') ? 'studying' : ['events', 'meetups', 'conferences', 'hackathons'].includes(page.category?.id || '') ? 'networking' : null;
  const [communitySelection, setCommunitySelection] = useState<CommunityFilters>(emptyCommunityFilters);
  const [dark, setDark] = useState(false);
  const [creatorPlatform, setCreatorPlatform] = useState('youtube');
  const [creatorContent, setCreatorContent] = useState('all');
  const [requestedPage, setRequestedPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const platform = creatorsPage ? creatorPlatform : null;

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    function readPlatform() {
      const requested = new URLSearchParams(window.location.search).get('plataforma');
      setCreatorPlatform(creatorNetworks.some(network => network.id === requested) ? requested! : 'youtube');
      setRequestedPage(readPage(window.location.search));
      setSearchQuery(readSearch(window.location.search));
      setCreatorContent(readCreatorCategory(window.location.search));
    }
    readPlatform();
    function readLocation() { setCommunitySelection(readCommunityFilters(window.location.search)); }
    readLocation();
    window.addEventListener('popstate', readPlatform);
    window.addEventListener('popstate', readLocation);
    return () => { window.removeEventListener('popstate', readPlatform); window.removeEventListener('popstate', readLocation); };
  }, []);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.style.colorScheme = next ? 'dark' : 'light';
    setDark(next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch { /* Optional preference. */ }
  }

  function changeCreatorPlatform(value: string) {
    setCreatorPlatform(value);
    setRequestedPage(1);
    const url = new URL(window.location.href);
    url.searchParams.set('plataforma', value);
    url.searchParams.delete('pagina');
    window.history.replaceState(null, '', url);
  }
  function changeCreatorContent(value: string) {
    setCreatorContent(value);
    setRequestedPage(1);
    const url = new URL(window.location.href);
    if (value === 'all') url.searchParams.delete('conteudo'); else url.searchParams.set('conteudo', value);
    url.searchParams.delete('pagina');
    window.history.replaceState(null, '', url);
  }
  function changeCommunityLocation(next: CommunityFilters) {
    setCommunitySelection(next);
    setRequestedPage(1);
    const url = new URL(window.location.href);
    url.searchParams.delete('pagina');
    url.searchParams.delete('alcance'); url.searchParams.delete('estados');
    url.searchParams.delete('categorias'); url.searchParams.delete('ninhos'); url.searchParams.delete('modalidade');
    if (next.scope) url.searchParams.set('alcance', next.scope);
    if (next.scope === 'regional') url.searchParams.set('estados', next.states.join(','));
    if (next.platform === 'all') url.searchParams.delete('plataforma'); else url.searchParams.set('plataforma', next.platform);
    if (!next.audience || next.audience==='all') url.searchParams.delete('publico'); else url.searchParams.set('publico',next.audience);
    window.history.replaceState(null, '', url);
  }
  const filtered = resources.filter(r =>
    matchesResourceSearch(r, searchQuery, {...labels, ...creatorCategoryLabels}) &&
    (!creatorsPage || creatorContent === 'all' || r.creatorCategories?.includes(creatorContent)) &&
    (!communitiesPage || matchesCommunityFilters(r, communitySelection)) &&
    (!page.category || r.type === page.category.id || (page.category.id === 'creators' && r.type === 'youtube')) &&
    (!platform || (platform === 'youtube' && r.type === 'youtube') || (creatorNetworks.find(network => network.id === platform)?.domains || []).some(domain => {
      try { const host = new URL(r.url).hostname.toLowerCase(); return host === domain || host.endsWith(`.${domain}`); }
      catch { return false; }
    })) &&
    (!page.area || r.areas.includes(page.area)) &&
    (!page.technology || r.technologies.includes(page.technology))
  ).sort((a,b) => communitiesPage ? compareCommunities(a,b) : 0);
  const ordered = sponsoredPlacement ? pinSponsored(filtered, sponsoredPlacement) : filtered;
  const listing = paginate(ordered, requestedPage);

  function changeSearch(value: string) {
    setSearchQuery(value);
    setRequestedPage(1);
    const url = new URL(window.location.href);
    if (value.trim()) url.searchParams.set('q', value.trim()); else url.searchParams.delete('q');
    url.searchParams.delete('pagina');
    window.history.replaceState(null, '', url);
  }

  function changePage(next: number) {
    setRequestedPage(next);
    const url = new URL(window.location.href);
    if (next === 1) url.searchParams.delete('pagina'); else url.searchParams.set('pagina', String(next));
    window.history.pushState(null, '', url);
    document.querySelector('[aria-label="Recursos"]')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  return (
    <Motion><ContributionToasts><Participation><ContributionDialog /><CommunityMetricsProvider><MaintainersProvider><div className="flex min-h-dvh flex-col">
      <Button asChild className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50">
        <a href="#conteudo">Pular para o conteúdo</a>
      </Button>
      <Advertisement placement="site-top-banner" />
      <header className="site-header relative shrink-0 bg-background">
        <div className="site-frame header-inner mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-4 sm:px-6">
            <a href="/" aria-label="Guia da TI — página inicial" className="inline-flex shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-ring"><BrandMark /></a>
          <div className="pointer-events-none absolute inset-0 hidden items-center justify-center xl:flex">
          <NavigationMenu viewport={false} aria-label="Principal" className="!static pointer-events-auto min-w-0 flex">
            <NavigationMenuList className="flex-nowrap gap-0.5">
              <NavigationMenuItem><NavigationMenuLink asChild active={home}><a href="/" aria-current={home ? 'page' : undefined}>Início</a></NavigationMenuLink></NavigationMenuItem>
              <NavigationMenuItem><NavigationMenuLink asChild active={forumPage}><a href="/forum" aria-current={forumPage ? 'page' : undefined}>Fórum</a></NavigationMenuLink></NavigationMenuItem>
              <NavigationMenuItem><NavigationMenuLink asChild active={communitiesActive}><a href="/comunidades" aria-current={communitiesActive ? 'page' : undefined}>Comunidades</a></NavigationMenuLink></NavigationMenuItem>
              {groups.filter(group => group.id !== 'communities').map(group => ['creators'].includes(group.id) ? (
                <NavigationMenuItem key={group.id}><NavigationMenuLink asChild active={page.category?.id === group.id}><a href={'/' + group.categories[0].route} aria-current={page.category?.id === group.id ? 'page' : undefined}>{group.name}</a></NavigationMenuLink></NavigationMenuItem>
              ) : (
                <NavigationMenuItem key={group.id} value={group.id} className="!static">
                  <NavigationMenuTrigger
                    className="data-[current=true]:bg-accent data-[current=true]:text-primary"
                    data-current={group.categories.some(category => category.id === page.category?.id)}
                  >{group.name}</NavigationMenuTrigger>
                  <NavigationMenuContent className="mega-panel">
                    <ul className="grid max-h-[calc(100svh-7rem)] grid-cols-3 gap-x-4 gap-y-2 overflow-y-auto">
                      {group.categories.filter(category => category.id !== 'courses').map(category => (
                        <li key={category.id}>
                          <NavigationMenuLink asChild active={category.id === page.category?.id}>
                            <a href={'platform' in category ? `/criadores?plataforma=${category.platform}` : `/${category.route}`} aria-current={category.id === page.category?.id && (!('platform' in category) || platform === category.platform) ? 'page' : undefined} className="navigation-card"><NavigationCard id={category.id.startsWith('creator-') ? 'creators' : category.id} name={category.name} /></a>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <UserControls dark={dark} toggleTheme={toggleTheme} />
            <Sheet>
              <SheetTrigger asChild><Button variant="ghost" size="icon" className="xl:hidden" aria-label="Abrir navegação"><Menu /></Button></SheetTrigger>
              <SheetContent className="w-[min(88vw,24rem)] gap-0 overflow-y-auto p-0">
                <SheetHeader className="border-b px-5 py-5">
                  <SheetTitle>Navegação</SheetTitle>
                  <SheetDescription>Escolha uma categoria para ver as opções.</SheetDescription>
                </SheetHeader>
                <nav aria-label="Navegação para celular" className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
                  <div className="overflow-hidden border divide-y">
                    <SheetClose asChild><Button asChild size="menu" variant={home ? 'secondary' : 'ghost'} className="min-h-11 rounded-none"><a href="/" aria-current={home ? 'page' : undefined}>Início</a></Button></SheetClose>
                    <SheetClose asChild><Button asChild size="menu" variant={forumPage ? 'secondary' : 'ghost'} className="min-h-11 rounded-none"><a href="/forum" aria-current={forumPage ? 'page' : undefined}>Fórum</a></Button></SheetClose>
                    <SheetClose asChild><Button asChild size="menu" variant={communitiesActive ? 'secondary' : 'ghost'} className="min-h-11 rounded-none"><a href="/comunidades" aria-current={communitiesActive ? 'page' : undefined}>Comunidades</a></Button></SheetClose>
                    <Accordion.Root type="single" collapsible className="divide-y" defaultValue={groups.find(group => group.categories.some(category => category.id === page.category?.id))?.id}>
                    {groups.filter(group => group.id !== 'communities').map(group => ['creators'].includes(group.id) ? (
                      <SheetClose asChild key={group.id}><Button asChild size="menu" variant={page.category?.id === group.id ? 'secondary' : 'ghost'} className="rounded-none"><a href={'/' + group.categories[0].route} aria-current={page.category?.id === group.id ? 'page' : undefined}>{group.name}</a></Button></SheetClose>
                    ) : (
                      <Accordion.Item key={group.id} value={group.id}>
                        <Accordion.Header>
                          <Accordion.Trigger asChild data-current={group.categories.some(category => category.id === page.category?.id)}><Button variant="ghost" size="menu" className="group min-h-11 justify-between rounded-none text-sm font-medium data-[current=true]:bg-accent data-[current=true]:text-primary">
                            {group.name}<ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                          </Button></Accordion.Trigger>
                        </Accordion.Header>
                        <Accordion.Content>
                          <ul className="mb-2 ml-4 space-y-1 border-l pl-2">
                            {group.categories.filter(category => category.id !== 'courses').map(category => (
                              <li key={category.id}><SheetClose asChild><Button asChild size="sm" variant={category.id === page.category?.id && (!('platform' in category) || platform === category.platform) ? 'secondary' : 'ghost'} className="h-9 w-full justify-start rounded-none px-3"><a href={'platform' in category ? `/criadores?plataforma=${category.platform}` : `/${category.route}`} aria-current={category.id === page.category?.id && (!('platform' in category) || platform === category.platform) ? 'page' : undefined}>{category.name}</a></Button></SheetClose></li>
                            ))}
                          </ul>
                        </Accordion.Content>
                      </Accordion.Item>
                    ))}
                    </Accordion.Root>
                    <SheetClose asChild><Button size="menu" variant="ghost" className="min-h-11 rounded-none text-sm font-medium" onClick={() => setTimeout(() => openContribution(), 0)}>Contribuir</Button></SheetClose>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>


      <main data-motion id="conteudo" className="site-frame mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
        {!page.valid ? (
          <Empty><EmptyHeader><EmptyTitle>Página não encontrada</EmptyTitle><EmptyDescription>Não encontramos esta página no Guia.</EmptyDescription></EmptyHeader><EmptyContent><Button asChild><a href="/">Voltar ao início</a></Button></EmptyContent></Empty>
        ) : home ? (
          <GuideLanding />
        ) : forumPage ? (
          <Discussions className="w-full flex-1" />
        ) : path === '/admin/anuncios' ? (
          <AdvertisingAdmin />
        ) : path === '/divulgue' || path === '/empresas' ? (
          <Companies dark={dark} />
        ) : page.resource ? (
          <article className="mx-auto w-full max-w-4xl space-y-5">
            <section aria-label="Apresentação do recurso" className="overflow-hidden rounded-lg border bg-card">
            <header className="flex flex-col gap-5 border-b p-4 sm:flex-row sm:items-center sm:p-6">
              <div className="min-w-0 flex-1 space-y-3"><div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"><a href={page.category!.id === 'youtube' ? '/criadores?plataforma=youtube' : page.category!.id === 'courses' ? '/#por-onde-comecar' : `/${page.category!.route}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"><ArrowLeft aria-hidden="true" className="size-4" />{page.category!.id === 'youtube' ? 'Criadores no YouTube' : page.category!.id === 'courses' ? 'Ver categorias' : page.category!.name}</a>{page.resource.demo && <Badge variant="outline">Exemplo fictício</Badge>}</div><h1 className="text-3xl font-semibold tracking-tight">{page.resource.name}</h1><p className="text-sm leading-relaxed text-muted-foreground">{page.resource.summary}</p></div>
              {(studyTypes.has(page.resource.type) || page.resource.imageUrl) && <div className="w-full shrink-0 overflow-hidden rounded-lg border sm:w-48"><StudyCover resource={page.resource} priority /></div>}
            </header>
            <div className="flex flex-col gap-5 p-4 sm:p-6">
            <div className="min-w-0 space-y-4">
            <p className="whitespace-pre-wrap leading-relaxed">{page.resource.description}</p>
            {!!page.resource.technologies.length && <div className="flex flex-wrap gap-2">{page.resource.technologies.map(t => <Badge asChild variant="secondary" key={t}><a href={`/tecnologias/${t}`}>{labels[t] || t}</a></Badge>)}</div>}
            {page.resource.type==='communities' && <div className="space-y-3"><p className="text-sm text-muted-foreground">{resourceExtra(page.resource)}{page.resource.communityAudience ? ` · Público: ${communityAudiences.find(item=>item.id===page.resource!.communityAudience)?.name}` : ''}</p><div className="flex flex-wrap gap-2">{page.resource.communityLinks?.map(link=><Button asChild variant="outline" key={link.platform}><a href={link.url} target="_blank" rel="noopener noreferrer">{communityPlatforms.find(item=>item.id===link.platform)?.name}<ArrowUpRight /></a></Button>)}</div></div>}
            </div>
            <aside aria-label="Informações e links do recurso" className="flex flex-col gap-4 rounded-lg bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
            <dl className="grid grid-cols-2 gap-3 text-sm lg:min-w-56"><div className="space-y-1"><dt className="text-xs text-muted-foreground">Idiomas</dt><dd>{page.resource.languages.join(', ') || 'Não informado'}</dd></div><div className="space-y-1"><dt className="text-xs text-muted-foreground">Última atualização</dt><dd>{page.resource.updatedAt.split('-').reverse().join('/')}</dd></div></dl>
            <p className="text-xs leading-relaxed text-muted-foreground lg:max-w-56">O conteúdo e as informações completas ficam no site de origem.</p>
            <div className="flex flex-wrap gap-2"><Button asChild><a href={page.resource.url} target="_blank" rel="noopener noreferrer">Abrir site<ArrowUpRight /></a></Button>{repository && <Button asChild variant="outline"><a href={`${repository}/edit/main/data/${page.resource.type}/${page.resource.slug}.json`}>Editar informação</a></Button>}</div>
            </aside>
            </div>
            </section>
            {studyTypes.has(page.resource.type) && <StudyDetail resource={page.resource} />}
          </article>
        ) : (
          <PlatformTabsRoot enabled={creatorsPage || communitiesPage} value={communitiesPage ? communitySelection.platform : creatorPlatform} onChange={communitiesPage ? value=>changeCommunityLocation({...communitySelection,platform:value}) : changeCreatorPlatform}><section aria-label="Recursos" className="scroll-mt-24 space-y-5">
            <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{page.title}</h1><SectionGuide section={guideSectionForGroup(creatorsPage || page.category?.id === 'youtube' ? 'creators' : page.category?.id)} dark={dark} /></div><div className="flex flex-wrap items-center gap-2">{communitiesPage && <CommunityFiltersDialog value={communitySelection} onChange={next=>changeCommunityLocation({...communitySelection,...next})} />}<SuggestResource iconOnlyOnMobile type={creatorsPage && creatorPlatform === 'youtube' ? 'youtube' : page.category?.id} /></div></div><div className="flex items-start justify-between gap-3"><p className="text-sm text-muted-foreground">{communitiesPage ? 'Encontre pessoas e comunidades de tecnologia perto de você ou ao redor do mundo.' : 'Indicações organizadas para você explorar no próprio ritmo.'}</p></div></div>
            {creatorsPage && <CreatorTabs />}
            {communitiesPage && <CommunityTabs />}
            <PlatformTabPanel enabled={creatorsPage || communitiesPage} value={communitiesPage ? communitySelection.platform : creatorPlatform}><div className="outline-none focus-visible:outline-2 focus-visible:outline-ring">
            {page.category && studyTypes.has(page.category.id) ? <StudyListing category={page.category.id} items={filtered} title={page.title} query={searchQuery} onSearch={changeSearch} /> : <div className="rounded-lg border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
                <span aria-live="polite" className="text-xs text-muted-foreground">{listing.pages > 1 ? `${listing.start}–${listing.end} de ${filtered.length} itens` : `${filtered.length} ${filtered.length === 1 ? 'item na lista' : 'itens na lista'}`}</span>
                <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 sm:w-auto">
                  {creatorsPage && <Select name="creatorContent" value={creatorContent} onValueChange={changeCreatorContent}>
                    <SelectTrigger size="sm" aria-label="Categoria de conteúdo" className="h-8 w-36 min-w-0 shrink-0 text-sm sm:w-52"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{creatorCategories.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                  </Select>}
                  {communitiesPage && <Select value={communitySelection.audience || 'all'} onValueChange={audience=>changeCommunityLocation({...communitySelection,audience})}>
                    <SelectTrigger size="sm" aria-label="Público da comunidade" className="h-8 w-36 min-w-0 shrink-0 text-sm sm:w-44"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos os públicos</SelectItem>{communityAudiences.map(item=><SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                  </Select>}
                  <ResourceSearch value={searchQuery} onChange={changeSearch} />
                </div>
              </div>
              {filtered.length ? <>
              <table aria-label={`Lista: ${page.title}`} className="w-full table-fixed border-collapse text-left">
                <thead className="border-t bg-muted/30 text-[11px] font-medium text-muted-foreground"><tr>
                  <th scope="col" className="px-3 py-2 font-medium sm:px-4">Item</th>
                  <th scope="col" className="hidden w-48 px-3 py-2 font-medium sm:table-cell">{communitiesPage ? 'Localização' : 'Categoria'}</th>
                  <th scope="col" className="hidden w-32 px-3 py-2 font-medium lg:table-cell">Atualização</th>
                </tr></thead>
                <tbody>{listing.items.map(resource => <ResourceRow key={`${resource.type}/${resource.slug}`} resource={resource} platform={platform} locationColumn={communitiesPage} sponsored={sponsoredPlacement ? isSponsored(resource, sponsoredPlacement) : false} />)}</tbody>
              </table>
              <ResourcePagination page={listing.page} pages={listing.pages} onChange={changePage} />
              </> : <Empty className="border-t"><EmptyHeader><EmptyTitle>{searchQuery.trim() ? 'Nenhum resultado para esta busca' : communitiesPage ? communitySelection.scope ? 'Ainda não há comunidades nesta localização' : 'Ainda não há comunidades nesta plataforma' : creatorsPage ? creatorContent !== 'all' ? 'Ainda não há criadores nesta categoria' : 'Ainda não há criadores nesta rede' : 'Ainda não há recursos aqui'}</EmptyTitle><EmptyDescription>{searchQuery.trim() ? 'Tente outras palavras ou limpe a busca para ver todos os itens.' : communitiesPage ? 'Escolha outra localização ou sugira uma comunidade para esta seleção.' : creatorsPage ? 'Escolha outra categoria ou rede, ou sugira um criador para esta seleção.' : 'Sugira o primeiro item desta categoria.'}</EmptyDescription></EmptyHeader></Empty>}
            </div>}
            </div></PlatformTabPanel>
          </section></PlatformTabsRoot>
        )}
      </main>
      <footer className="site-footer w-full shrink-0">
        <div className="section-divider" aria-hidden="true" />
        <div className="site-frame mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-y-4 px-4 py-5 text-sm text-muted-foreground sm:px-6">
          <div className="flex w-full justify-center"><ActiveUsers /></div>
        </div>
      </footer>
    </div></MaintainersProvider></CommunityMetricsProvider></Participation></ContributionToasts></Motion>
  );
}
