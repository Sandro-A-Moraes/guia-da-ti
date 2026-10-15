# Publicar na VPS

O GitHub valida o catálogo, testa o frontend e verifica o backend. Depois, gera o site e testa a imagem Docker antes de enviar o pacote por SSH.
A VPS executa o Guia com Docker Compose. O processo usa apenas o projeto `guia-da-ti`. Outros serviços permanecem em projetos separados.

O deploy automático fica desativado até validar a primeira publicação e definir `VPS_DEPLOY_ENABLED=true`.
Para o primeiro deploy, execute o workflow manualmente na `main` com a opção **Publicar manualmente na VPS** marcada.
PRs só executam as verificações. Eles não recebem as credenciais da VPS nem publicam a aplicação.

## Quando publica

- Um push na `main` publica depois que o build passa.
- A execução manual na `main` atualiza o catálogo aprovado. Ela publica quando a opção de deploy está marcada ou a automação está ativada.
- O agendamento por hora atualiza o catálogo aprovado e publica. O GitHub pode atrasar os agendamentos.
- Execuções de outras branches não publicam. Uma execução é recusada se a `main` já tiver mudado antes de preparar a imagem.

A publicação substitui um container. Pode haver uma breve interrupção. Se a nova versão não ficar saudável, o script tenta restaurar a anterior.
O rollback cobre falhas no healthcheck do container e na consulta HTTPS a `/health` pelo domínio público.
Se a falha estiver no proxy ou no Cloudflare, retornar a aplicação à versão anterior pode não resolver o acesso.
Na primeira publicação, ainda não existe uma versão anterior para restaurar.
O retorno à versão anterior não restaura os arquivos de dados. Faça backup antes de uma mudança que altere seu formato.

## Preparar o servidor uma vez

Requer uma VPS Linux x64 com Docker Engine, Docker Compose com suporte a `up --wait`, Bash, `flock`, `tar` e `gzip`.
O Docker da VPS precisa aceitar imagens Linux x64. O workflow usa runners Ubuntu x64.

Use uma conta de SSH para deploy com acesso ao Docker. No exemplo abaixo, essa conta já existe e se chama `deploy`.
O pipeline recusa o usuário `root`. Use uma chave ED25519 exclusiva para o GitHub Actions.
Restrinja essa chave em `authorized_keys` com `restrict`. Não reutilize a chave de acesso pessoal.
O acesso ao Docker permite ações com privilégio de administrador. Use essa conta apenas para o deploy e proteja o ambiente `production`.
Execute a preparação como administrador. Não reinstale o Docker nem altere os outros serviços para usar este fluxo.

```bash
sudo install -d -m 750 -o deploy -g deploy /opt/guia-da-ti
sudo install -d -m 750 -o deploy -g deploy /opt/guia-da-ti/incoming /opt/guia-da-ti/releases
sudo install -d -m 700 -o 1654 -g 1654 /opt/guia-da-ti/data
```

O usuário `app` da imagem .NET usa o ID `1654`. Ele precisa escrever em `data`.
Em AlmaLinux com SELinux, o volume usa `:Z` para aplicar o rótulo desse container. Use uma pasta exclusiva para os dados do Guia.

Copie estes exemplos para a VPS e ajuste os valores:

| Arquivo no repositório | Destino na VPS | Uso |
| --- | --- | --- |
| `deploy/deploy.env.example` | `/opt/guia-da-ti/deploy.env` | Porta e limites de recursos |
| `deploy/runtime.env.example` | `/opt/guia-da-ti/runtime.env` | Configuração e credenciais da aplicação |

```bash
sudo chown deploy:deploy /opt/guia-da-ti/deploy.env /opt/guia-da-ti/runtime.env
sudo chmod 600 /opt/guia-da-ti/deploy.env /opt/guia-da-ti/runtime.env
```

O exemplo usa a porta local `5082`, dois núcleos e limite de memória de `2g` para o Guia.
Esses limites são ajustáveis. Eles não garantem capacidade para uma quantidade de visitantes.
Confirme que a porta está livre e ajuste os limites conforme o consumo dos serviços existentes e os testes de carga.

Mantenha os caminhos de armazenamento dentro de `/app/App_Data`.
Essa pasta recebe sessões, chaves de login, anúncios, atividade de estudo e imagens enviadas. Ela permanece na VPS entre versões.
Se o Guia já estiver rodando, migre todos esses dados para `data` antes da troca. Não substitua o serviço antigo antes de verificar a nova instalação.

