# Praça da comunidade

## Ideia

Criar uma praça virtual para as pessoas se encontrarem dentro do Guia. A praça funciona como uma forma visual de explorar o site: cada prédio leva a uma categoria existente, e o fórum ocupa o centro desse espaço.

A pessoa entra com a conta do GitHub, escolhe um personagem e pode ver quem mais está na praça. Ações rápidas, como acenar, permitem interação sem criar outro chat para moderar.

## Como funciona

- **Praça:** mapa pequeno, visto de cima, com personagens que outras pessoas conseguem ver.
- **Prédios:** cada prédio abre uma categoria ou seção já existente no Guia. O mapa não duplica o catálogo.
- **Fórum:** ponto central da praça. Pode destacar conversas recentes e abrir o fórum atual.
- **Personagem:** avatar personalizável com roupas, cores e acessórios.
- **Loja:** itens cosméticos comprados com uma moeda virtual ganha por contribuições aceitas no Guia.

## Ciclo de participação

1. A pessoa entra no Guia e aparece na praça.
2. Explora os prédios ou encontra outras pessoas.
3. Participa do fórum ou envia uma contribuição para o Guia.
4. Quando uma contribuição elegível é aceita, recebe fichas.
5. Usa as fichas para desbloquear itens cosméticos.

O nome da moeda fica em aberto. **Fichas**, **bits** e **sementes** são opções iniciais.

## Regras para as fichas

- Recompensar contribuições úteis e aceitas, como uma indicação aprovada para o catálogo.
- Definir quais ações do fórum contam antes de conceder fichas por participação.
- Não dar fichas por tempo online, visitas repetidas, quantidade bruta de mensagens ou commits sem revisão.
- Registrar cada recompensa uma única vez e permitir conferir por que ela foi concedida.
- Manter os itens cosméticos sem efeito sobre permissões, visibilidade ou aprovação de conteúdo.

Essas regras evitam que a moeda incentive spam ou transforme o catálogo e o fórum numa disputa por volume.

## Primeiro escopo

1. Desenhar uma praça pequena com o fórum e prédios para as categorias atuais.
2. Permitir que a pessoa se mova e veja outros personagens em tempo real.
3. Incluir ações simples, como acenar, sem mensagens livres na praça.
4. Permitir escolher e salvar um personagem e seus itens cosméticos.
5. Definir quais contribuições aceitas geram fichas e como impedir recompensas duplicadas.

Deixar minijogos e mapas maiores para uma etapa posterior, depois de observar se as pessoas usam a praça.

## Pontos para decidir antes de implementar

- Quais categorias terão prédio na primeira versão e como agrupar as que compartilham uma área.
- Se o fórum mostra conversas recentes na praça ou apenas abre a rota atual.
- Quais contribuições dão fichas, qual o valor e quem confirma a aceitação.
- Como guardar personagem, inventário e saldo vinculados à conta do GitHub.
- Como sincronizar presença e movimento entre pessoas sem expor dados desnecessários.
- Quais ferramentas de acessibilidade e controles alternativos serão necessários além do movimento por teclado.

## Base existente no Guia

O Guia já tem login pelo GitHub, fórum baseado em GitHub Discussions, contribuições para o catálogo, categorias com rotas próprias e um indicador de visitantes ativos. O indicador atual conta navegadores recentes em memória. Ele não mantém personagens, movimento compartilhado ou inventário. A praça exigirá uma camada nova de presença em tempo real e armazenamento persistente para os dados do personagem e da moeda.

## Critério de sucesso inicial

Observar se as pessoas entram na praça, exploram os prédios, interagem com outras pessoas e voltam. A primeira versão deve provar esse uso antes de crescer o mapa ou adicionar minijogos.
