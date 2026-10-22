import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
    { value: format(resources.filter(resource => !resource.demo).length), label: 'Recursos' },
    { value: format(categories.length), label: 'Categorias' },
    { value: forumMessages === null ? '—' : format(forumMessages), label: 'Mensagens no fórum' },
    { value: format(community.supporters.length), label: 'Apoiadores' },
  ];
  return <section aria-label="O Guia em números" className="guide-metrics">
    <h2 className="sr-only">O Guia em números</h2>
    <dl className="guide-metrics-grid">
      {metrics.map(metric => <div className="guide-metric" key={metric.label}>
        <dt>{metric.label}</dt>
        <dd>{metric.value}</dd>
      </div>)}
    </dl>
  </section>;
}
