export type GuideStepId = 'explore' | 'communities' | 'creators' | 'study' | 'inform' | 'networking' | 'practice' | 'career' | 'forum' | 'contribute' | 'about' | 'transparency' | 'advertising' | 'github-account' | 'github-login' | 'github-participate' | 'tutorials' | 'platforms' | 'universities' | 'bootcamps' | 'roadmaps' | 'books' | 'certifications' | 'news' | 'blogs' | 'newsletters' | 'podcasts' | 'articles' | 'studies' | 'case-studies' | 'reports' | 'events' | 'meetups' | 'conferences' | 'hackathons' | 'tools' | 'open-source' | 'challenges' | 'labs' | 'jobs' | 'scholarships' | 'mentoring' | 'volunteering';
export type GuideStep = {
  id: GuideStepId; label: string; category: string; description: string; tip: string; action: string; href: string;
  reason?: string; selection?: string;
  usage?: string;
  phase?: 'what' | 'why' | 'choose' | 'use';
};

export const guideSteps = [
  {
    id: 'explore', label: 'Encontre o que procura', category: 'Explore',
    description: 'Use os menus para estudar, se informar, fazer networking, praticar ou procurar oportunidades. Nas listagens, pesquise pelo nome ou assunto.',
    tip: 'Combine a pesquisa com os filtros para reduzir a lista.',
    action: 'Ver categorias', href: '/sobre#por-onde-comecar',
  },
  {
    id: 'communities', label: 'Encontre sua comunidade', category: 'Comunidades',
    reason: 'Uma comunidade é um espaço para tirar dúvidas e trocar experiências com pessoas de interesses parecidos. Você pode participar mesmo no começo dos estudos.',
    selection: 'Comece pelo assunto que interessa a você. Veja o público, a localização e a plataforma do grupo. Leia as regras e observe as conversas antes de participar.',
    description: 'Escolha a plataforma e filtre por localização ou público. Clique em uma comunidade para ver os detalhes e os links dos seus grupos.',
    tip: 'No mapa, você pode selecionar vários estados, todo o Brasil ou comunidades internacionais.',
    action: 'Ver comunidades', href: '/comunidades',
  },
  {
    id: 'creators', label: 'Descubra quem acompanhar', category: 'Criadores',
    reason: 'Criadores compartilham tutoriais e experiências que podem ajudar nos seus estudos e na carreira. Acompanhar perspectivas diferentes ajuda a comparar caminhos.',
    selection: 'Escolha o tipo de conteúdo que procura e a rede que você usa. Abra o perfil e veja se a linguagem combina com seu momento.',
    description: 'Troque de rede nas abas e filtre pelo tipo de conteúdo. Use a pesquisa para encontrar um perfil e abra o link na rede do criador.',
    tip: 'Carreira, humor e tutoriais são algumas das categorias disponíveis.',
    action: 'Ver criadores', href: '/criadores',
  },
  {
    id: 'study', label: 'Escolha seu próximo estudo', category: 'Estudar',
    reason: 'Comparar fontes de estudo ajuda a decidir onde investir seu tempo. O Guia reúne links e avaliações para apoiar essa escolha.',
    selection: 'Defina o que você quer aprender e seu nível atual. Compare a grade, o idioma e as condições de acesso na fonte. Leia as experiências de outras pessoas.',
    description: 'Encontre tutoriais, plataformas de cursos, faculdades, bootcamps, roadmaps, livros e certificações. Nas categorias com cards, alterne para lista ou mude a ordenação.',
    tip: 'Abra um item para ler avaliações e comentários. Em Abrir site, você acessa o conteúdo na página de origem.',
    action: 'Ver plataformas de cursos', href: '/plataformas',
  },
  {
    id: 'inform', label: 'Acompanhe o que acontece em tecnologia', category: 'Se informar',
    reason: 'Acompanhar notícias e análises ajuda a entender mudanças na tecnologia. Consultar mais de uma fonte ajuda a colocar uma novidade em contexto.',
    selection: 'Escolha os assuntos que afetam seus estudos ou trabalho. Compare as fontes, confira a data e prefira textos que mostram de onde veio a informação.',
    description: 'Escolha notícias, blogs, newsletters ou podcasts no menu Se informar. Pesquise um assunto e abra o link para ler ou ouvir na fonte.',
    tip: 'Você também encontra artigos, pesquisas, estudos de caso e relatórios.',
    action: 'Ver portais de notícias', href: '/noticias',
  },
  {
    id: 'networking', label: 'Conheça pessoas da área', category: 'Networking',
    reason: 'Encontros aproximam você de pessoas que trabalham ou estudam na mesma área. Uma conversa pode trazer referências, parcerias ou um novo ponto de vista.',
    selection: 'Veja o tema, o público e o formato do encontro. Confira o local, o custo e a programação. Escolha um assunto que interessa a você.',
    description: 'Explore eventos, meetups, conferências e hackathons. Abra os detalhes e consulte a página do evento para confirmar a programação e a inscrição.',
    tip: 'Para conversar com um grupo no dia a dia, veja também a seção Comunidades.',
    action: 'Ver eventos', href: '/eventos',
  },
  {
    id: 'practice', label: 'Coloque seu conhecimento em prática', category: 'Praticar',
    reason: 'Praticar mostra o que você já consegue fazer e o que ainda precisa estudar. Projetos e desafios ajudam a transformar uma ideia em algo que funciona.',
    selection: 'Escolha um desafio que use o que você está aprendendo. Leia os requisitos e comece por uma tarefa pequena. Nos projetos, confira as orientações para contribuir.',
    description: 'Encontre ferramentas, projetos de código aberto, desafios e laboratórios. Escolha um recurso e acesse o site de origem para começar.',
    tip: 'Confira os requisitos do recurso antes de instalar algo ou iniciar um desafio.',
    action: 'Ver ferramentas', href: '/ferramentas',
  },
  {
    id: 'career', label: 'Procure seu próximo passo na carreira', category: 'Carreira',
    reason: 'Conhecer vagas e caminhos de formação ajuda a planejar seu próximo passo. Os requisitos também mostram quais conhecimentos você pode desenvolver.',
    selection: 'Compare as oportunidades com seu momento e seus objetivos. Confira os requisitos, o local de trabalho e os prazos. Leia as condições antes de se candidatar.',
    description: 'Use o menu Carreira para encontrar sites de vagas, bolsas de estudo e programas de mentoria ou voluntariado. Consulte oportunidades e requisitos na fonte.',
    tip: 'Confirme os prazos e as condições na página de origem.',
    action: 'Ver sites de vagas', href: '/vagas',
  },
  {
    id: 'forum', label: 'Troque ideias no fórum', category: 'Fórum',
    reason: 'Você pode aprender com experiências de outras pessoas e compartilhar o que descobriu. Uma dúvida bem explicada também pode ajudar quem chega depois.',
    selection: 'Pesquise antes de abrir um tópico. Ao perguntar, explique seu objetivo, o que tentou e onde ficou a dúvida. Ao responder, mantenha o foco na conversa.',
    description: 'No Início, pesquise conversas e leia os comentários. Entre com GitHub para abrir um tópico, responder ou avaliar um recurso de estudo.',
    tip: 'Se você ainda não tem uma conta no GitHub, a opção de entrar explica como criar uma.',
    action: 'Abrir fórum', href: '/',
  },
  {
    id: 'contribute', label: 'Indique algo que vale conhecer', category: 'Contribua',
    description: 'Use o botão de sugestão da seção. Preencha as etapas, adicione uma imagem e confira a prévia antes de enviar.',
    tip: 'Todas as sugestões abrem um PR para revisão dos mantenedores. O fórum continua separado para conversas.',
    action: 'Enviar uma sugestão', href: '/?sugerir=',
  },
] as const satisfies readonly GuideStep[];

