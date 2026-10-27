# Plano de implementação

## Fase 1 — fundação e primeira navegação

- [x] Repositórios separados de aplicação e dados, integrados por submódulo.
- [x] Schema base, taxonomia e registros de demonstração.
- [x] Validação, índice consolidado, testes de dados inválidos e CI.
- [x] C# com API de consulta e publicação de HTML estático.
- [x] React, TypeScript, Tailwind e componentes shadcn/ui.
- [x] Filtro por idioma e região usando apenas metadados explícitos no cadastro.
- [x] Home, busca, filtro por tipo, páginas de recurso, área e tecnologia.
- [x] HTML pré-renderizado, metadados, sitemap, dark mode e contribuição.

## Fase 2 — comunidades

- [ ] Schema específico: localização, modalidade, organizadores, links, custo e ano de criação.
- [ ] Mapa Leaflet com clusters, carregamento sob demanda e acessibilidade via lista.
- [ ] Filtros geográficos, modalidade, gratuidade, idioma e tema.
- [ ] Cadastros reais revisados. Remover exemplos da publicação.

## Fase 3 — completar o MVP

- [x] Schema, validação, trilha, editor e fluxo de PR para roadmaps da comunidade.
- [ ] Schemas e apresentação específicos para cursos, criadores e YouTube.
- [ ] Filtros avançados e dados estruturados por categoria.
- [x] Verificação visual mobile/desktop, dropdowns, busca, seleção de categoria, tema escuro e navegação por teclado no Chrome.
- [ ] Testes de integração HTTP, SEO e mapa.

## Fase 4 — publicação

- [ ] Definir organização, repositórios, licença e domínio canônico.
- [x] Build agendado do catálogo da main, artefatos com SHAs e atualização local por versão.
- [ ] Deploy dos artefatos e rollback na VPS.
- [ ] Container, VPS, TLS e validação no domínio público.

## Depois do MVP

Eventos, oportunidades, livros, podcasts, newsletters, certificações, favoritos e coleções. Autenticação e avaliações só mediante necessidade.