## Configurar o GitHub

Em **Settings → Environments**, crie `production`. Restrinja esse ambiente à `main`.
Se escolher exigir revisão de deploy, a execução aguardará essa revisão.

Cadastre as variáveis abaixo em **Settings → Secrets and variables → Actions → Variables** do repositório:

| Variável | Valor |
| --- | --- |
| `VPS_DEPLOY_ENABLED` | `false` até validar o primeiro deploy. Depois, troque para `true`. |
| `VPS_HOST` | `143.95.174.27` |
| `VPS_PORT` | `22022` |
| `VPS_USER` | Conta usada para o deploy |
| `VPS_PATH` | `/opt/guia-da-ti`. Também aceita `/opt/OUTRO_NOME`, sem subpastas. |
| `SITE_URL` | `https://guiadati.com` |

Cadastre estes secrets no ambiente `production`:

| Secret | Conteúdo |
| --- | --- |
| `VPS_SSH_KEY` | Chave privada dedicada ao deploy, sem senha interativa |
| `VPS_KNOWN_HOSTS` | Entrada SSH da VPS com a chave do servidor conferida |

Instale a chave pública correspondente na conta de deploy da VPS.
Confira a impressão digital da chave do servidor por um acesso confiável antes de cadastrar `VPS_KNOWN_HOSTS`.
Para uma porta diferente de `22`, a entrada deve identificar `[HOST]:PORTA`.
O workflow recusa conexões com uma chave de servidor diferente. Não desativa a conferência de identidade do SSH.

As credenciais da aplicação ficam em `runtime.env` na VPS. Preencha `DISCUSSIONS_TOKEN` para habilitar o fórum.
Preencha `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET` para login e publicação pelo visitante.
Não coloque esses valores no frontend nem nos exemplos versionados.

## Conectar o domínio e o HTTPS

O registro A de `guiadati.com` já aponta para `143.95.174.27`, com proxy Cloudflare ativado, conforme informado pelo responsável.
Preserve os registros DNS. A resposta pública pode mostrar os IPs do Cloudflare, em vez do IP da VPS.
Configure o HTTPS no proxy que já atende o servidor.
O container publica apenas `127.0.0.1:5082`. Ele não ocupa as portas `80` e `443` nem gerencia certificados.

No bloco HTTPS do domínio no Nginx, o encaminhamento pode usar:

```nginx
location / {
    proxy_pass http://127.0.0.1:5082;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Se o proxy também estiver em Docker, `127.0.0.1` dentro dele aponta para o próprio container.
Nesse caso, configure uma rede compartilhada e o endereço do Guia antes de ativar o domínio. O exemplo acima pressupõe proxy no host.

Se a inspeção confirmar que não há proxy existente, use o modelo em `deploy/proxy` como um projeto Compose separado.
Ele usa a rede do host Linux e atende as portas TCP `80` e `443`. A aplicação continua restrita à porta local `5082`.
Confirme que as portas estão livres antes de iniciar o proxy. Não pare outro serviço para liberar essas portas.
Caddy solicita e renova o certificado da origem. Os volumes `caddy_data` e `caddy_config` preservam sua configuração e os certificados.
Confira se a emissão pode validar o domínio por HTTP. Se as regras do Cloudflare impedirem a validação, resolva esse ponto antes de publicar.
Não apague os volumes do proxy durante atualizações.

Valide o certificado diretamente na origem com `curl --resolve guiadati.com:443:143.95.174.27 https://guiadati.com/health`.
Esse teste precisa passar sem desativar a verificação TLS. Depois, teste o endereço público pelo Cloudflare.
O modo Cloudflare **Completo (estrito)** verifica a validade do certificado da origem. Sua ativação exige aprovação do responsável.

O backend precisa confiar no IP de origem do proxy. Configure `FORWARDED_PROXY_IP` em `runtime.env` com o IP visto pelo container.
Para um proxy no host usando a porta local, costuma ser o gateway da rede Docker. Confira esse valor após a primeira publicação:

```bash
container=$(docker ps --filter label=com.docker.compose.project=guia-da-ti --filter label=com.docker.compose.service=app -q)
docker inspect --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}' "$container"
```

