import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { categories, resources } from './catalog';
import community from './generated/community.json';

type ActivitySummary = { activeUsers: number; peakActiveUsers: number };
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
            if (!Number.isSafeInteger(data.activeUsers) || data.activeUsers < 0 || !Number.isSafeInteger(data.peakActiveUsers) || data.peakActiveUsers < data.activeUsers) throw Error();
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
  const active = useContext(ActivityContext);
  const metrics = [
    { value: active === null ? '—' : format(active.peakActiveUsers), label: 'Pico de acesso', detail: 'Maior número de visitantes simultâneos desde a última reinicialização do servidor.' },
    { value: format(resources.filter(resource => !resource.demo).length), label: 'Recursos no catálogo', detail: 'Indicações organizadas por categoria' },
    { value: format(categories.length), label: 'Categorias', detail: 'Temas para explorar' },
    { value: format(community.supporters.length), label: 'Apoiadores', detail: 'Apoiam a continuidade do Guia' },
  ];
  return <section aria-label="O Guia em números" className="space-y-4 border-y py-7 sm:py-10">
    <h2 className="sr-only">O Guia em números</h2>
    <dl className="grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
      {metrics.map((metric, index) => <div key={metric.label} className="flex flex-col gap-2">
        <dt className="order-2 font-mono text-xs font-medium uppercase tracking-widest">{metric.label}</dt>
        <dd className={`order-1 font-mono text-4xl font-bold tabular-nums tracking-tight sm:text-5xl ${index === 0 ? 'text-primary' : ''}`}>{metric.value}</dd>
        <dd className="order-3 text-xs leading-relaxed text-muted-foreground">{metric.detail}</dd>
      </div>)}
    </dl>
    {active === null && <p className="text-xs text-muted-foreground">Não foi possível carregar o pico de acesso agora.</p>}
  </section>;
}