export const githubGuideSteps: readonly GuideStep[] = [
  {
    id: 'github-account', label: 'Crie sua conta no GitHub', category: 'Sua conta',
    description: 'O GitHub identifica você nas conversas e contribuições do Guia. A conta é gratuita. Você não precisa saber programar para participar.',
    tip: 'Abra o cadastro, informe seu e-mail e escolha uma senha. Siga as instruções do GitHub para confirmar a conta.',
    action: 'Criar conta no GitHub', href: 'https://github.com/signup',
  },
  {
    id: 'github-login', label: 'Volte ao Guia e entre', category: 'Seu login',
    description: 'Depois de confirmar sua conta, volte ao Guia e clique em Entrar com GitHub. Na janela do GitHub, revise a autorização antes de continuar.',
    tip: 'Seu nome e suas publicações ficam públicos. Você pode consultar suas autorizações nas configurações da conta do GitHub.',
    action: 'Ver configurações do GitHub', href: 'https://github.com/settings/applications',
  },
  {
    id: 'github-participate', label: 'Participe com sua conta', category: 'Sua participação',
    description: 'Com o login concluído, você pode abrir tópicos e responder no fórum. Também pode avaliar recursos de estudo e enviar sugestões para revisão.',
    tip: 'Explorar as listagens e ler as conversas não exige uma conta. Entre quando quiser publicar algo.',
    action: 'Explorar o fórum', href: '/',
  },
];

