# Guia da TI — arquitetura

## Decisões

O projeto usa C#/.NET 10, React com TypeScript, Tailwind e shadcn/ui. O guia original está em `guia.md.txt` e foi preservado. Não há banco de dados nem painel administrativo. A participação no fórum pode usar autenticação GitHub.

O projeto usa dois repositórios independentes. `guia-da-ti/guia-da-ti` contém a aplicação e `guia-da-ti/guia-da-ti-dados` centraliza o catálogo público e as conversas da comunidade no GitHub Discussions. A integração do catálogo é um submódulo Git em `database/`, fixado em um commit reproduzível. As conversas são consultadas pela API do GitHub. A licença ainda precisa ser definida.

## Dados e segurança

Cada cadastro é um JSON em `data/<tipo>/<slug>.json`. O schema base exige slug, tipo, nome, resumo, descrição, URL HTTPS, áreas, tecnologias, idiomas e data de atualização. Campos desconhecidos são rejeitados. Tamanhos e vocabulários são limitados. A validação verifica nomes de arquivos, referências à taxonomia e duplicados por URL normalizada. URLs privadas, credenciais e protocolos executáveis são rejeitados. A validação não acessa URLs. A revisão humana confirma a disponibilidade e a legitimidade dos recursos.

A taxonomia central usa IDs estáveis para áreas, tecnologias, idiomas e tipos. Localizações e schemas específicos por tipo serão ampliados na próxima fase. Não atribuir cidades a comunidades online. Nenhum conteúdo contribuído é executado como HTML, script ou código.

Roadmaps da comunidade são cadastros de `type: roadmaps` com o bloco `roadmap` (nível e blocos, com etapas e subetapas). Esses cadastros não têm `url`. Os demais continuam com `url` obrigatória. O schema aceita de 2 a 20 blocos e de 5 a 150 etapas e subetapas, com no máximo 12 subetapas por etapa. Cada etapa indica a importância (`essential`, `recommended` ou `optional`), pode agrupar alternativas em `choice` e aceita até 8 recursos do catálogo e 3 links externos HTTPS. O validador confere ids únicos, grupos de alternativas e links públicos. Na montagem do catálogo, cada recurso citado precisa existir. Remover um recurso usado por um roadmap quebra a validação. Cada arquivo de roadmap tem até 200 KB, e os demais tipos continuam com 20 KB. O contrato existe em duas cópias: `tools/catalog` e o repositório de dados. A entrega segue esta ordem: aplicação, dados e, por fim, o ponteiro do submódulo.

## Consumo e deploy

O validador confiável em `tools/catalog` lê somente os JSONs de `database/data` e produz `tools/catalog/dist/catalog.json`. Schema e taxonomia aceitos ficam na aplicação. Mudanças de contrato exigem coordenação nos dois repositórios. O frontend gera HTML no build e C# carrega o mesmo snapshot na inicialização. HTML e catálogo devem ser publicados juntos. `CATALOG_PATH` permite configurar outro snapshot validado.

O snapshot do frontend guarda só um resumo de cada roadmap da comunidade (nível, blocos e etapas). A árvore completa fica em `src/generated/roadmaps/<slug>.json`, gerada por `scripts/prepare.mjs`, e vai para um chunk próprio. O pré-render e o `main.tsx` carregam a árvore antes de renderizar ou hidratar a página, para o HTML não divergir. O C# lê o snapshot inteiro.

O workflow raiz valida pushes e PRs usando o commit fixado. Execuções agendadas a cada hora e manuais consultam a main dos dados e geram um artefato com os SHAs de aplicação e catálogo. Nenhum script do submódulo é executado. O ponteiro versionado não muda automaticamente; `scripts/update-data.ps1` atualiza e valida esse ponteiro localmente. Deploy e proteção obrigatória de branch ainda precisam ser configurados. Agendamentos podem atrasar.

## Rotas

As páginas incluem `/`, `/forum`, categorias do MVP e páginas individuais. Também incluem `/areas/:id` e `/tecnologias/:id`. `/sobre` redireciona permanentemente para `/`. `/roadmaps/<slug>` mostra a trilha de um roadmap da comunidade, com blocos, etapas, recursos do catálogo e links externos marcados como "Fora do catálogo". Em `/roadmaps`, o filtro `?origem=comunidade|externa` separa os dois tipos. `/contribuir` abre o formulário de contribuição na página inicial. O HTML gerado inclui metadados, canonical, Open Graph, sitemap e robots.

