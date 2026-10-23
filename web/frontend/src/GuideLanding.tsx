import { FORUM_ENABLED } from './features';
import { useEffect, useRef } from 'react';
import { ArrowUpRight, BookOpen, BriefcaseBusiness, Code, Mail, MessageSquare, Newspaper, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommunityMetrics } from './CommunityMetrics';
import { Maintainers } from './Maintainers';
import { Community } from './Community';
import { GuideCharacter } from './GuideCharacter';
import heroImage from './assets/home/avatar-barbudo-dark.png';

const paths = [
  { label: 'Quero estudar', description: 'Plataformas de cursos, livros e caminhos de estudo.', href: '/plataformas', icon: BookOpen },
  { label: 'Quero me informar', description: 'Notícias e publicações para acompanhar tecnologia.', href: '/noticias', icon: Newspaper },
  { label: 'Quero encontrar pessoas', description: 'Comunidades para conversar e trocar experiências.', href: '/comunidades', icon: Users },
  { label: 'Quero praticar', description: 'Desafios e projetos para aplicar o que aprendi.', href: '/desafios', icon: Code },
  { label: 'Quero crescer na carreira', description: 'Sites de vagas e oportunidades de mentoria.', href: '/vagas', icon: BriefcaseBusiness },
  { label: 'Quero trocar uma ideia', description: 'Pergunte e compartilhe experiências no fórum do Guia.', href: '/forum', icon: MessageSquare },
];

export function GuideLanding() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches || !root.current) return;
    const animations: Animation[] = [];
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        observer.unobserve(element);
        const siblings = element.matches('.guide-path, .guide-metric')
          ? Array.from(element.parentElement!.children).indexOf(element) : 0;
        animations.push(element.animate([
          { opacity: 0, transform: 'translateY(18px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: 1000, delay: siblings * 100, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' }));
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
    root.current.querySelectorAll([
      '.guide-home-copy', '.guide-home-visual', '.guide-metric',
      '.guide-paths-heading', '.guide-path',
      '.guide-community-block > header', '.guide-community-block > section', '.guide-contact > div',
    ].join(',')).forEach(element => observer.observe(element));
    const stop = () => {
      observer.disconnect();
      animations.forEach(animation => animation.cancel());
    };
    const onMotionChange = () => { if (motion.matches) stop(); };
    motion.addEventListener('change', onMotionChange);
    return () => {
      stop();
      motion.removeEventListener('change', onMotionChange);
    };
  }, []);

  return <article ref={root} className="guide-landing mx-auto w-full max-w-5xl">
    <div className="guide-home-intro">
      <header className="guide-home-hero">
        <div className="guide-home-copy">
          <p className="guide-home-eyebrow">RECURSOS PARA TECNOLOGIA</p>
          <h1 className="guide-home-title"><span>Tudo sobre tecnologia.</span><span>Em um só lugar.</span></h1>
          <p className="guide-home-description">Uma curadoria de conteúdos, ferramentas e comunidades de tecnologia do Brasil e do mundo.</p>
          <div className="guide-home-actions">
            <Button asChild size="sm"><a href="#por-onde-comecar">Explorar recursos<ArrowUpRight /></a></Button>
            {FORUM_ENABLED && <Button asChild size="sm" variant="outline"><a href="/forum">Abrir fórum<ArrowUpRight /></a></Button>}
          </div>
        </div>
        <div className="guide-home-visual" aria-hidden="true">
          <img src={heroImage} alt="" width={1188} height={1324} fetchPriority="high" />
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
        {paths.filter(path => FORUM_ENABLED || path.href !== '/forum').map(({ label, description, href, icon: Icon }) => <a key={href} href={href} className="guide-path">
          <div className="guide-path-meta" aria-hidden="true"><ArrowUpRight className="size-4" /></div>
          <div className="guide-path-icon" aria-hidden="true"><Icon className="size-7" strokeWidth={1.25} /></div>
          <h3 className="mb-2 text-lg font-medium tracking-tight">{label}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </a>)}
      </div>
      <div className="section-divider section-divider--paths" aria-hidden="true" />
    </section>

    <section className="guide-community-sections">
      <section aria-labelledby="contribuidores-heading" className="guide-community-block space-y-5">
        <header className="max-w-2xl space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">A comunidade</p>
          <h2 id="contribuidores-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">Contribuidores</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Pessoas que contribuem com os repositórios do Guia.</p>
        </header>
        <Maintainers embedded />
      </section>
      <section aria-labelledby="apoiadores-heading" className="guide-community-block space-y-5">
        <header className="max-w-2xl space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">Apoio ao projeto</p>
          <h2 id="apoiadores-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">Empresas apoiadoras</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Empresas que ajudam a manter o Guia da TI.</p>
        </header>
        <Community area="supporters" embedded />
      </section>
    </section>

    <section id="contato" aria-labelledby="fale-com-o-guia" className="guide-contact scroll-mt-28">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <h2 id="fale-com-o-guia" className="text-2xl font-semibold tracking-tight">Fale com a gente</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Peça a remoção de um conteúdo, relate um bug ou converse sobre uma parceria.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1"><a href="mailto:devlucaspedro@gmail.com" className="text-sm font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary">E-mail: devlucaspedro@gmail.com</a></div>
        </div>
        <div className="guide-contact-action">
          <GuideCharacter pose="contact" className="guide-character--contact" />
          <Button asChild className="shrink-0"><a href="mailto:devlucaspedro@gmail.com"><Mail />Enviar e-mail</a></Button>
        </div>
      </div>
    </section>

  </article>;
}