export const aboutGuideSteps: readonly GuideStep[] = [
  {
    id: 'about', label: 'Um guia de links feito pela comunidade', category: 'O projeto',
    description: 'O Guia reúne indicações de sites, conteúdos e oportunidades de tecnologia. Você explora por categoria e acessa o conteúdo na página de origem.',
    tip: 'Cursos e atividades ficam nos sites indicados. Aqui, você encontra os links e pode trocar experiências no fórum.',
    action: 'Ver categorias', href: '/sobre#por-onde-comecar',
  },
  guideSteps.find(step => step.id === 'forum')!,
  {
    ...guideSteps.find(step => step.id === 'contribute')!,
    label: 'A comunidade indica, os mantenedores revisam',
    description: 'Qualquer pessoa pode sugerir um recurso ou uma correção. Os mantenedores revisam os cadastros antes de incluí-los no catálogo.',
    tip: 'Confira a data de atualização de cada item. Se encontrar algo desatualizado, você pode propor uma correção pelo link Editar informação.',
  },
  {
    id: 'transparency', label: 'Você pode acompanhar o projeto', category: 'Aberto e colaborativo',
    description: 'O catálogo e seu histórico ficam públicos no GitHub. Em Sobre, você encontra os mantenedores e as empresas que apoiam o Guia.',
    tip: 'Itens marcados como Exemplo fictício servem para demonstrar a navegação. Eles não são indicações de recursos reais.',
    action: 'Ver mantenedores', href: '/sobre#mantenedores',
  },
];

type CategoryGuide = { id: GuideStepId; label: string; category: string; description: string; reason: string; selection: string; usage: string; tip: string; action: string; href: string };