A navegação oferece 32 categorias em seis grupos: Aprender, Conteúdos, Artigos e estudos, Comunidade, Praticar e Carreira, com expansão individual. Todas usam o schema base. Campos específicos, mapa e filtros avançados continuam incrementais. `/` apresenta o projeto, e `/forum` reúne as conversas. Favoritos e avaliações seguem fora do escopo atual.

O fórum em `/forum` usa o GitHub Discussions. A API consulta um repositório público configurável via GraphQL. Ela usa uma credencial do backend, timeout de dez segundos e cache de um minuto para até 128 consultas. `GET /api/discussions` lista tópicos por atividade, categoria e cursor. `GET /api/discussions/{numero}` lê um tópico e seus comentários paginados. A interface mostra estados de carregamento, erro, lista vazia, falta de configuração e tópico inexistente. O endereço `/forum?conversa=NUMERO` abre uma conversa. O endereço antigo `/?conversa=NUMERO` redireciona para o fórum. Respostas encadeadas mostram cinco itens e um link para continuar no GitHub. O site exibe textos como texto e oculta comentários removidos pela moderação. OAuth permite criar tópicos, comentários e respostas. O token do visitante fica na sessão do servidor, com cookie HttpOnly e proteção CSRF. A credencial de leitura nunca publica. O GitHub administra as categorias. A página inicial mostra apoiadores de `database/community.json`, validados no build. A lista de contribuidores usa a API do GitHub nos dois repositórios públicos. O servidor pagina os resultados, remove duplicados por ID e mantém cache por uma hora.

Os componentes visuais são instalados do registry oficial shadcn/ui. Apenas o tema e a composição de páginas são locais. Os menus Radix precisam de estilos inline para posicionamento e controle de rolagem. A CSP permite estilos inline. Os scripts continuam restritos à origem do site. Conteúdo do catálogo continua renderizado como texto.

O CSS global padroniza `cursor: pointer` nos controles interativos habilitados, incluindo menus e opções renderizados em portais Radix. Campos de texto mantêm seu cursor de edição e controles desabilitados não recebem o indicador de clique. A regra fica em `src/styles.css`. Os componentes do registry permanecem iguais.

Idioma é um filtro global baseado nos idiomas declarados por cada registro. A opção English (United States) exige tanto o idioma inglês (`en`) quanto o país `US` explicitamente marcado no cadastro. O campo opcional `countries` usa códigos ISO 3166-1 alpha-2 e indica o país de contexto/público do recurso. A aplicação nunca infere país ou nacionalidade pelo idioma.

## Contribuição

Fork → JSON individual → PR → validação → revisão humana → merge → build → futuro deploy.

Roadmaps da comunidade usam um editor próprio, em quatro etapas, que guarda um rascunho no navegador. Em `/roadmaps`, o botão de sugestão oferece o editor ou o formulário de roadmap externo. `POST /api/roadmaps/proposals` valida o rascunho com as regras do schema e abre o PR com a credencial da pessoa. O título começa com `Roadmap:`, e o corpo traz um resumo em português do que mudou. Cada pessoa pode ter até 3 PRs de roadmap abertos. A busca de PRs falha sem bloquear o envio. Na edição, o editor abre pela versão atual da `main` (`GET /api/roadmaps/{slug}/source`) e envia o `sha` do arquivo. Se a `main` avançou, o servidor recusa e a pessoa reabre o editor. O PR de edição menciona o criador do roadmap. O criador e as contribuições vêm do histórico de commits do arquivo (`GET /api/roadmaps/{slug}/contributors`), com cache de uma hora para até 64 roadmaps. O guia de uso está em [Roadmaps da comunidade](docs/roadmaps-comunidade.md). O catálogo inclui guia, templates, formulário de sugestão e CI. Os links do site apontam por padrão para `guia-da-ti/guia-da-ti-dados`. Dados de demonstração são fictícios e não devem ser publicados como cadastros verificados.

## Referências técnicas

- https://vite.dev/guide/ssr.html (pré-renderização com React no build)
- https://ui.shadcn.com/docs/installation/manual (componentes locais)
- https://learn.microsoft.com/aspnet/core/fundamentals/static-files?view=aspnetcore-10.0
