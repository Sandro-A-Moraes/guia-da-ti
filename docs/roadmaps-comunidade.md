# Roadmaps da comunidade

Um roadmap mostra a ordem em que estudar uma tecnologia ou uma área. Qualquer pessoa pode propor um roadmap novo ou sugerir mudanças em um que já existe. Os mantenedores revisam tudo antes de publicar.

As regras de conteúdo e de revisão estão em [Roadmaps da comunidade](https://github.com/guia-da-ti/guia-da-ti-dados/blob/main/docs/roadmaps.md), no repositório de dados. Este guia explica o uso do site.

## Propor um roadmap

1. Entre com o GitHub.
2. Abra **Roadmaps** e clique em **Sugerir roadmap**.
3. Escolha **Montar um roadmap aqui**. A outra opção indica um roadmap de outro site.
4. Preencha as quatro etapas: identificação, classificação, estrutura e revisão.
5. Marque a caixa que avisa que o conteúdo entra no catálogo público e envie.

O Guia abre um PR no GitHub em seu nome. Use **Acompanhar PR** para ver a revisão. O roadmap aparece no site depois do merge e da próxima publicação do catálogo.

## Montar a estrutura

- Um roadmap tem de 2 a 20 blocos e de 5 a 150 etapas e subetapas.
- Cada etapa pode ter até 12 subetapas, em um só nível.
- A explicação de uma etapa tem até 400 caracteres.
- Marque cada etapa como essencial, recomendada ou opcional.
- Use **Agrupar como alternativa com a próxima** quando a pessoa só precisa escolher uma opção.
- Suba, desça ou remova itens com os botões de cada bloco e etapa. Não há arrastar e soltar.
- Cada etapa aceita até 8 recursos do catálogo. Se um recurso não existe, sugira o recurso antes pelo botão **Contribuir**.
- Cada etapa aceita até 3 links externos. Eles aparecem com o selo **Fora do catálogo**.

## Rascunho no navegador

O editor salva seu rascunho no navegador enquanto você escreve. Ao voltar, ele avisa **Rascunho recuperado**, e você pode descartá-lo. O Guia apaga o rascunho depois de um envio com sucesso. Se o navegador bloquear o armazenamento, o editor funciona sem rascunho.

## Sugerir alteração

1. Abra a página do roadmap e clique em **Sugerir alteração**.
2. O editor abre com a versão atual do arquivo.
3. Mude o que precisa e envie.

O PR traz um resumo em português do que mudou. A pessoa que criou o roadmap é avisada no PR.

Se outra edição for aprovada antes do seu envio, o Guia recusa a sua e mostra um aviso. Copie seu texto, clique em **Abrir o editor de novo** e refaça a mudança sobre a versão mais recente.

## Limites e revisão

Cada pessoa pode ter até 3 propostas de roadmap abertas ao mesmo tempo. Nenhuma proposta publica direto. Um mantenedor aprova cada uma.

## Autoria e atualização

A página mostra quem criou o roadmap e quem contribuiu, a partir do histórico do arquivo no Git. O dado é atualizado a cada hora. Um roadmap sem revisão há 12 meses mostra o aviso de que pode estar desatualizado.

## Para mantenedores

### Revisar um PR

- O título começa com `Roadmap:`. O corpo lista o que mudou.
- Confira os critérios do [guia do repositório de dados](https://github.com/guia-da-ti/guia-da-ti-dados/blob/main/docs/roadmaps.md): público claro, ordem lógica, recursos no catálogo e texto sem ranking, propaganda ou promessa de emprego.
- A validação automática recusa estrutura inválida e recursos inexistentes. Ela não julga a qualidade do conteúdo.
- Se um recurso citado ainda está em PR, aprove o recurso primeiro.

### Divergência e PR parado

- Peça que o motivo da mudança fique no PR e decida pelos critérios da revisão.
- Se a diferença for de objetivo ou de nível, peça um roadmap separado.
- Nas edições, espere alguns dias pela opinião do criador, que o PR menciona. A decisão final é dos mantenedores.
- Um PR parado ocupa uma das 3 vagas da pessoa. Feche ou responda os que passaram do prazo.

### Link do Guia no PR

O PR traz a linha **Página no Guia** quando o backend tem `SITE_URL`. A variável é opcional. Ela precisa ser um endereço HTTPS sem usuário e senha. O backend usa só a origem e monta `/roadmaps/<slug>`. Sem `SITE_URL` válida, a linha some e o PR segue normal.

### Pedido ao administrador do repositório de dados

Hoje há um único revisor em `.github/CODEOWNERS`. Peça ao administrador de `guia-da-ti-dados` para:

- Exigir 1 aprovação antes do merge na `main`.
- Incluir mais revisores para `/data/roadmaps/` no `CODEOWNERS`.

Isso é configuração do repositório. O código do Guia não faz essa mudança.
