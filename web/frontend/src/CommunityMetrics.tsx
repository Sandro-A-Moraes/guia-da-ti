import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { categories, resources } from './catalog';
import community from './generated/community.json';

type ActivitySummary = { activeUsers: number };
const ActivityContext = createContext<ActivitySummary | null>(null);
const format = (value: number) => value.toLocaleString('pt-BR');

export function CommunityMetricsProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActivitySummary | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending || document.visibilityState !== 'visible') return;
      pending = true;
      try {
        await fetch('/api/community/activity', { signal: controller.signal, cache: 'no-store' }).then(async response => {
            if (!response.ok) throw Error();
            const data = await response.json();
            if (!Number.isSafeInteger(data.activeUsers) || data.activeUsers < 0) throw Error();
            if (!controller.signal.aborted) setActive(data);
          }).catch(() => { if (!controller.signal.aborted) setActive(null); });
      }
      finally { pending = false; }
    }
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 60000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); };
  }, []);
  return <ActivityContext.Provider value={active}>{children}</ActivityContext.Provider>;
}

export function ActiveUsers() {
  const active = useContext(ActivityContext);
  return <span className="inline-flex items-center gap-2 text-xs" title="Visitantes que deixaram a página aberta nos últimos 5 minutos. Cada navegador conta uma vez, mesmo sem login.">
    <span aria-hidden="true" className={`size-1.5 rounded-full ${active === null ? 'bg-muted-foreground' : 'bg-primary'}`} />
    {active === null ? 'Atividade indisponível' : `${format(active.activeUsers)} ${active.activeUsers === 1 ? 'usuário ativo' : 'usuários ativos'}`}
    <span className="sr-only"> nos últimos 5 minutos, incluindo visitantes sem login</span>
  </span>;
}

function MetricValue({ value }: { value: number | null }) {
  const element = useRef<HTMLSpanElement>(null);
  const [displayed, setDisplayed] = useState(value);

  useEffect(() => {
    setDisplayed(value);
    if (value === null || !element.current) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) return;

    let frame = 0;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      setDisplayed(0);
      let start: number | undefined;
      const tick = (time: number) => {
        start ??= time;
        const progress = Math.min((time - start) / 1100, 1);
        setDisplayed(Math.round(value * (1 - (1 - progress) ** 3)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    observer.observe(element.current);

    const stop = () => {
      if (!motion.matches) return;
      observer.disconnect();
      cancelAnimationFrame(frame);
      setDisplayed(value);
    };
    motion.addEventListener('change', stop);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      motion.removeEventListener('change', stop);
    };
  }, [value]);

  return <>
    <span ref={element} aria-hidden="true">{displayed === null ? '—' : format(displayed)}</span>
    <span className="sr-only">{value === null ? '—' : format(value)}</span>
  </>;
}

export function CommunityMetrics() {
  const [forumMessages, setForumMessages] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/discussions/metrics', { signal: controller.signal, cache: 'no-store' })
      .then(async response => response.ok ? response.json() : null)
      .then(data => {
        if (!controller.signal.aborted && Number.isSafeInteger(data?.messages) && data.messages >= 0) setForumMessages(data.messages);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const metrics = [
    { value: resources.filter(resource => !resource.demo).length, label: 'Recursos' },
    { value: categories.length, label: 'Categorias' },
    { value: forumMessages, label: 'Mensagens no fórum' },
    { value: community.supporters.length, label: 'Apoiadores' },
  ];
  return <section aria-label="O Guia em números" className="guide-metrics">
    <h2 className="sr-only">O Guia em números</h2>
    <dl className="guide-metrics-grid">
      {metrics.map(metric => <div className="guide-metric" key={metric.label}>
        <dt>{metric.label}</dt>
        <dd><MetricValue value={metric.value} /></dd>
      </div>)}
    </dl>
  </section>;
}
