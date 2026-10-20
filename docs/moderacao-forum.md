# Moderação do fórum

O fórum usa GitHub Discussions no repositório público `guia-da-ti/guia-da-ti-dados`. Use os controles do GitHub para moderar conversas. O Guia não remove nem bloqueia publicações por conta própria.

## Durante uma onda de spam

1. Oculte comentários fora de contexto. Apague tópicos que sejam claramente spam.
2. Tranque as conversas que continuarem recebendo publicações. Pessoas com acesso de escrita ainda podem comentar em uma conversa trancada.
3. Se uma conta insistir, bloqueie a pessoa na organização e escolha se o GitHub deve ocultar os comentários dela. O bloqueio pode afetar outros repositórios da organização.
4. Se várias contas novas estiverem publicando, considere ativar um limite temporário de interação no repositório por 24 horas.
5. Quando a onda passar, remova o limite temporário e destranque as conversas que devem voltar a receber comentários.

Para moderar um comentário ou tópico, abra o menu `…` ao lado da publicação no GitHub. As opções disponíveis dependem da sua permissão. Pessoas com acesso `Triage` podem moderar Discussions. O bloqueio de uma pessoa na organização exige permissão de organização.

## Limites temporários do GitHub

Em `guia-da-ti/guia-da-ti-dados`, abra **Settings > Moderation options > Interaction limits**. Escolha uma opção e um prazo. O GitHub oferece limites por 24 horas, 3 dias, 1 semana, 1 mês ou 6 meses.

- **Contas existentes:** restringe contas com menos de 24 horas, sem contribuições anteriores e sem acesso de colaborador. É a primeira opção a considerar durante uma onda de contas recém-criadas.
- **Contribuidores anteriores:** restringe quem ainda não contribuiu para a branch padrão e não é colaborador. Use apenas se o primeiro limite não bastar. Ele pode impedir a participação de pessoas legítimas.
- **Colaboradores:** restringe quem não tem acesso de escrita. Não use durante a participação aberta da comunidade.

Esses limites se aplicam às interações no repositório, não só ao fórum. A documentação do GitHub cita comentários, abertura de issues e criação de pull requests. Ela não confirma se o limite impede a criação de novos tópicos em Discussions. Portanto, não dependa dele para bloquear novos tópicos.

As categorias **Ajuda** e **Ideias** devem continuar abertas à comunidade. A categoria **Announcement** só permite que mantenedores criem tópicos, então não a use como substituta dessas categorias.

## Referências

- [Moderar Discussions](https://docs.github.com/en/discussions/managing-discussions-for-your-community/moderating-discussions)
- [Moderar comentários e conversas](https://docs.github.com/en/communities/moderating-comments-and-conversations)
- [Limitar interações no repositório](https://docs.github.com/en/communities/moderating-comments-and-conversations/limiting-interactions-in-your-repository)
- [Bloquear uma pessoa na organização](https://docs.github.com/en/communities/maintaining-your-safety-on-github/blocking-a-user-from-your-organization)
- [Categorias de Discussions](https://docs.github.com/en/discussions/managing-discussions-for-your-community/managing-categories-for-discussions)