const categoryGuides: readonly CategoryGuide[] = [
  { id: 'tutorials', label: 'Aprenda com tutoriais', category: 'Tutoriais', description: 'Tutoriais mostram como fazer uma tarefa ou entender um conceito. Acompanhe as instruções e teste cada etapa.', reason: 'Um exemplo guiado ajuda você a aplicar um conceito enquanto estuda.', selection: 'Escolha um tutorial ligado ao que você quer fazer. Confira a versão da tecnologia e os pré-requisitos.', usage: 'Abra o tutorial na fonte e acompanhe cada etapa. Teste o exemplo no seu ambiente.', tip: 'Se algo não funcionar, confira a versão usada no tutorial.', action: 'Ver tutoriais', href: '/tutoriais' },
  { id: 'platforms', label: 'Escolha uma plataforma de cursos', category: 'Plataformas de cursos', description: 'Plataformas reúnem cursos de diferentes assuntos, autores ou instituições.', reason: 'Conhecer o catálogo e o formato da plataforma ajuda você a planejar os estudos.', selection: 'Compare os assuntos, os idiomas, os formatos das aulas e os preços. Veja se há conteúdo gratuito para testar.', usage: 'Acesse a plataforma e pesquise pelo assunto que deseja estudar. Consulte os detalhes do curso escolhido.', tip: 'Confira as condições de acesso antes de se inscrever.', action: 'Ver plataformas', href: '/plataformas' },
  { id: 'universities', label: 'Pesquise faculdades', category: 'Faculdades', description: 'Faculdades oferecem cursos de graduação e outras formações na área de tecnologia.', reason: 'Comparar instituições ajuda você a entender os caminhos de formação disponíveis.', selection: 'Confira o curso, a modalidade, a localização e o processo seletivo. Consulte a grade e o reconhecimento da instituição.', usage: 'Abra a página da faculdade para verificar informações atualizadas sobre o curso e as inscrições.', tip: 'Confirme datas e requisitos diretamente com a instituição.', action: 'Ver faculdades', href: '/faculdades' },
  { id: 'bootcamps', label: 'Avalie um bootcamp', category: 'Bootcamps', description: 'Bootcamps são programas intensivos de formação, voltados a uma área ou habilidade prática.', reason: 'O formato concentrado pode ajudar você a estudar um tema com um objetivo definido.', selection: 'Compare a duração, o conteúdo, o nível esperado e o suporte oferecido. Verifique o preço e a rotina de aulas.', usage: 'Consulte o programa completo na página do bootcamp e veja se a carga cabe na sua agenda.', tip: 'Leia com atenção as regras de pagamento e cancelamento.', action: 'Ver bootcamps', href: '/bootcamps' },
  { id: 'roadmaps', label: 'Siga um roadmap', category: 'Roadmaps', description: 'Roadmaps mostram etapas e assuntos que podem orientar o estudo de uma área.', reason: 'Uma sequência de tópicos ajuda você a enxergar o que estudar agora e o que pode vir depois.', selection: 'Escolha um roadmap para seu objetivo e nível. Use-o como referência, sem tentar aprender tudo de uma vez.', usage: 'Siga um tópico por vez e abra as referências indicadas para estudar cada assunto.', tip: 'Adapte a sequência ao que você já sabe e ao tempo disponível.', action: 'Ver roadmaps', href: '/roadmaps' },
  { id: 'books', label: 'Encontre livros para estudar', category: 'Livros', description: 'Livros apresentam conceitos e exemplos em um formato que você pode consultar no seu ritmo.', reason: 'Um livro pode servir como referência contínua durante um curso ou projeto.', selection: 'Leia a descrição e confira a edição, o idioma e os assuntos abordados. Veja se o nível combina com sua experiência.', usage: 'Acesse a página indicada para consultar o livro e escolher onde obtê-lo.', tip: 'Confira a edição mais recente quando o assunto muda com frequência.', action: 'Ver livros', href: '/livros' },
  { id: 'certifications', label: 'Prepare-se para certificações', category: 'Certificações', description: 'Certificações avaliam conhecimentos definidos por uma instituição ou empresa.', reason: 'Uma certificação pode ajudar a comprovar conhecimentos exigidos em algumas vagas.', selection: 'Confira o conteúdo da prova, os pré-requisitos, o idioma, o preço e a validade da certificação.', usage: 'Consulte o site oficial para ver o programa de estudos e as regras de inscrição.', tip: 'Use o guia oficial da prova para organizar a preparação.', action: 'Ver certificações', href: '/certificacoes' },
  { id: 'news', label: 'Acompanhe portais de notícias', category: 'Portais de notícias', description: 'Portais publicam notícias e atualizações sobre empresas, produtos e acontecimentos de tecnologia.', reason: 'Acompanhar fontes recorrentes ajuda você a perceber mudanças e novidades na área.', selection: 'Compare a cobertura, a data das matérias e as fontes citadas. Separe notícia de opinião.', usage: 'Abra o portal e consulte as matérias recentes sobre os assuntos que interessam a você.', tip: 'Leia mais de uma fonte quando a notícia tiver impacto importante.', action: 'Ver portais de notícias', href: '/noticias' },
  { id: 'blogs', label: 'Leia blogs de tecnologia', category: 'Blogs', description: 'Blogs trazem artigos, relatos e explicações publicados por pessoas ou equipes.', reason: 'Textos de quem trabalha ou estuda na área podem mostrar práticas e pontos de vista diferentes.', selection: 'Veja quem escreve, quando o texto foi publicado e se ele cita fontes ou exemplos.', usage: 'Pesquise um tema no blog e abra os textos que respondem à sua dúvida.', tip: 'Confira a data antes de seguir instruções técnicas.', action: 'Ver blogs', href: '/blogs' },
  { id: 'newsletters', label: 'Escolha newsletters', category: 'Newsletters', description: 'Newsletters enviam seleções de links ou textos por e-mail.', reason: 'Receba novidades sobre um tema sem precisar procurar cada fonte separadamente.', selection: 'Confira a frequência, o assunto e alguns exemplos de edições antes de assinar.', usage: 'Acesse a página da newsletter para assinar ou consultar edições anteriores.', tip: 'Escolha uma frequência que você consiga acompanhar.', action: 'Ver newsletters', href: '/newsletters' },
  { id: 'podcasts', label: 'Encontre podcasts', category: 'Podcasts', description: 'Podcasts são programas em áudio divididos em episódios sobre temas específicos.', reason: 'Conversas e entrevistas podem apresentar experiências e assuntos para você explorar depois.', selection: 'Confira os temas, a duração dos episódios e a frequência de publicação.', usage: 'Abra o podcast na plataforma indicada e escolha um episódio ligado ao que você procura.', tip: 'Veja a descrição do episódio para encontrar o assunto certo.', action: 'Ver podcasts', href: '/podcasts' },
  { id: 'articles', label: 'Consulte artigos', category: 'Artigos', description: 'Artigos explicam ideias, técnicas ou experiências em textos publicados por diferentes fontes.', reason: 'Uma leitura focada pode ajudar você a entender um conceito ou comparar abordagens.', selection: 'Confira o tema, a autoria, a data e as referências do artigo.', usage: 'Abra o artigo para ler na fonte e consulte os links citados quando quiser se aprofundar.', tip: 'Observe se o artigo descreve uma opinião ou apresenta resultados.', action: 'Ver artigos', href: '/artigos' },
  { id: 'studies', label: 'Explore pesquisas e estudos', category: 'Pesquisas e estudos', description: 'Pesquisas e estudos apresentam dados, métodos ou análises sobre tecnologia.', reason: 'Consultar os resultados e o método ajuda você a avaliar o que os dados mostram.', selection: 'Veja quem conduziu o estudo, quando foi publicado, qual método usou e quais são seus limites.', usage: 'Abra a publicação original e procure o resumo, a metodologia e as conclusões.', tip: 'Não generalize resultados além do público e do contexto pesquisados.', action: 'Ver pesquisas e estudos', href: '/estudos' },
  { id: 'case-studies', label: 'Leia estudos de caso', category: 'Estudos de caso', description: 'Estudos de caso descrevem uma situação real e as decisões tomadas para lidar com ela.', reason: 'Analisar um caso ajuda você a entender como escolhas técnicas se relacionam com contexto e objetivos.', selection: 'Confira o cenário, o problema, as decisões e os resultados relatados.', usage: 'Leia o caso na fonte e observe quais condições podem ser diferentes da sua situação.', tip: 'Use o caso como referência, não como receita universal.', action: 'Ver estudos de caso', href: '/estudos-de-caso' },
  { id: 'reports', label: 'Consulte relatórios', category: 'Relatórios', description: 'Relatórios reúnem análises ou dados sobre um setor, tecnologia ou período.', reason: 'Os dados podem ajudar você a entender tendências e comparar cenários.', selection: 'Confira a instituição responsável, o período analisado, as fontes e a metodologia.', usage: 'Abra o relatório original e consulte os gráficos junto das notas e definições.', tip: 'Verifique o ano dos dados antes de usá-los como referência.', action: 'Ver relatórios', href: '/relatorios' },
  { id: 'events', label: 'Encontre eventos', category: 'Eventos', description: 'Eventos reúnem pessoas em atividades presenciais ou online sobre tecnologia.', reason: 'Participar pode aproximar você de temas e pessoas que compartilham seus interesses.', selection: 'Confira tema, formato, data, local e custo. Veja se é preciso se inscrever.', usage: 'Abra a página do evento para consultar a programação e confirmar a inscrição.', tip: 'Confirme data e endereço com a organização antes de sair.', action: 'Ver eventos', href: '/eventos' },
  { id: 'meetups', label: 'Participe de meetups', category: 'Meetups', description: 'Meetups são encontros de grupos interessados em conversar sobre um tema ou área.', reason: 'Encontros menores podem facilitar conversas e troca de experiências.', selection: 'Veja o tema, a comunidade organizadora, o formato e o local do encontro.', usage: 'Consulte a página do meetup para ver a próxima data e as instruções para participar.', tip: 'Confira se o encontro exige inscrição prévia.', action: 'Ver meetups', href: '/meetups' },
  { id: 'conferences', label: 'Compare conferências', category: 'Conferências', description: 'Conferências reúnem palestras, oficinas e participantes em torno de áreas de tecnologia.', reason: 'A programação ajuda você a escolher assuntos e palestrantes para acompanhar.', selection: 'Compare a programação, o formato, as datas e os custos de participação.', usage: 'Acesse o site da conferência para conferir horários, local e inscrição.', tip: 'Veja se as palestras ficam disponíveis depois do evento.', action: 'Ver conferências', href: '/conferencias' },
  { id: 'hackathons', label: 'Participe de hackathons', category: 'Hackathons', description: 'Hackathons são atividades com prazo definido para criar soluções em equipe ou individualmente.', reason: 'O formato permite praticar e construir algo a partir de um desafio concreto.', selection: 'Confira o tema, as regras, a duração, os critérios de avaliação e quem pode participar.', usage: 'Leia o regulamento na página do organizador e confirme como formar equipe ou enviar o projeto.', tip: 'Verifique as regras de uso de ferramentas e propriedade do projeto.', action: 'Ver hackathons', href: '/hackathons' },
  { id: 'tools', label: 'Escolha ferramentas', category: 'Ferramentas', description: 'Ferramentas ajudam você a criar, testar ou organizar tarefas de tecnologia.', reason: 'Conhecer opções disponíveis ajuda a encontrar uma ferramenta adequada ao seu trabalho.', selection: 'Confira o que a ferramenta faz, os sistemas compatíveis, o preço e a licença.', usage: 'Acesse o site oficial para consultar a documentação e começar a usar a ferramenta.', tip: 'Baixe programas apenas de fontes oficiais.', action: 'Ver ferramentas', href: '/ferramentas' },
  { id: 'open-source', label: 'Explore projetos open source', category: 'Open source', description: 'Projetos open source publicam código e permitem que outras pessoas estudem ou contribuam.', reason: 'Ler um projeto real pode ajudar você a conhecer práticas usadas por outras equipes.', selection: 'Veja a atividade do projeto, as instruções para contribuir e as regras de licença.', usage: 'Leia o arquivo de apresentação e as orientações do projeto antes de abrir uma contribuição.', tip: 'Comece por tarefas marcadas como adequadas para iniciantes.', action: 'Ver projetos open source', href: '/open-source' },
  { id: 'challenges', label: 'Pratique com desafios', category: 'Desafios', description: 'Desafios propõem problemas para você resolver e praticar conceitos.', reason: 'Resolver um problema ajuda você a testar o que entendeu e identificar dúvidas.', selection: 'Escolha um desafio compatível com seu nível e confira as regras e os assuntos envolvidos.', usage: 'Leia o enunciado, tente resolver por conta própria e consulte as dicas depois da tentativa.', tip: 'Explique sua solução para consolidar o raciocínio.', action: 'Ver desafios', href: '/desafios' },
  { id: 'labs', label: 'Faça laboratórios práticos', category: 'Laboratórios', description: 'Laboratórios oferecem atividades guiadas em ambientes de prática ou simulação.', reason: 'Um ambiente controlado permite experimentar sem configurar tudo do zero.', selection: 'Confira os pré-requisitos, o tempo estimado e se o laboratório é gratuito.', usage: 'Siga as instruções do laboratório e guarde os resultados ou anotações importantes.', tip: 'Confira se o acesso ao ambiente tem prazo ou limite de uso.', action: 'Ver laboratórios', href: '/laboratorios' },
  { id: 'jobs', label: 'Pesquise sites de vagas', category: 'Sites de vagas', description: 'Sites de vagas publicam oportunidades de trabalho em tecnologia.', reason: 'Comparar anúncios ajuda você a conhecer funções e requisitos pedidos pelas empresas.', selection: 'Confira as atividades, os requisitos, o local de trabalho e a data da publicação.', usage: 'Abra a vaga na fonte para verificar se continua ativa e seguir as instruções de candidatura.', tip: 'Adapte seu currículo aos requisitos que correspondem à sua experiência.', action: 'Ver sites de vagas', href: '/vagas' },
  { id: 'scholarships', label: 'Procure bolsas de estudo', category: 'Bolsas de estudo', description: 'Bolsas ajudam a custear cursos ou programas de formação, conforme as regras de cada oferta.', reason: 'Uma bolsa pode tornar uma oportunidade de estudo mais acessível.', selection: 'Confira quem pode se candidatar, o que a bolsa cobre, os documentos e os prazos.', usage: 'Acesse a página do programa e siga as instruções oficiais de candidatura.', tip: 'Organize os documentos antes do prazo final.', action: 'Ver bolsas de estudo', href: '/bolsas' },
  { id: 'mentoring', label: 'Conheça programas de mentoria', category: 'Programas de mentoria', description: 'Programas de mentoria aproximam você de alguém que orienta seus estudos ou sua carreira.', reason: 'Conversas com alguém experiente podem ajudar você a organizar objetivos e próximos passos.', selection: 'Veja o público atendido, a duração, o formato e o compromisso esperado.', usage: 'Consulte os critérios e o processo de inscrição na página do programa.', tip: 'Defina o que você quer aprender antes de se candidatar.', action: 'Ver programas de mentoria', href: '/mentorias' },
  { id: 'volunteering', label: 'Encontre oportunidades de voluntariado', category: 'Programas de voluntariado', description: 'No voluntariado, você colabora com iniciativas que precisam de apoio.', reason: 'Contribuir com uma iniciativa pode ajudar você a praticar e apoiar outras pessoas.', selection: 'Confira a missão, as tarefas, o tempo esperado e as habilidades necessárias.', usage: 'Abra a página do programa para ver como se candidatar e combinar sua disponibilidade.', tip: 'Escolha uma carga de trabalho que você consiga manter.', action: 'Ver programas de voluntariado', href: '/voluntariado' },
];

