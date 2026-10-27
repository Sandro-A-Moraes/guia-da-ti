# Guia da TI

Guia colaborativo de links para sites, conteúdos e oportunidades de tecnologia. Os guias organizam indicações e levam você ao site de origem, onde ficam os cursos, artigos, tutoriais e atividades. No fórum, a comunidade pode tirar dúvidas e trocar conhecimento dentro do Guia.

Aplicação com **C#/.NET 10, React, TypeScript, Tailwind e shadcn/ui**.

- [guia-da-ti](https://github.com/guia-da-ti/guia-da-ti): aplicação e integração.
- [guia-da-ti-dados](https://github.com/guia-da-ti/guia-da-ti-dados): catálogo público e contribuições.

`database/` é um **submódulo Git**, fixado em um commit do repositório de dados. Envie contribuições de conteúdo para aquele repositório.

## Executar

Requer Node.js 22.12+ e SDK .NET 10.

```powershell
git clone --recurse-submodules https://github.com/guia-da-ti/guia-da-ti.git
cd guia-da-ti
# Se o clone já existia:
git submodule update --init database
npm --prefix tools/catalog ci
npm --prefix web/frontend ci
./scripts/build.ps1
dotnet run --project web/backend/GuiaDaTi.Api --no-build
```

Para desenvolver a interface após gerar o catálogo: `npm --prefix web/frontend run dev`.

Para executar o backend e o frontend ao mesmo tempo, use `./scripts/dev.ps1`. Abra `http://localhost:5173`. Pressione Ctrl+C para encerrar os dois servidores.

O servidor aceita conexões da rede na porta 5080. Em outro dispositivo conectado à mesma rede, abra `http://IP-DA-MAQUINA:5080`. Consulte o IPv4 da conexão Ethernet ou Wi-Fi com `ipconfig`. Na própria máquina, você também pode usar `http://localhost:5080`.

A conta administradora gerencia campanhas em `/admin/anuncios`. Consulte os espaços, limites e instruções de armazenamento em [Administração de anúncios](docs/publicidade.md).

## Atualizar os dados

```powershell
./scripts/update-data.ps1
# Ou escolha uma versão específica:
./scripts/update-data.ps1 -Ref COMMIT_SHA
```

O script interrompe se houver alterações locais no catálogo. Após conferir o build, registre o ponteiro com `git add database` e um commit na aplicação. Para editar o catálogo, crie uma branch dentro de `database/`. O submódulo normalmente fica em detached HEAD.

## Integração automática

O workflow raiz valida pushes e PRs com o commit fixado. A cada hora, ou quando acionado manualmente, consulta a main do catálogo e valida os JSONs. O artefato gerado reúne site, servidor, catálogo e SHAs dos dois repositórios. Agendamentos podem atrasar.

Nenhum script do submódulo é executado pelo build do site. `tools/catalog` contém o contrato aceito pela aplicação. Mudanças de schema ou taxonomia devem ser coordenadas nos dois repositórios.

O workflow testa e gera uma imagem Docker antes de publicar na VPS por SSH. O primeiro deploy é manual. Após validar o site, `VPS_DEPLOY_ENABLED=true` libera as atualizações automáticas na `main`. Consulte [Publicar na VPS](docs/deploy-vps.md) para preparar o servidor, cadastrar os acessos e conectar o domínio.

## Configuração

- `CATALOG_PATH`: snapshot validado, padrão local `tools/catalog/dist/catalog.json`.
- `SITE_URL`: origem canônica no build, padrão `https://guiadati.com`. No backend, é opcional e define o link da página no corpo do PR de roadmap (`<origem>/roadmaps/<slug>`). Exige HTTPS sem usuário e senha. Sem ela, o PR sai sem o link.
- `VITE_DATA_REPOSITORY`: padrão `https://github.com/guia-da-ti/guia-da-ti-dados`.
- `DISCUSSIONS_REPOSITORY`: repositório público das conversas, padrão `guia-da-ti/guia-da-ti-dados` (somente no backend).
- `DISCUSSIONS_TOKEN`: credencial de leitura da API GraphQL do GitHub (somente no backend).

Frontend e backend devem usar o mesmo snapshot. Nunca coloque segredos em variáveis `VITE_*`.

## Fórum da comunidade

O fórum fica em `/forum`. A integração usa o GitHub Discussions pela API .NET. Pessoas autenticadas pelo GitHub podem criar tópicos, comentar e responder.

Para conectar dados reais:

1. Ative Discussions nas configurações de `guia-da-ti/guia-da-ti-dados` e organize as categorias no GitHub.
2. O servidor usa esse repositório por padrão. Se já existir uma variável `DISCUSSIONS_REPOSITORY`, atualize-a para `guia-da-ti/guia-da-ti-dados` ou remova-a para usar o padrão.
3. Configure `DISCUSSIONS_TOKEN` no gerenciador de segredos do servidor. Use uma credencial com acesso de leitura a Discussions no repositório. Para desenvolvimento, use os [User Secrets do .NET](https://learn.microsoft.com/aspnet/core/security/app-secrets) no projeto `web/backend/GuiaDaTi.Api`, com a chave `DISCUSSIONS_TOKEN`, e execute em ambiente `Development`. Não registre a credencial em arquivos versionados nem envie ao frontend.
4. Execute `dotnet run --project web/backend/GuiaDaTi.Api`: o perfil local usa `Development`, carrega os User Secrets e aceita conexões na porta 5080, sem abrir o navegador. Inicie o frontend com `npm --prefix web/frontend run dev`. A prévia Vite também encaminha `/api` para essa API. O perfil local não configura o servidor de produção.

Sem credencial, a página mostra que o espaço está em preparação. Configuração inválida, serviço indisponível e lista vazia têm estados distintos. A API recusa repositórios privados e mantém um cache em memória por um minuto. Tópicos e comentários são exibidos como texto, sem executar HTML. Comentários ocultados pela moderação não têm seu conteúdo exposto. A configuração não ativa Discussions nem cria publicações automaticamente.

Endpoints: `GET /api/discussions?category=ID&after=CURSOR` e `GET /api/discussions/{numero}?after=CURSOR`. Compartilhe tópicos pelo endereço `/forum?conversa=NUMERO`.

Referência: [API GraphQL para Discussions](https://docs.github.com/en/graphql/guides/using-the-graphql-api-for-discussions).

Consulte o [guia de moderação do fórum](docs/moderacao-forum.md) para tratar spam e avaliar limites temporários do GitHub.

A rota `/forum` apresenta tópicos com busca e filtro por categoria. Cada página lista 20 tópicos e até 20 comentários. Respostas encadeadas mostram cinco itens e um link para continuar no GitHub.

A pesquisa acontece ao digitar, após uma pausa de 400 ms, e também ao pressionar Enter. Dentro do tópico, os comentários e respostas aparecem com linhas de encadeamento e podem ser recolhidos. A publicidade fica entre o tópico e o campo para comentar, em um cartão com menu para consultar o espaço reservado. O GitHub mantém respostas vinculadas ao comentário principal. A interface preserva essa estrutura.

### Publicar pelo Guia

Cadastre uma OAuth App no GitHub. Configure `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET` somente no backend, em User Secrets para desenvolvimento ou no gerenciador de segredos da hospedagem. O callback é `/api/auth/callback`, no mesmo endereço usado para abrir o site. Por exemplo, `http://localhost:5081/api/auth/callback` no desenvolvimento com Vite. Em produção, cadastre `https://guiadati.com` em **Homepage URL** e `https://guiadati.com/api/auth/callback` em **Authorization callback URL** da OAuth App. Defina `FORWARDED_PROXY_IP` com o IP do proxy reverso para o backend reconhecer o protocolo HTTPS. O fluxo usa OAuth com PKCE e o escopo `public_repo` exigido pela API para publicar em nome do visitante em repositórios públicos.

O login abre em uma janela menor e retorna para `/auth/complete.html`, que avisa a página original e fecha a janela. O Guia confirma a sessão pelo backend e atualiza o usuário sem recarregar a página. Se o navegador bloquear a janela, o login usa a navegação normal. A foto de perfil usa o ID autenticado do GitHub. No ambiente local, o Vite redireciona `127.0.0.1` para `localhost` para manter o endereço cadastrado no OAuth.

O login aparece quando as duas configurações existem. A sessão dura sete dias e renova a validade durante o uso. O cookie HttpOnly permanece depois de fechar o navegador. O token fica criptografado no servidor. Reiniciar o servidor preserva o login. Esta implementação atende uma instância. Várias instâncias exigem armazenamento de sessões compartilhado. Os endpoints de publicação e saída validam CSRF. Falhas preservam o rascunho. A API recusa categorias de outros repositórios, respostas de outros tópicos, comentários moderados e tópicos encerrados. O GitHub valida as permissões de cada pessoa, inclusive categorias de anúncios. A administração de categorias permanece no GitHub.

As sessões e suas chaves ficam em `App_Data/auth`, fora do Git e dos arquivos públicos. Em produção, defina `AUTH_STORAGE_PATH` com o caminho absoluto de uma pasta persistente, por exemplo `/var/lib/guia-da-ti/auth`. Preserve toda a pasta nas atualizações. Restrinja o acesso ao usuário que executa o servidor. No Windows, as chaves também usam a proteção do sistema operacional. Apagar as sessões ou as chaves exige um novo login. A saída da conta remove sua sessão do servidor e revoga o token dessa sessão no GitHub. Sessões expiradas são apagadas na inicialização e uma vez por dia. O inventário dos dados salvos, os riscos e a resposta a incidentes estão em [docs/seguranca-dados.md](docs/seguranca-dados.md). A mudança do armazenamento anterior exige entrar novamente uma vez.

A página consulta a sessão ao receber foco e a cada minuto enquanto está visível. Se a consulta falhar, preserva o usuário confirmado e tenta novamente após cinco segundos. Respostas antigas não substituem o login recém-concluído. A renovação segue o [comportamento de cookies do ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/cookie?view=aspnetcore-10.0).

Uma barra abaixo do menu mostra o botão **Como usar o Guia**, que abre um diálogo com dicas para cada seção. Você pode fechar a barra. O navegador salva essa escolha e mantém a barra oculta nas próximas visitas, inclusive ao trocar de página. A linha do tempo acompanha a rolagem com GSAP. As demonstrações usam o [player do Hyperframes](https://hyperframes.app/docs/5-packages/player), com arquivos locais e carregamento apenas quando entram na área visível. Você pode pausar cada demonstração. A preferência de movimento reduzido mostra as cenas estáticas. O diálogo usa os componentes de botão e diálogo do shadcn.

Ao lado dos títulos das listagens, o botão de dicas explica por que usar a seção e como escolher entre as opções. As dicas de cada categoria abrem mesmo depois de fechar a barra. A página inicial apresenta o projeto em uma linha do tempo com demonstrações. **Primeira vez no GitHub?** abre outro passo a passo, desde criar a conta até participar pelo Guia.

As dicas das categorias têm quatro etapas: **O que é**, **Por que vale a pena**, **Como escolher** e **Como usar esta seção**. Cada etapa mostra sua própria demonstração, com pausa e carregamento conforme entra na área visível.

Na primeira visita a cada rota com esse botão, um cursor animado aponta para o ícone e simula um clique. A animação não abre o diálogo. O navegador salva a exibição por rota e não a repete nas próximas visitas. A preferência de movimento reduzido desativa esse destaque.

Endpoints: `GET /api/auth/session`, `GET /api/auth/login`, callback OAuth em `/api/auth/callback`, `POST /api/auth/logout` e `POST /api/discussions/publish`. Para publicar, envie o cabeçalho `X-CSRF-Token` recebido na sessão e JSON com `body`. Um tópico novo também exige `title` e `categoryId`. Comentário usa `number`. Resposta acrescenta `replyToId` do comentário principal. Sem login configurado, a leitura e os links para o GitHub continuam funcionando.

### Contas únicas que já entraram

O servidor registra contas que entraram com GitHub uma vez por ID. A página inicial não exibe esse total. `GET /api/community/users` retorna `registeredUsers` e `trackingSince`, sem cache.

O registro fica por padrão em `App_Data/community-users.json`, fora do Git, dos arquivos públicos e dos artefatos de publicação. Para produção, defina `COMMUNITY_USERS_PATH` com o caminho absoluto de um arquivo em armazenamento persistente, por exemplo `/var/lib/guia-da-ti/community-users.json`, e preserve esse arquivo nas atualizações e backups. O diretório precisa permitir escrita pelo processo do site. Essa camada usa um arquivo com gravação atômica para uma única instância. Múltiplos processos ou réplicas precisam de um registro compartilhado com controle de concorrência. Se a leitura falhar, o site mostra indisponibilidade. Falhas de gravação são registradas no servidor e não bloqueiam o login.

### Apoiadores e mantenedores

Os apoiadores aparecem na página inicial em `/#apoiadores`. O build valida a lista `supporters` em `community.json`, incluindo campos, URLs HTTPS e duplicados. Novos apoiadores entram por PR no repositório de dados. Depois, atualize o ponteiro do submódulo.

A página inicial apresenta o Guia, os recursos do catálogo, as categorias e os apoiadores. O indicador ao vivo aparece no rodapé. `GET /api/community/activity` retorna `activeUsers` e `windowMinutes`, sem cache ou dados pessoais. A contagem inclui visitantes com a página visível nos últimos cinco minutos. Um cookie anônimo HttpOnly e SameSite Strict identifica cada navegador. Várias abas contam uma vez. O servidor mantém a presença na memória e remove visitantes após cinco minutos sem atividade. Ao reiniciar, a contagem zera. Para compartilhar a presença entre réplicas, é necessário armazenamento compartilhado.

Os mantenedores de `/#mantenedores` vêm diretamente de `GET /api/contributors`, que consulta a API de contribuidores do GitHub nos repositórios públicos disponíveis, percorre todas as páginas e reúne os usuários pelo ID sem duplicados. Bots e autores anônimos não aparecem. A lista representa autores de commits reconhecidos pelo GitHub, com a soma das contribuições nos repositórios. Não inclui automaticamente participantes de issues ou Discussions. O servidor mantém cache por uma hora, e o próprio GitHub pode atrasar o reconhecimento de novos commits. A consulta pública funciona sem login do visitante; `DISCUSSIONS_TOKEN`, quando configurado, também autentica essas consultas no servidor. O servidor ignora repositórios privados ou indisponíveis e mantém os mantenedores dos repositórios públicos acessíveis.

`GITHUB_APP_REPOSITORY` define o repositório da aplicação, com padrão `guia-da-ti/guia-da-ti`. O repositório de dados usa `DISCUSSIONS_REPOSITORY`. Atualize ambos após transferir os repositórios para uma organização.

A migração dos dois repositórios para uma organização está descrita em [docs/github-organization.md](docs/github-organization.md).

## Verificação e estágio atual

```powershell
npm --prefix tools/catalog test
dotnet run --project web/backend/GuiaDaTi.Api.Tests
./scripts/build.ps1
# Com o servidor em execução:
./scripts/smoke.ps1
```

A página inicial apresenta o Guia, as métricas, os mantenedores e os apoiadores. O fórum fica em `/forum`. A navegação começa por Início, Fórum e Comunidades. Criadores continua em `/criadores`, e as demais categorias mantêm os grupos atuais. `/sobre` redireciona para `/`. Os endereços antigos `/apoiadores` e `/contribuidores` redirecionam para âncoras na página inicial.

Todos os controles visuais usam componentes do registry oficial shadcn/ui: Button, Input, Card, Badge, DropdownMenu, Select, Separator e Empty. A composição das páginas usa Tailwind e tokens de tema laranja, sem os antigos componentes visuais manuais. Para atualizar componentes: `npx shadcn@latest add <nome> --overwrite`, dentro de `web/frontend`.

Com o site rodando em `http://localhost:5081`, execute `npm --prefix web/frontend run test:ui` para verificar menus, teclado, busca, estados vazios, página inicial, tema escuro, filtro de idioma e região e largura de tela no Chrome. Os testes de conversas usam respostas simuladas no navegador para verificar categorias, paginação, leitura, respostas, falha e nova tentativa, sem publicar no GitHub. Os testes .NET verificam o cliente GraphQL com um servidor HTTP simulado. Use `TEST_URL` e `CHROME_PATH` para outros endereços e instalações. `English (United States)` mostra apenas cadastros com idioma `en` e país `US` explicitamente marcado.

Mapa e filtros avançados permanecem no [plano](IMPLEMENTATION_PLAN.md). Veja a [arquitetura](ARCHITECTURE.md) e o [guia original](guia.md.txt).

### Perfis de criadores

Ao colar um perfil em Contribuir (categoria Criadores ou YouTube), o site busca nome, descrição, foto e seguidores quando a rede disponibiliza esses dados. O cadastro permite revisar os campos antes de enviar. A listagem busca os dados pelo link aprovado no catálogo. Os dados externos têm cache de 30 minutos e não alteram o catálogo automaticamente. Perfis fictícios não são consultados.

`GET /api/creators/profile?url=...` aceita apenas HTTPS nos domínios das cinco redes e rotas de perfil. Links ainda não catalogados exigem login. Redirecionamentos são bloqueados. Fotos usam apenas os CDNs das redes. Metadados públicos são uma alternativa parcial e podem estar bloqueados. Para importar inscritos do YouTube e seguidores do X pelas APIs oficiais, configure `YOUTUBE_API_KEY` e `X_BEARER_TOKEN` apenas no servidor (User Secrets), nunca em `VITE_*`. Sem esses acessos, alguns campos podem ficar indisponíveis. Contagens ocultas não são convertidas em zero e nenhum dado é inventado.

### Comunidades por localização

`/comunidades` mostra todas as comunidades em ordem alfabética sem filtros. As abas com ícones filtram Geral, WhatsApp, Telegram, Discord, Facebook, LinkedIn, Reddit, GitHub e Outra. Geral inclui todos os cadastros. Outra reúne as plataformas restantes com metadados confirmados. O botão Filtrar comunidades abre apenas o diálogo de localização. A aba selecionada combina com o mapa e fica em `?plataforma=discord`. Limpar a localização preserva a plataforma. Os filtros são aplicados apenas após confirmar. Cancelar preserva a seleção anterior. O mapa SVG permite selecionar várias UFs. No modo Regiões, clicar num estado seleciona a região inteira. Os botões de região também podem ser combinados. Brasil inteiro filtra apenas comunidades nacionais. Internacionais filtra comunidades globais ou de fora do Brasil. As seleções são compartilháveis por `?alcance=regional&estados=SP,RJ`, `?alcance=national` e `?alcance=international`. Uma comunidade regional aparece quando atende pelo menos uma UF selecionada. O resultado não duplica cadastros. A lista de estados permite selecionar UFs pequenas e todo o filtro funciona com teclado.

O campo opcional `communityLocation` usa `{ "scope": "regional", "states": ["SP", "RJ"] }`, `{ "scope": "national" }` ou `{ "scope": "international" }`. Novas sugestões de comunidades exigem localização, categoria, plataformas e modalidade. Esses dados acompanham a proposta de revisão do catálogo. Cadastros antigos sem metadados permanecem na lista sem filtros. Campos ausentes não correspondem a um filtro específico, sem inferir alcance por idioma ou país. Os schemas da aplicação e do submódulo de dados foram atualizados juntos.

O mapa usa [malhas simplificadas do IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3), convertido em um SVG local com as 27 UFs, sem consulta externa durante a navegação. Para gerar o asset novamente: `node web/frontend/scripts/prepare-brazil-map.mjs [arquivo-GeoJSON]`. Execute `npm --prefix web/frontend run test:location` para verificar combinações, isolamento de escopos e links compartilhados.

As plataformas de comunidade são WhatsApp, Telegram, Discord, Slack, Facebook, LinkedIn, Meetup, Reddit, GitHub Discussions, Discourse, Circle, Mighty Networks, site próprio e outra plataforma. Modalidades: `online`, `in-person` e `hybrid`. Campos: `communityPlatforms` (array com ao menos uma plataforma) e `communityModality`. Categorias continuam em `areas`. O alcance, a plataforma e a modalidade são dimensões independentes: uma comunidade nacional pode ter encontros presenciais e usar Discord. As plataformas não são inferidas pelo link nem pelo idioma.

Ao selecionar Internacionais, o diálogo mostra o mapa mundial em laranja com GSAP. A animação respeita `prefers-reduced-motion`. O asset local usa [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), em domínio público, e pode ser atualizado com `node web/frontend/scripts/prepare-world-map.mjs [arquivo-GeoJSON]`.

Toda página válida, exceto o próprio formulário de contribuição, expõe um botão de sugestão. O texto corresponde à categoria e o link `/contribuir?categoria=communities` preseleciona o formulário.

### Sugestões e animações de entrada

`POST /api/contributions` valida a sugestão e abre um Pull Request para `main` em todas as categorias. A API usa a credencial do visitante. Mantenedores enviam o PR a partir do repositório do catálogo. Para visitantes, o servidor reutiliza ou cria uma cópia pública e confirma que ela pertence ao catálogo. O PR nunca é mesclado automaticamente. O fórum continua separado para conversas. O cadastro aparece no site após o merge e a publicação do catálogo. Se o envio falhar, o formulário preserva os dados.

O script público `theme.js`, carregado antes dos estilos, aplica o tema salvo e prepara a entrada das rotas. O GSAP revela o conteúdo em 450 ms. Componentes novos, diálogos e menus mantêm suas animações. Movimento reduzido exibe tudo imediatamente. Se o bundle não carregar, o conteúdo é liberado após 1,5 segundo. O teste de navegação registra quadros de entradas nos dois temas e verifica que a opacidade progride sem voltar a ocultar o conteúdo.
