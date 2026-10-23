import { useEffect, useRef, useState } from 'react';
import type { HyperframesPlayer } from '@hyperframes/player';
import { gsap } from 'gsap';
import { ArrowUpRight, BookOpen, Briefcase, CalendarDays, CircleHelp, Code, Compass, Github, Lightbulb, MessageSquare, Megaphone, Newspaper, Pause, Play, Users, Video, HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { aboutGuideSteps, githubGuideSteps, guideAnimationSection, guideSteps, sectionWalkthrough, type GuideStep, type GuideStepId } from './guide-steps';
import runtimeUrl from '../node_modules/@hyperframes/core/dist/hyperframe.runtime.iife.js?url';
import { GuideAttention } from './GuideAttention';

const stepIcons = { explore: Compass, communities: Users, creators: Video, study: BookOpen, inform: Newspaper, networking: CalendarDays, practice: Code, career: Briefcase, forum: MessageSquare, contribute: HeartHandshake, about: Compass, transparency: Github, advertising: Megaphone, 'github-account': Github, 'github-login': Github, 'github-participate': MessageSquare };

function GuideAnimation({ id, phase, view, dark, reduced, scroller }: { id: GuideStepId; phase?: GuideStep['phase']; view?: string; dark: boolean; reduced: boolean; scroller?: React.RefObject<HTMLDivElement | null> }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<HyperframesPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    setReady(false); setFailed(false);
    let disposed = false;
    let started = false;
    let inView = false;
    let element: HyperframesPlayer | undefined;
    async function createPlayer() {
      try {
        await import('@hyperframes/player');
        if (disposed) return;
        element = document.createElement('hyperframes-player') as HyperframesPlayer;
        player.current = element;
        element.setAttribute('runtime-src', runtimeUrl);
        element.setAttribute('width', '800');
        element.setAttribute('height', '450');
        element.setAttribute('muted', '');
        element.setAttribute('loop', '');
        element.setAttribute('src', `/guia-animacoes/index.html?secao=${guideAnimationSection(id)}&tema=${dark ? 'escuro' : 'claro'}${phase ? `&etapa=${phase}` : ''}${view ? `&posicao=${view}` : ''}`);
        element.className = 'absolute inset-0 block h-full w-full';
        element.setAttribute('aria-hidden', 'true');
        element.addEventListener('ready', () => {
          if (disposed) return;
          if (element!.iframeElement) {
            element!.iframeElement.title = 'Demonstração animada';
            element!.iframeElement.tabIndex = -1;
          }
          setReady(true);
          if (reduced) element!.seek(element!.duration);
          else if (inView && !document.hidden) void element!.play();
        });
        element.addEventListener('error', () => { if (!disposed) setFailed(true); });
        container!.appendChild(element);
      } catch { if (!disposed) setFailed(true); }
    }
    const observer = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      setVisible(inView);
      if (inView && !started) { started = true; void createPlayer(); }
      if (!inView) element?.pause();
    }, { root: scroller?.current ?? null, threshold: 0.15 });
    observer.observe(container);
    return () => { disposed = true; observer.disconnect(); element?.pause(); element?.remove(); player.current = null; };
  }, [id, phase, dark, reduced, scroller]);

  useEffect(() => {
    function playback() {
      const current = player.current;
      if (!current?.ready) return;
      if (reduced) { current.pause(); current.seek(current.duration); }
      else if (!paused && visible && !document.hidden) void current.play();
      else current.pause();
    }
    playback();
    document.addEventListener('visibilitychange', playback);
    return () => document.removeEventListener('visibilitychange', playback);
  }, [paused, ready, visible, reduced]);

  return <div className="relative aspect-video overflow-hidden rounded-xl border bg-background">
    <div ref={host} className="absolute inset-0" />
    {!ready && <div className="absolute inset-0 flex flex-col justify-center gap-4 p-7" aria-hidden="true">
      <div className="flex gap-2"><span className="size-3 rounded-full bg-primary/50" /><span className="size-3 rounded-full bg-muted" /><span className="size-3 rounded-full bg-muted" /></div>
      <div className="h-6 w-2/3 rounded bg-muted" /><div className="h-11 rounded-lg border bg-card" /><div className="h-11 rounded-lg border bg-card" />
    </div>}
    {!ready && <span role="status" className="absolute bottom-3 left-4 text-xs text-muted-foreground">{failed ? 'A demonstração não carregou. As instruções estão abaixo.' : 'Carregando demonstração…'}</span>}
    {ready && !reduced && <Button size="icon-sm" variant="secondary" className="absolute right-3 bottom-3 border" aria-label={paused ? 'Reproduzir demonstração' : 'Pausar demonstração'} onClick={() => setPaused(value => !value)}>{paused ? <Play /> : <Pause />}</Button>}
  </div>;
}

export function AdvertisingHyperframe({ placement, dark = false }: { placement: string; dark?: boolean }) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return <GuideAnimation id="advertising" view={placement} dark={dark} reduced={reduced} />;
}