const categoryGuideById = Object.fromEntries(categoryGuides.map(guide => [guide.id, guide])) as Partial<Record<GuideStepId, CategoryGuide>>;

const advertisingGuideStep: GuideStep = {
  id: 'advertising', label: 'Conheça os espaços de divulgação', category: 'Divulgação',
  description: 'Veja onde os anúncios aparecem no Guia, do banner no topo às conversas do fórum.',
  tip: 'Toda a faixa do banner superior abre o site anunciado.',
  action: 'Ver espaços e formatos', href: '/divulgue',
};

export const animationGuideSteps: readonly GuideStep[] = [...guideSteps, ...githubGuideSteps, ...aboutGuideSteps, ...categoryGuides, advertisingGuideStep];

export function guideSectionForGroup(category?: string): GuideStepId {
  const sections: Record<string, GuideStepId> = { communities: 'communities', creators: 'creators', learn: 'study', inform: 'inform', connect: 'networking', create: 'practice', opportunities: 'career' };
  return categoryGuideById[category as GuideStepId]?.id ?? sections[category ?? ''] ?? 'explore';
}

export function guideAnimationSection(section: GuideStepId): GuideStepId {
  return section;
}

const sectionIntroductions: Partial<Record<GuideStepId, string>> = {
  communities: 'Comunidades reúnem pessoas para conversar sobre assuntos em comum. Elas podem ter grupos em várias plataformas e atender uma região, todo o Brasil ou outros países.',
  creators: 'Esta seção reúne perfis que publicam conteúdo de tecnologia nas redes sociais. O Guia ajuda você a encontrar esses perfis e acompanhar o conteúdo na rede de origem.',
  study: 'Esta seção reúne links para tutoriais, plataformas de cursos, faculdades, bootcamps, roadmaps, livros e certificações. O conteúdo fica nos sites indicados.',
  inform: 'Esta seção reúne fontes para acompanhar e consultar assuntos de tecnologia. Você encontra notícias, blogs, newsletters, podcasts e publicações para ler na fonte.',
  networking: 'Networking é a troca de experiências e contatos com outras pessoas. Esta seção reúne eventos, meetups, conferências e hackathons onde essas conversas podem acontecer.',
  practice: 'Esta seção reúne recursos para aplicar o que você aprende. Você encontra ferramentas, projetos de código aberto, desafios e laboratórios nos sites indicados.',
  career: 'Esta seção reúne sites de vagas e bolsas de estudo. Você também encontra programas de mentoria e voluntariado para consultar na fonte.',
  forum: 'O fórum é o espaço de conversa dentro do Guia. Você pode ler tópicos, fazer perguntas e trocar experiências com a comunidade.',
  explore: 'O catálogo reúne links de tecnologia organizados por assunto e categoria. Você encontra uma indicação no Guia e acessa o conteúdo no site de origem.',
  contribute: 'As sugestões ajudam a atualizar o catálogo com indicações da comunidade. Você pode propor um recurso novo ou uma correção para revisão.',
};

