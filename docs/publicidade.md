# Administração de anúncios

Para usar o painel, comece pelo [passo a passo com exemplos](como-usar-painel-anuncios.md). Este documento reúne as regras de funcionamento e armazenamento.

O painel fica em `/admin/anuncios`. A conta administradora vê **Administrar anúncios** no menu do perfil depois de entrar com GitHub.

O servidor permite acesso ao ID GitHub `147441250`, da conta `LucasPedruo`. O nome do perfil não concede acesso. A configuração `ADS_ADMIN_GITHUB_ID` permite trocar o responsável. Cada alteração exige a sessão autenticada e a proteção de formulário usada pelo Guia.

## Espaços e limites

| Espaço | Onde aparece | Vagas iniciais |
| --- | --- | --- |
| Lista do fórum | Entre os tópicos do Início | 5 |
| Conversas do fórum | Depois do tópico, antes dos comentários | 5 |
| Discussões de Estudar | Na conversa vinculada ao item, antes dos comentários | 5 |

Cada espaço mostra um anúncio por vez. As vagas limitam quantas campanhas podem participar da rotação no mesmo período. As datas de campanhas habilitadas não podem ultrapassar a capacidade do espaço, inclusive em agendamentos futuros.

O painel começa com limite de 100 cadastros e troca a cada 45 segundos. Você pode escolher até 500 cadastros, de 1 a 20 vagas por espaço e de 15 a 300 segundos de intervalo.

## Cadastrar e exibir

O controle **Publicidade no site** habilita ou desabilita todos os anúncios. Essa escolha fica salva no servidor e preserva as datas e pausas individuais.

Preencha empresa, título, descrição e site de destino. Você pode enviar uma imagem PNG, JPG ou WebP de até 2 MB ou informar um link público HTTPS. A prévia acompanha o preenchimento.

Escolha os espaços, a prioridade e o início da campanha. O término é opcional. Um cadastro novo começa pausado. Habilite a campanha para participar da rotação dentro do período escolhido.

A seleção considera o espaço, as datas e a prioridade de 1 a 10. Quando há alternativas, ela evita repetir o anúncio anterior na próxima troca. Com duas campanhas, elas se alternam. Com três ou mais, a prioridade influencia a seleção entre as alternativas.

Fora da tela ou com a aba oculta, o anúncio não troca. Ao voltar, o espaço consulta as campanhas novamente. Sem campanha disponível, ele mostra o espaço reservado.

Os anúncios não mudam as posições do catálogo. As empresas apoiadoras continuam com a apresentação separada no Início e em Sobre. A prévia de `/empresas` não exibe campanhas nem soma contadores.

## Contadores

Uma exibição conta quando pelo menos metade do anúncio fica visível por um segundo, com a aba aberta. O clique conta quando a pessoa abre o site pelo anúncio. Os contadores não representam pessoas únicas e não são uma medição auditada de audiência.

O servidor emite uma autorização temporária para cada anúncio selecionado. Repetir o mesmo registro de exibição ou clique não soma novamente. Essa autorização expira após dez minutos. O destino do clique vem do cadastro, sem aceitar um endereço enviado por quem clica.

## Armazenamento

As campanhas, configurações e contadores ficam em `web/backend/GuiaDaTi.Api/App_Data/advertising.json`. As imagens enviadas ficam em `App_Data/contribution-images`. Esses dados ficam no servidor e sobrevivem a reinicializações. O catálogo público continua no GitHub.

Em produção, configure `ADS_STORAGE_PATH` para apontar para um arquivo persistente e `CONTRIBUTION_IMAGES_PATH` para uma pasta persistente. Preserve esses dados e as chaves de autenticação nas atualizações. A estrutura atende uma instância do servidor. Ela não sincroniza arquivos entre máquinas.

O servidor grava primeiro um arquivo temporário e depois substitui o anterior. Ele serializa alterações concorrentes para impedir reservas acima do limite. Se o arquivo existente estiver inválido, informa a falha e preserva o conteúdo para recuperação.

Excluir uma campanha remove também seus contadores. O painel pede confirmação antes dessa ação.

## Registro de ações

Cada alteração feita no painel gera uma linha no log do servidor, na categoria `GuiaDaTi.Audit.Advertising`. O registro cobre criar, editar, pausar, retomar e excluir campanhas, mudar as configurações e ligar ou desligar todos os anúncios.

Cada linha traz:

- `action`: a operação, como `campaign.create`, `campaign.pause` ou `ads.disable`.
- `actor`: o ID numérico da conta GitHub que fez o pedido.
- `target`: o ID da campanha, `settings` ou `global`.
- `outcome` e `status`: o resultado e o código HTTP.
- `requestId`: o ID da requisição.
- `at`: o horário em UTC.

Falhas também entram no registro. Os resultados possíveis são `success`, `validation`, `not_found`, `invalid_image`, `storage`, `forbidden`, `csrf`, `cancelled` e `error`. Tentativas de uma conta sem permissão ou sem token CSRF aparecem com o ID de quem tentou.

O log não guarda empresa, título, descrição, endereços, tokens nem mensagens de erro. Para saber o que mudou, compare com o backup de `advertising.json`.

Toda resposta do painel traz o cabeçalho `X-Request-Id`. Ele tem o mesmo valor do `requestId` no log. Se uma ação falhar, copie esse valor para achar a linha correspondente:

```bash
docker logs "$(docker ps -q --filter label=com.docker.compose.service=app)" 2>&1 | grep AdminAudit
```

Leituras do painel e acessos sem login não entram no registro. Um pedido com JSON malformado é recusado antes do filtro e também não aparece.

No Docker, o log fica em até três arquivos de 10 MB. Em um site muito movimentado, linhas antigas podem sair do rodízio. Copie o log para outro lugar se precisar de um histórico maior.
