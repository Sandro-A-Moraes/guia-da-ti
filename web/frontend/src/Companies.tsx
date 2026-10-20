import { BookOpen, HeartHandshake, Megaphone, MessageSquareText, MousePointerClick, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Advertisement } from './Advertisement';
import { AdvertisingHyperframe } from './UserGuide';

const placements = [
  { id: 'site-top-banner', icon: Megaphone, title: 'Banner no topo do site', location: 'Acima do menu principal', description: 'O banner aparece acima do menu em todas as páginas. Use uma arte panorâmica para divulgar a campanha.' },
  { id: 'forum-feed', icon: MessageSquareText, title: 'Entre os tópicos do fórum', location: 'Início', description: 'Há um espaço por página. Com quatro ou mais tópicos, ele aparece depois do terceiro. Com menos, fica antes da lista.' },
  { id: 'forum-topic', icon: Users, title: 'Dentro de uma conversa', location: 'Tópicos do fórum', description: 'Depois do conteúdo do tópico e antes do campo para comentar. O anúncio fica separado da conversa e das respostas.' },
  { id: 'study-topic', icon: BookOpen, title: 'Nas discussões de Estudar', location: 'Itens com discussão disponível', description: 'Na conversa vinculada a plataformas de cursos, faculdades, bootcamps, roadmaps, livros e certificações. O espaço aparece antes dos comentários.' },
 ] as const;

export function Companies({ dark }: { dark: boolean }) {
  return <article className="mx-auto w-full max-w-4xl space-y-10">
    <header data-motion className="space-y-5 rounded-2xl border bg-card p-6 sm:p-8">
      <Badge variant="secondary"><Megaphone className="size-3.5" aria-hidden="true" />Para organizações e pessoas</Badge>
      <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Divulgue seu projeto no Guia da TI</h1>
      <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">O Guia da TI reúne links de estudo, carreira e comunidades. No fórum, as pessoas compartilham dúvidas e experiências sobre tecnologia.</p>
      <p className="max-w-2xl text-sm leading-relaxed">Apresente uma solução, projeto ou conteúdo para quem estuda e trabalha com tecnologia. Empresas e pessoas podem divulgar em espaços identificados como publicidade ou patrocínio.</p>
    </header>

    <section aria-labelledby="companies-benefits" className="space-y-5">
      <h2 id="companies-benefits" className="text-2xl font-semibold tracking-tight">Por que divulgar no Guia?</h2>
      <div className="grid gap-4 sm:grid-cols-3">
      {[{ icon: Users, title: 'Público de tecnologia', text: 'Chegue a pessoas que procuram fontes de estudo, ferramentas e oportunidades de carreira.' }, { icon: MessageSquareText, title: 'No contexto certo', text: 'Apresente seu projeto em espaços ligados a conversas e temas de tecnologia.' }, { icon: MousePointerClick, title: 'Visitas ao seu site', text: 'Leve pessoas interessadas à página do seu projeto ou conteúdo.' }].map(item => <Card key={item.title} data-motion className="gap-3 shadow-none"><CardHeader><item.icon className="mb-2 size-5 text-primary" aria-hidden="true" /><CardTitle className="text-base">{item.title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p></CardContent></Card>)}
      </div>
    </section>

    <section aria-labelledby="companies-placements" className="space-y-5">
      <div className="space-y-2"><h2 id="companies-placements" className="text-2xl font-semibold tracking-tight">Onde divulgar</h2><p className="text-sm leading-relaxed text-muted-foreground">Conheça os espaços disponíveis para anúncios e conteúdos patrocinados.</p></div>
      <div className="space-y-4">
        <article data-motion className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
          <div className="space-y-2"><Badge variant="outline"><BookOpen className="size-3" aria-hidden="true" />Listas do Guia</Badge><h3 className="font-semibold">Conteúdo patrocinado</h3><p className="text-sm leading-relaxed text-muted-foreground">Destaque um criador, recurso de estudo, iniciativa de networking ou comunidade no início da lista correspondente. A indicação aparece identificada como patrocinada.</p></div>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2"><div className="rounded-lg border bg-background p-4"><p className="mb-2 text-xs font-medium text-muted-foreground">Prévia na lista</p><div className="rounded-lg border bg-card p-4"><div className="mb-3 flex items-center gap-2"><Badge variant="secondary">Patrocinado</Badge><span className="text-xs text-muted-foreground">Exemplo</span></div><p className="font-semibold">Plataforma para aprender tecnologia</p><p className="mt-1 text-sm text-muted-foreground">Cursos e trilhas para seguir no seu ritmo.</p></div></div><AdvertisingHyperframe placement="sponsored-list" dark={dark} /></div>
        </article>
        {placements.map((placement, index) => <article key={placement.id} data-motion className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
          <div className="space-y-2"><Badge variant="outline"><placement.icon className="size-3" aria-hidden="true" />{placement.location}</Badge><h3 className="font-semibold">{placement.title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{placement.description}</p></div>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2"><div className="rounded-lg border bg-background p-4"><p className="mb-2 text-xs font-medium text-muted-foreground">Prévia</p><Advertisement placement={placement.id} preview /></div><AdvertisingHyperframe placement={placement.id} dark={dark} /></div>
        </article>)}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">Os anúncios aparecem no topo do site ou no fórum. O patrocínio destaca um item em uma lista relacionada.</p>
    </section>

    <section data-motion aria-labelledby="companies-supporters" className="flex flex-col gap-4 rounded-2xl border bg-card p-6 sm:flex-row sm:p-8">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><HeartHandshake className="size-5" /></span>
      <div className="space-y-3"><h2 id="companies-supporters" className="text-xl font-semibold tracking-tight">Apoie o Guia</h2><p className="text-sm leading-relaxed text-muted-foreground">Empresas e pessoas que apoiam o projeto podem aparecer no Início e em Sobre, com nome e link para uma página própria.</p><p className="text-sm leading-relaxed text-muted-foreground">Essa apresentação é separada dos anúncios e dos conteúdos patrocinados. Os detalhes são combinados para cada parceria.</p></div>
    </section>

    <aside className="rounded-xl border bg-muted/30 p-5 text-sm leading-relaxed text-muted-foreground">Cada divulgação tem espaço e período definidos. Para conversar sobre formatos e valores, escreva para <a className="font-medium text-foreground underline underline-offset-4 hover:text-primary" href="mailto:devlucaspedro@gmail.com">devlucaspedro@gmail.com</a>.</aside>
  </article>;
}