function GuideTimeline({ dark, steps = guideSteps, embedded = false }: { dark: boolean; steps?: readonly GuideStep[]; embedded?: boolean }) {
  const Heading = embedded ? 'h2' : 'h3';
  const scroller = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    const root = scroller.current;
    if (!root || reduced) return;
    let disposed = false;
    let context: gsap.Context | undefined;
    void import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      context = gsap.context(() => {
        const items = root.querySelectorAll('[data-guide-step]');
        items.forEach(item => gsap.from(item, { opacity: 0, y: 24, duration: 0.55, ease: 'power2.out', scrollTrigger: { trigger: item, scroller: embedded ? undefined : root, start: 'top 94%', once: true } }));
        gsap.fromTo('[data-guide-line]', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '[data-guide-timeline]', scroller: embedded ? undefined : root, start: 'top 70%', end: 'bottom 75%', scrub: 0.3 } });
      }, root);
    }).catch(() => { /* Without the plugin, the timeline stays visible without animation. */ });
    return () => { disposed = true; context?.revert(); };
  }, [reduced, embedded]);

  return <div ref={scroller} className={embedded ? 'py-3' : 'min-h-0 overflow-y-auto overscroll-contain px-5 py-7 sm:px-9 sm:py-9'} tabIndex={embedded ? undefined : 0} aria-label="Etapas para usar o Guia">
    <div data-guide-timeline className="relative">
      <div aria-hidden="true" className="absolute top-5 bottom-5 left-[19px] w-px bg-border sm:left-[23px]"><div data-guide-line className="h-full origin-top bg-primary" /></div>
      <ol className="space-y-9">
      {steps.map((step, index) => {
        const Icon = stepIcons[step.id as keyof typeof stepIcons] ?? CircleHelp;
        return <li key={`${step.id}-${step.phase ?? index}`} data-guide-step className="relative pl-14 sm:pl-17">
          <span aria-hidden="true" className="absolute top-1 left-0 flex size-10 items-center justify-center rounded-full border border-primary/30 bg-background text-primary sm:size-12"><Icon className="size-4 sm:size-5" /></span>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium"><span className="font-mono text-primary">{String(index + 1).padStart(2, '0')}</span><span className="text-muted-foreground">{step.category}</span></div>
          <Heading className="mb-4 text-xl font-semibold tracking-tight sm:text-2xl">{step.label}</Heading>
          <div className="grid items-start gap-5 rounded-2xl border bg-card p-4 sm:p-5 md:grid-cols-[1fr_1fr]">
            <GuideAnimation id={step.id} phase={step.phase} dark={dark} reduced={reduced} scroller={embedded ? undefined : scroller} />
            <div className="space-y-4">
              <p className="text-sm leading-relaxed">{step.description}</p>
              <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground"><Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" /><p>{step.tip}</p></div>
              {embedded ? <GuideStepLink step={step} /> : <DialogClose asChild><GuideStepLink step={step} /></DialogClose>}
            </div>
          </div>
        </li>;
      })}
      </ol>
    </div>
    <p className="mt-9 pl-14 text-xs leading-relaxed text-muted-foreground sm:pl-17">Explore sem entrar. Entre com o GitHub para sugerir recursos, comentar e avaliar.</p>
  </div>;
}

function GuideStepLink({ step, ...props }: { step: GuideStep } & React.ComponentProps<typeof Button>) {
  const external = step.href.startsWith('https://');
  return <Button {...props} asChild size="sm" variant="outline"><a href={step.href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{step.action}<ArrowUpRight /></a></Button>;
}

function GuideDialogContent({ dark, steps, title, description }: { dark: boolean; steps: readonly GuideStep[]; title: string; description: string }) {
  return <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
    <DialogHeader className="mx-0 mt-0 shrink-0 border-b px-5 py-6 pr-12 text-left sm:px-9">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary"><Compass className="size-4" />PASSO A PASSO</div>
      <DialogTitle className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</DialogTitle>
      <DialogDescription className="mt-2 text-sm">{description}</DialogDescription>
    </DialogHeader>
    <GuideTimeline dark={dark} steps={steps} />
    <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-background px-5 py-4 sm:px-9"><span className="text-xs text-muted-foreground">Explore no seu ritmo</span><DialogClose asChild><Button>Entendi</Button></DialogClose></div>
  </DialogContent>;
}

export function SectionGuide({ section, dark, label }: { section: GuideStepId | 'github'; dark?: boolean; label?: string }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [localDark, setLocalDark] = useState(false);
  const steps: readonly GuideStep[] = section === 'github' ? githubGuideSteps : section === 'about' ? aboutGuideSteps : sectionWalkthrough(section);
  const title = section === 'github' ? 'Primeira vez no GitHub?' : section === 'about' ? 'Conheça o Guia da TI' : guideSteps.find(step => step.id === section)?.label ?? sectionWalkthrough(section)[0].category;
  const description = section === 'github' ? 'Veja como criar sua conta e participar do Guia.' : section === 'about' ? 'Veja o que você encontra aqui e como a comunidade mantém o catálogo.' : 'Veja o que você encontra, como escolher e por onde começar.';
  return <Dialog onOpenChange={open => { if (open) setLocalDark(document.documentElement.classList.contains('dark')); }}>
    <DialogTrigger asChild><Button ref={trigger} variant={label ? 'outline' : 'ghost'} size={label ? 'default' : 'icon-sm'} aria-label={label ?? `Dicas: ${steps[0].category}`} title={title} className={label ? 'w-full justify-between' : 'shrink-0 text-muted-foreground hover:text-primary'}><CircleHelp />{label && <><span className="flex-1 text-left">{label}</span><ArrowUpRight /></>}</Button></DialogTrigger>
    <GuideAttention target={trigger} enabled={!label} />
    <GuideDialogContent dark={dark ?? localDark} steps={steps} title={title} description={description} />
  </Dialog>;
}