export function sectionWalkthrough(section: GuideStepId): readonly GuideStep[] {
  const categoryGuide = categoryGuideById[section];
  if (categoryGuide) {
    return [
      { ...categoryGuide, phase: 'what', label: 'O que é', tip: categoryGuide.tip },
      { ...categoryGuide, phase: 'why', label: 'Por que vale a pena', description: categoryGuide.reason!, tip: 'Use esta indicação como ponto de partida e confira os detalhes na fonte.' },
      { ...categoryGuide, phase: 'choose', label: 'Como escolher', description: categoryGuide.selection!, tip: categoryGuide.tip },
      { ...categoryGuide, phase: 'use', label: 'Como usar', description: categoryGuide.usage!, tip: categoryGuide.tip },
    ];
  }
  const base: GuideStep = guideSteps.find(step => step.id === section) ?? guideSteps[0];
  return [
    { ...base, phase: 'what', label: 'O que é', description: sectionIntroductions[base.id] ?? base.description, tip: 'Conheça a proposta da seção antes de explorar os itens.' },
    { ...base, phase: 'why', label: 'Por que vale a pena', description: base.reason ?? 'Reunir as indicações em um lugar ajuda você a encontrar referências e comparar opções antes de escolher.', tip: 'Use as indicações como ponto de partida para pesquisar na fonte.' },
    { ...base, phase: 'choose', label: 'Como escolher', description: base.selection ?? 'Defina o que você procura. Compare as opções e confira os detalhes na página de origem antes de decidir.', tip: 'Escolha pelo seu objetivo e pelo seu momento, além da popularidade.' },
    { ...base, phase: 'use', label: 'Como usar esta seção', description: base.description },
  ];
}
