import { ArrowUpRight, BookOpen, BriefcaseBusiness, Code, Mail, MessageSquare, Newspaper, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AboutGuide } from './UserGuide';
import { CommunityMetrics } from './CommunityMetrics';
import { Maintainers } from './Maintainers';
import { Community } from './Community';
import heroImage from './assets/home/bh-hero.png';

const paths = [
  { label: 'Quero estudar', description: 'Plataformas de cursos, livros e caminhos de estudo.', href: '/plataformas', icon: BookOpen },
  { label: 'Quero me informar', description: 'Notícias e publicações para acompanhar tecnologia.', href: '/noticias', icon: Newspaper },
  { label: 'Quero encontrar pessoas', description: 'Comunidades para conversar e trocar experiências.', href: '/comunidades', icon: Users },
  { label: 'Quero praticar', description: 'Desafios e projetos para aplicar o que aprendi.', href: '/desafios', icon: Code },
  { label: 'Quero crescer na carreira', description: 'Sites de vagas e oportunidades de mentoria.', href: '/vagas', icon: BriefcaseBusiness },
  { label: 'Quero trocar uma ideia', description: 'Pergunte e compartilhe experiências no fórum do Guia.', href: '/forum', icon: MessageSquare },
];

const featuredResources = [
  { label: 'Plataformas de cursos', href: '/plataformas' },
  { label: 'Notícias', href: '/noticias' },
  { label: 'Comunidades', href: '/comunidades' },
  { label: 'Ferramentas', href: '/ferramentas' },
  { label: 'Vagas', href: '/vagas' },
  { label: 'Fórum', href: '/forum' },
];

export function GuideLanding({ dark }: { dark: boolean }) {
  return <article className="guide-landing mx-auto w-full max-w-5xl">
    <div className="guide-home-intro">
      <header className="guide-home-hero">
        <div className="guide-home-copy">
          <p className="guide-home-eyebrow">RECURSOS PARA TECNOLOGIA</p>
          <h1 className="guide-home-title"><span>Descubra seu próximo</span> <span>caminho em tecnologia.</span></h1>
          <p className="guide-home-description">Recursos, comunidades e um fórum para quem estuda ou trabalha com tecnologia.</p>
          <nav aria-label="Recursos do Guia" className="guide-home-badges flex flex-wrap gap-2 pt-5">
            {featuredResources.map(resource => <Badge asChild key={resource.href} variant="outline" className="rounded-full px-3 py-1 hover:bg-accent">
              <a href={resource.href}>{resource.label}</a>
            </Badge>)}
          </nav>
          <div className="guide-home-actions">
            <Button asChild size="sm"><a href="#por-onde-comecar">Explorar recursos<ArrowUpRight /></a></Button>
            <Button asChild size="sm" variant="outline"><a href="/forum">Abrir fórum<ArrowUpRight /></a></Button>
          </div>
        </div>
        <div className="guide-home-visual" aria-hidden="true">
          <img src={heroImage} alt="" width={1702} height={1037} fetchPriority="high" />
        </div>
      </header>
      <CommunityMetrics />
      <div className="section-divider section-divider--intro" aria-hidden="true" />
    </div>

    <section aria-labelledby="por-onde-comecar" className="guide-paths">
      <div className="guide-paths-heading">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">Seu próximo passo</p>
          <h2 id="por-onde-comecar" className="scroll-mt-28 text-2xl font-semibold tracking-tight sm:text-3xl">Por onde você quer começar?</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">Está começando na área ou procura algo para o trabalho? Escolha um caminho para seguir agora.</p>
      </div>
      <div className="guide-paths-grid">
        {paths.map(({ label, description, href, icon: Icon }) => <a key={href} href={href} className="guide-path">
          <div className="guide-path-meta" aria-hidden="true"><ArrowUpRight className="size-4" /></div>
          <div className="guide-path-icon" aria-hidden="true"><Icon className="size-7" strokeWidth={1.25} /></div>
          <h3 className="mb-2 text-lg font-medium tracking-tight">{label}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </a>)}
      </div>
      <div className="section-divider section-divider--paths" aria-hidden="true" />
    </section>

    <section id="conheca-o-guia" aria-labelledby="como-o-guia-funciona" className="scroll-mt-28 space-y-6">
      <div className="max-w-2xl space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">Conheça o projeto</p>
        <h2 id="como-o-guia-funciona" className="text-2xl font-semibold tracking-tight sm:text-3xl">Links para descobrir. Um fórum para conversar.</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">Veja o que você encontra no Guia e como suas indicações ajudam outras pessoas.</p>
      </div>
      <AboutGuide dark={dark} />
    </section>

    <section className="space-y-12">
      <section aria-labelledby="contribuidores-heading" className="space-y-5">
        <header className="max-w-2xl space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">A comunidade</p>
          <h2 id="contribuidores-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">Contribuidores</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Pessoas que contribuem com os repositórios do Guia.</p>
        </header>
        <Maintainers embedded />
      </section>
      <section aria-labelledby="apoiadores-heading" className="space-y-5">
        <header className="max-w-2xl space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">A comunidade</p>
          <h2 id="apoiadores-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">Empresas apoiadoras</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Empresas que ajudam a manter o Guia da TI.</p>
        </header>
        <Community area="supporters" embedded />
      </section>
    </section>

    <section id="contato" aria-labelledby="fale-com-o-guia" className="scroll-mt-28 rounded-3xl border bg-card p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <h2 id="fale-com-o-guia" className="text-2xl font-semibold tracking-tight">Fale com a gente</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Peça a remoção de um conteúdo, relate um bug ou converse sobre uma parceria.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1"><a href="mailto:devlucaspedro@gmail.com" className="text-sm font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary">E-mail: devlucaspedro@gmail.com</a></div>
        </div>
        <Button asChild className="shrink-0"><a href="mailto:devlucaspedro@gmail.com"><Mail />Enviar e-mail</a></Button>
      </div>
    </section>

  </article>;
}
