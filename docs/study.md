# Estudar: listagem, avaliações e fórum

As categorias de cursos, plataformas, faculdades, bootcamps, roadmaps, livros e certificações usam cards (quatro colunas no desktop) ou lista. Pesquisa, ordenação e paginação se combinam. A URL preserva `q`, `ordem`, `visualizacao` e `pagina`.

Em **Roadmaps**, cada item mostra o selo **Comunidade do Guia** ou **Fonte externa**. Os roadmaps da comunidade também mostram a linha "N etapas · Nível". O filtro **Origem** oferece **Todas as origens**, **Comunidade do Guia** e **Fonte externa**. Ele aparece no endereço como `?origem=comunidade` ou `?origem=externa` e volta à primeira página quando você muda a seleção. Um roadmap da comunidade abre uma página do Guia com a trilha. Um roadmap externo leva ao site de origem. Veja [Roadmaps da comunidade](roadmaps-comunidade.md).

Cards e linhas usam o mesmo destaque ao passar o mouse que a listagem de criadores. Clique em qualquer área do item para abrir os detalhes. Os links também funcionam pelo teclado e permitem abrir uma nova aba.

Em **Faculdades**, o filtro **Tipo de instituição** oferece **Todas as instituições**, **Pública** e **Privada**, ao lado da pesquisa. Ele funciona com a pesquisa e a ordenação, aparece no endereço da página e volta à primeira página quando você muda a seleção. A sugestão de faculdade exige essa informação. O catálogo guarda a classificação em `universityType`, com os valores `public` e `private`.

O padrão é **Mais hypado**. Você também pode ordenar por comentários, interações ou nota média. Empates ficam em ordem alfabética. No empate de notas, a quantidade de avaliações vem primeiro. Interações são a soma de avaliações, hypes e mensagens. Não há contagens simuladas. Uma falha de leitura aparece como indisponibilidade, não como zero.

Cada conta autenticada do GitHub pode alterar uma avaliação de 1 a 5 e ativar/remover um hype. O identificador numérico da conta impede votos duplicados mesmo depois de uma troca de nome. Escritas exigem sessão e CSRF. Itens fictícios não recebem participação.

`STUDY_ACTIVITY_PATH` configura o arquivo persistente do servidor, com padrão `App_Data/study-activity.json`. O armazenamento segue o registro existente de contas. Ele usa escrita atômica, sincroniza acessos simultâneos em uma instância e mantém os dados fora do Git. Preserve `App_Data` em um volume persistente e faça backup. Para usar múltiplas instâncias, configure um banco compartilhado. Isso não é localStorage nem um banco SQL. O arquivo guarda votos e o número dos tópicos, sem tokens ou textos de comentários.

O primeiro comentário cria um tópico no GitHub Discussions, em nome do visitante autenticado. A categoria padrão é **Geral**, configurável por `STUDY_DISCUSSION_CATEGORY`. O título identifica `tipo/slug`. Mensagens posteriores usam esse tópico. Se o salvamento do vínculo falhar, a recuperação procura o tópico diretamente no repositório. Ela não depende da indexação da busca. A primeira mensagem do tópico também entra na contagem de comentários. A leitura exige a configuração existente de Discussions. As escritas usam exclusivamente o OAuth do visitante.

Os 64 recursos da curadoria têm imagens locais em `web/frontend/src/assets/study/<tipo>/<slug>.webp` ou SVG. Os cards mostram capas, marcas ou imagens oficiais dos sites. As fontes e datas ficam em [sources.json](../web/frontend/src/assets/study/sources.json). As imagens carregam conforme você percorre a listagem. O fundo de cada imagem preserva a leitura das marcas claras. Itens de demonstração continuam com o ícone padrão.

Para buscar as imagens, use `node --use-system-ca web/frontend/scripts/download-study-images.mjs`. Depois, execute `node web/frontend/scripts/prepare-study-images.mjs` para validar os arquivos no Chrome e reduzir as imagens maiores. Confira a prévia gerada antes de aceitar novas imagens. As escolhas verificadas ficam em `study-image-overrides.json`, junto aos scripts. A busca automática pode encontrar marcas de parceiros em vez da marca do site.

Os cadastros continuam vindo do catálogo público do GitHub. A curadoria inicial reúne 64 recursos verificados em 07/10/2026. As fontes estão em [Curadoria de Estudar](../database/docs/curadoria/estudar-2026-10-07.md). Novos cadastros seguem o fluxo de contribuição e revisão.
