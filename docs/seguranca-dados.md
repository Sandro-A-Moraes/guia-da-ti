# Segurança dos dados, sessões e tokens

Revisão feita em 15/10/2026 para a issue [#16](https://github.com/guia-da-ti/guia-da-ti/issues/16).
Ela cobre o código, o pipeline e o deploy descritos neste repositório. A revisão não teve acesso à VPS de produção.
Os itens marcados como **pendente em produção** precisam de conferência no servidor. A leitura do código não comprova o estado do ambiente.

Não há evidência de vazamento nos trechos examinados. O Guia salva dados no servidor, e um acesso indevido a esses arquivos tem impacto real.

## Dados salvos

| Dado | Local | Conteúdo | Quem vê | Retenção |
| --- | --- | --- | --- | --- |
| Catálogo | Repositório `guia-da-ti-dados` | Cadastros aprovados | Público | Histórico do Git |
| Fórum | GitHub Discussions | Tópicos, comentários e autores | Público | Controlada no GitHub |
| Sessões | `App_Data/auth/sessions/*.ticket` | Login, ID do GitHub, token OAuth e validade | Só o servidor | Até 7 dias sem uso |
| Chaves de criptografia | `App_Data/auth/keys/*.xml` | Chaves do ASP.NET Core Data Protection | Só o servidor | Renovadas a cada 90 dias. As antigas continuam no anel. |
| Contas que já entraram | `App_Data/community-users.json` | IDs numéricos do GitHub e data inicial | A API pública retorna só a contagem | Sem prazo definido |
| Atividade de estudos | `App_Data/study-activity.json` | Nota e destaque por ID do GitHub, número do tópico | A API retorna médias, totais e a nota da própria pessoa | Sem prazo definido |
| Anúncios | `App_Data/advertising.json` | Campanhas, limites, contadores e recibos de exibição | Painel do administrador | Recibos expiram. Campanhas ficam até a exclusão. |
| Imagens pendentes | `App_Data/contribution-images/` | Imagens enviadas por pessoas logadas | Qualquer pessoa com o ID aleatório da imagem | Sem expiração. Tratado na issue #1. |
| Visitantes ativos | Memória do processo | ID anônimo do cookie `guia.visitor` | A API retorna só a contagem | 5 minutos |
| Avisos de contribuição | Memória do processo | Login e nome do cadastro enviado | Visitantes do site | 2 minutos |

O navegador recebe o cookie `guia.session` com um ID aleatório de 256 bits. O token do GitHub fica só no arquivo de sessão.
O token usa o escopo `public_repo`. Com ele, alguém pode publicar e alterar conteúdo nos repositórios públicos da pessoa. Repositórios privados ficam fora desse escopo.

A lista de IDs do GitHub não contém nomes, tokens ou senhas. Os IDs do GitHub são públicos, mas a lista revela quem usou o Guia.
As notas de estudo ficam ligadas a esses IDs. Esses dois arquivos exigem o mesmo cuidado das sessões nos backups.
Eles, os anúncios, as imagens e os arquivos de chave são criados com a máscara padrão do processo, em geral `644`. A pasta `data` com permissão `700` impede a leitura por outros usuários da VPS.

## Achados e correções

| Achado | Risco | Correção |
| --- | --- | --- |
| O `code` e o `state` do callback OAuth apareciam no log de requisições. | O log do Docker guardava um código de autorização. O PKCE reduz o uso indevido, mas o valor não deve ficar salvo. | O log de requisições do ASP.NET Core passou para o nível `Warning`. Teste manual: o código aparecia 2 vezes antes e nenhuma depois. |
| `Directory.CreateDirectory` só aplica permissões a pastas novas. | Pastas de sessões e chaves criadas por versões anteriores podiam manter leitura para grupo e outros usuários. | A aplicação aplica `700` em `auth`, `auth/keys` e `auth/sessions` a cada inicialização. Se a pasta pertencer a outro usuário e permitir acesso de grupo ou outros, a aplicação não inicia e o deploy volta à versão anterior. |
| Os arquivos de sessão usavam a máscara padrão do processo. | Com a pasta aberta, um usuário local podia copiar sessões. | Cada sessão é criada com permissão `600`. |
| Sessões abandonadas só eram apagadas se o mesmo cookie voltasse. | Tokens OAuth de sessões expiradas ficavam no disco por tempo indeterminado. | Sessões expiradas ou ilegíveis são apagadas na primeira consulta à sessão após a inicialização e, com o site em uso, uma vez por dia. Gravações interrompidas também são removidas. |
| Sair do Guia removia só a sessão local. | O token continuava válido no GitHub até a pessoa revogar a autorização. | A saída revoga o token da sessão na API do GitHub. Outras sessões da mesma pessoa continuam ativas. Se o GitHub falhar, a sessão local já foi removida e o erro vai para o log, sem o token. |
| O cookie de CSRF não exigia HTTPS. | Em uma requisição HTTP, o cookie poderia sair sem criptografia. | Em produção, o cookie de CSRF exige HTTPS, como o cookie de sessão. |
| O site não enviava HSTS. | Um primeiro acesso por HTTP podia ser interceptado antes do redirecionamento. | Fora do desenvolvimento, respostas HTTPS enviam `Strict-Transport-Security` por 30 dias, sem subdomínios e sem preload. |

O pipeline passou a conferir a imagem Docker antes de publicar. A verificação exige HTTP 404 para `App_Data`, a DLL e `runtime.env`, e permissão `700` nas pastas de sessões e chaves.

## Controles revisados sem mudança

- `App_Data` fica fora de `wwwroot`. O servidor só entrega arquivos estáticos de `wwwroot`. O `.gitignore` ignora `App_Data`, `runtime.env` e `deploy.env`. O `dotnet publish` exclui `App_Data`.
- O cookie de sessão é `HttpOnly`, `SameSite=Lax` e exige HTTPS em produção. Ele vale por 7 dias e renova com o uso.
- Todas as rotas de escrita exigem login e validam o cabeçalho `X-CSRF-Token`. A exceção é o registro de exibição de anúncios, que é anônimo e aceita só um recibo assinado.
- O painel de anúncios confere o ID do GitHub configurado em `ADS_ADMIN_GITHUB_ID`.
- Cada escrita no painel de anúncios gera uma linha de auditoria com ID da conta, ação, alvo, resultado e ID da requisição. Recusas por falta de permissão ou de CSRF também entram. O log não guarda o conteúdo do anúncio, endereços nem tokens. Veja [Registro de ações](publicidade.md#registro-de-ações).
- O retorno do login aceita apenas caminhos locais. Endereços externos, `//`, barras invertidas e caracteres de controle são recusados.
- O ID da sessão precisa ter 64 caracteres hexadecimais. Um ID não consegue apontar para fora da pasta de sessões.
- Os logs de erro do GitHub registram operação, motivo, status HTTP e ID da requisição. Tokens, variáveis e o texto enviado ficam fora do log.
- Em produção, erros não mostram detalhes técnicos ao visitante.
- O token de leitura do fórum (`DISCUSSIONS_TOKEN`) e o Client Secret ficam só em `runtime.env` na VPS, com permissão `600`.

## Riscos que continuam

- No Linux, as chaves do Data Protection ficam sem criptografia no disco. O próprio ASP.NET Core avisa isso no log ao criar uma chave.
  Quem obtiver `auth/keys` e `auth/sessions` juntos consegue ler os tokens de todas as sessões ativas. Proteja essas pastas e os backups com o mesmo cuidado de `runtime.env`.
- Um backup com `data` contém sessões, chaves, IDs do GitHub e notas de estudo. Guarde-o criptografado e fora da VPS. Restaurar um backup antigo pode reativar sessões que ainda não expiraram.
- Revogar a autorização no GitHub invalida o token, mas a sessão no Guia continua até expirar ou até a pessoa sair. Nesse período, publicar pelo Guia falha com a mensagem para sair e entrar novamente.
- Quem tem acesso ao Docker ou à conta `root` da VPS lê todos esses arquivos. A permissão de pasta não protege contra esse acesso.
- `community-users.json` e `study-activity.json` não têm prazo de retenção nem rota para a pessoa apagar os próprios dados. Essa decisão fica com os mantenedores e com o aviso de dados da issue #14.
- Imagens pendentes não expiram e qualquer pessoa com o ID consegue abri-las. A issue #1 trata desse limite.
- As rotas da API não têm limite de frequência. A issue #2 trata desse ponto.

## Conferir em produção

Estes passos dependem de acesso à VPS. Use a conta de deploy ou um administrador. Não copie valores de tokens ou chaves para issues, PRs ou chats.

```bash
root=/opt/guia-da-ti
# Dono 1654 e permissão 700 em data. Pastas de autenticação com 700.
stat -c '%a %u:%g %n' "$root/data" "$root/data/auth" "$root/data/auth/keys" "$root/data/auth/sessions"
# Nenhuma sessão legível por grupo ou outros usuários. Os demais arquivos podem ter 644 dentro de data.
find "$root/data/auth/sessions" -perm /077 -printf '%m %p\n'
stat -c '%a %n' "$root/runtime.env" "$root/deploy.env"
# Backups e cópias esquecidas na VPS.
find / -xdev \( -name 'community-users.json' -o -name 'key-*.xml' -o -name '*.ticket' -o -name 'runtime.env*' \) -not -path "$root/*" 2>/dev/null
# Nenhum token no log do container.
docker logs "$(docker ps -q --filter label=com.docker.compose.project=guia-da-ti --filter label=com.docker.compose.service=app)" 2>&1 | grep -E -c 'gho_|ghp_|github_pat_|code='
```

Pelo domínio público, confira:

1. `https://guiadati.com/App_Data/community-users.json`, `/App_Data/auth/keys` e `/runtime.env` retornam 404.
2. A resposta de `https://guiadati.com/health` traz `Strict-Transport-Security`. Sem esse cabeçalho, confira `FORWARDED_PROXY_IP`.
3. Depois de entrar, o cookie `guia.session` aparece com `Secure`, `HttpOnly` e `SameSite=Lax`.
4. Depois de sair, o log do container não mostra `GitHub token revocation failed`.

O Cloudflare e o Caddy podem ter regras próprias de cache, log ou cabeçalhos. Essas regras ficam fora do repositório e precisam de conferência no painel de cada serviço.

## Resposta a incidente

Siga a ordem abaixo quando houver suspeita de acesso a `data`, a um backup ou a `runtime.env`.

1. **Revogar os tokens dos visitantes.** Na OAuth App do Guia no GitHub, use **Revoke all user tokens**. Todas as pessoas precisarão autorizar de novo.
2. **Trocar o Client Secret.** Gere um novo secret na OAuth App, atualize `GITHUB_CLIENT_SECRET` em `runtime.env` e apague o antigo no GitHub.
3. **Invalidar as sessões.** Com o container parado, apague os arquivos de `data/auth/sessions`.
4. **Trocar as chaves.** Com o container parado, apague `data/auth/keys`. Isso também invalida os tokens de CSRF e os recibos de anúncios em andamento. A aplicação cria chaves novas ao iniciar.
5. **Trocar o token do fórum.** Revogue `DISCUSSIONS_TOKEN` no GitHub, gere outro e atualize `runtime.env`.
6. Reinicie o container e confira o login.
7. Registre data, escopo e passos executados, sem incluir valores de segredos.

Para invalidar só a sessão de uma pessoa, peça que ela saia do Guia ou revogue o acesso em **Authorized OAuth Apps** no GitHub.

## Limites desta revisão

- Nenhum comando foi executado na VPS. As permissões reais, os backups, os logs do container e as configurações do Cloudflare e do Caddy continuam pendentes em produção.
- A verificação da imagem no pipeline só roda no job `package`, que executa na `main`. Ela não roda em PRs.
- A revogação no logout foi testada com uma resposta simulada da API do GitHub. A chamada real depende da OAuth App de produção.

## Revisão de texto

Texto revisado com humanizer-br. Foram usadas frases curtas, ponto no lugar de ponto e vírgula e fatos concretos no lugar de adjetivos.