Depois de ajustar `runtime.env`, execute o workflow novamente.
Na OAuth App do GitHub, cadastre **Homepage URL** como `https://guiadati.com` e **Authorization callback URL** como `https://guiadati.com/api/auth/callback`.
Use o mesmo domínio em `SITE_URL` e no navegador. Preserve o Client ID e o Client Secret ao atualizar esses endereços.
Confira se o proxy encaminha o protocolo HTTPS e se o login retorna ao Guia.

## Ativar e conferir

1. Prepare os diretórios, configurações, chave SSH e proxy.
2. Mantenha `VPS_DEPLOY_ENABLED=false` no repositório.
3. Em **Actions**, execute **Validar e preparar site** na `main`. Marque **Publicar manualmente na VPS**.
4. Confira os jobs `build`, `package` e `deploy`. Todos precisam passar.
5. Confira o certificado na origem, o domínio público, o catálogo, o fórum e o login.
6. Confira a persistência após recriar o container e o retorno a uma versão anterior.
7. Defina `VPS_DEPLOY_ENABLED=true` após a validação. Teste uma atualização pelo pipeline.

Cada push na `main` passa pelas verificações, gera uma imagem e publica na VPS quando a automação está ativada.
As atualizações não exigem comandos manuais no servidor. Execuções manuais e agendadas usam o mesmo processo.

O job usa `up --wait` e só registra a versão atual depois dos healthchecks interno e público.
A consulta pública verifica DNS, HTTPS e acesso ao backend. Ela não comprova o login nem todas as integrações externas.
O deploy mantém os arquivos de identificação da aplicação e do catálogo dentro da imagem.

## Instalação em produção

A primeira publicação foi validada em 14/10/2026 pelo [workflow manual](https://github.com/guia-da-ti/guia-da-ti/actions/runs/38587175950).
O servidor usa AlmaLinux 9.8, Docker 29.9.0 e Compose 5.6.0. A inspeção encontrou as portas `80` e `443` livres e nenhum container existente.

- A conta `guia-deploy` usa uma chave SSH dedicada. A identidade do servidor foi conferida pelo console da HostGator.
- O projeto `guia-da-ti` executa a aplicação. O backend atende apenas em `127.0.0.1:5082`.
- O projeto `guia-da-ti-proxy` executa Caddy nas portas TCP `80` e `443`, com certificado da Let's Encrypt e renovação automática.
- Os dados ficam em `/opt/guia-da-ti/data`. Os certificados usam os volumes do proxy.
- `runtime.env` e `deploy.env` têm permissão `600`. A aplicação confia no gateway `172.18.0.1` da sua rede Docker.

Os testes confirmaram a página inicial, o catálogo e a leitura do fórum pelo domínio público.
O login redireciona para o GitHub com callback em `https://guiadati.com/api/auth/callback`. A autorização de um visitante exige interação no GitHub.
Nenhum registro DNS foi alterado. O modo SSL do Cloudflare foi preservado.

## Voltar manualmente a uma versão

As imagens antigas e os arquivos das versões permanecem na VPS. Use um identificador existente em `/opt/guia-da-ti/releases`.
Troque `IDENTIFICADOR` no exemplo. Execute como a conta de deploy.

```bash
root=/opt/guia-da-ti
release=IDENTIFICADOR
export GUIA_IMAGE="guia-da-ti:$release"
docker compose --project-name guia-da-ti --project-directory "$root" \
  --env-file "$root/deploy.env" -f "$root/releases/$release/compose.yml" \
  up --detach --wait --wait-timeout 150
# Registre a versão somente depois de o comando acima concluir com sucesso.
printf '%s\n' "$release" > "$root/current-release"
```

Não remova uma imagem que ainda pode ser necessária para retornar à versão anterior.
Monitore o espaço ocupado pelas imagens. O workflow limita os logs, mas não apaga automaticamente versões antigas.
O backup de `data`, `runtime.env` e `deploy.env` deve ficar fora da VPS.
Esse backup contém sessões, chaves de criptografia e IDs do GitHub. Guarde-o criptografado. Veja [Segurança dos dados](seguranca-dados.md).

## Revisão de texto

Os trechos novos foram revisados com humanizer-br. Foram usadas frases curtas, voz ativa e instruções com ações concretas.

## Referências

- [Ambientes de deploy no GitHub](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments).
- [Secrets no GitHub Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).
- [Docker Compose up](https://docs.docker.com/reference/cli/docker/compose/up/).
- [HTTPS automático no Caddy](https://caddyserver.com/docs/automatic-https).
- [Modo Completo estrito no Cloudflare](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).
