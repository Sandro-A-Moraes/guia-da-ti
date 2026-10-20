import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

// Fixtures exist only in the browser test; production always uses the backend.
export async function installDiscussionFixtures(send) {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const originalFetch = window.fetch.bind(window);
    window.discussionRequests = [];
    window.noticeItems = [];
    window.fetch = async (input, options) => {
      const url = new URL(String(input), location.origin);
      if (url.pathname === '/api/contributions/notices') return Response.json({stream:'test',cursor:window.noticeItems.length,items:url.searchParams.get('stream')==='test'?window.noticeItems.slice(Number(url.searchParams.get('after'))):[]});
      if (url.pathname === '/api/community/users') return sessionStorage.getItem('registeredTestMode') === 'error'
        ? new Response('{}', { status: 503 }) : Response.json({ registeredUsers: 37, trackingSince: '2026-10-06T12:00:00Z' });
      if (url.pathname === '/api/community/activity') return sessionStorage.getItem('activityTestMode') === 'error'
        ? new Response('{}', { status: 503 }) : Response.json({ activeUsers: 12, windowMinutes: 5 });
      if (url.pathname === '/api/contributors') return Response.json({ items: Array.from({ length: 10 }, (_, index) => ({ name: index === 0 ? 'ana' : 'person' + index, url: 'https://github.com/' + (index === 0 ? 'ana' : 'person' + index), avatarUrl: location.origin + '/favicon.svg', contributions: 5 })) });
      if (url.pathname === '/api/creators/profile') return sessionStorage.getItem('creatorTestMode') === 'error'
        ? Response.json({ error: 'A rede não disponibilizou os dados desse perfil.' }, { status: 503 })
        : Response.json({ network: 'youtube', url: url.searchParams.get('url'), name: 'Canal da Ana', description: 'Conteúdo de tecnologia e programação para iniciantes.', avatarUrl: location.origin + '/favicon.svg', followers: 1200, followersText: null, checkedAt: '2026-10-06T12:00:00Z' });
      if (url.pathname === '/api/auth/session') return Response.json({ enabled: !!sessionStorage.getItem('participationMode'), login: ['member', 'error'].includes(sessionStorage.getItem('participationMode')) ? 'ana' : null, avatarUrl: location.origin + '/favicon.svg', csrfToken: 'test-csrf' });
      if (url.pathname === '/api/discussions/publish') {
        window.lastPublication = JSON.parse(options.body);
        window.lastCsrf = options.headers['X-CSRF-Token'];
        if (sessionStorage.getItem('participationMode') === 'error') return Response.json({ error: 'Publicação recusada.' }, { status: 403 });
        return Response.json({ number: window.lastPublication.number || 7 });
      }
      if (url.pathname === '/api/contributions') {
        window.lastContribution = JSON.parse(options.body);
        if (sessionStorage.getItem('participationMode') === 'error') return Response.json({error:'Envio recusado.'},{status:403});
        const result={url:'https://github.com/guia-da-ti/guia-da-ti-dados/pull/10'};
        const notice={id:'test:'+window.noticeItems.length,login:'ana',name:window.lastContribution.name,category:window.lastContribution.type,url:result.url};
        window.noticeItems.push(notice);
        return Response.json({...result,notice});
      }
      if (url.pathname === '/api/contributions/images') {
        const file=options.body.get('image');
        window.lastImageUpload={name:file.name,size:file.size,csrf:options.headers['X-CSRF-Token']};
        return Response.json({id:'11111111111111111111111111111111.png'});
      }
      if (!url.pathname.startsWith('/api/discussions')) return originalFetch(input, options);
      window.discussionRequests.push(url.pathname + url.search);
      const mode = sessionStorage.getItem('discussionTestMode') || 'unconfigured';
      if (mode === 'error') return new Response('{}', { status: 503 });
      if (mode === 'unconfigured') return Response.json({ status: 'unconfigured' });
      if (mode === 'slow') await new Promise(resolve => setTimeout(resolve, 1200));
      const category = { id: 'questions', name: 'Dúvidas' };
      const repositoryUrl = 'https://github.com/example/community/discussions';
      const secondPage = url.searchParams.has('after');
      const discussion = { number: 7, title: 'Como começar em tecnologia?', preview: 'Compartilhe suas experiências e caminhos para quem está começando em tecnologia.', category, resourceCategory: 'jobs', author: 'ana', updatedAt: '2026-10-05T12:00:00Z', commentCount: 2, isAnswered: true, locked: mode === 'locked', url: repositoryUrl + '/7' };
      const comment = { id: 'comment-1', author: 'bia', body: 'Resposta de exemplo', createdAt: '2026-10-05T12:00:00Z', isAnswer: true, replies: [], replyCount: 0 };
      const pageInfo = { hasNextPage: !secondPage, endCursor: secondPage ? null : 'cursor-2' };
      if (url.pathname === '/api/discussions/404') return new Response('{}', { status: 404 });
      if (url.pathname.endsWith('/7')) return Response.json({ status: 'ready', discussion, body: mode==='suggestion'?'Faculdade de teste\\n\\nCategoria do guia: universities\\n\\nResumo da indicação.\\n\\nDescrição para quem está escolhendo onde estudar.\\n\\nLink: https://example.org\\n\\nAssuntos: educacao\\n\\nIdiomas: pt-BR\\n\\nTipo de instituição: Pública':'<img src=x onerror=alert(1)> Texto da conversa', comments: [secondPage ? { ...comment, id: 'comment-2', body: 'Segundo comentário' } : { ...comment, replies: [{ ...comment, id: 'reply-1', isAnswer: false }], replyCount: 6 }], pageInfo });
      if (mode === 'showcase') return Response.json({ status: 'ready', repositoryUrl, categories: [category, { id: 'ideas', name: 'Ideias' }], items: [{ ...discussion, imageUrl: '/favicon.svg' }, { ...discussion, number: 8, title: 'Qual foi o seu primeiro projeto?', author: 'bia', isAnswered: false }, { ...discussion, number: 9, title: 'Como organizar uma rotina de estudos?', author: 'caio', isAnswered: false }], pageInfo: { hasNextPage: false, endCursor: null } });
      if (url.searchParams.has('q')) return Response.json({ status: 'ready', repositoryUrl, categories: [category, { id: 'ideas', name: 'Ideias' }], items: url.searchParams.get('q') === 'semresultado' || url.searchParams.get('category') === 'ideas' ? [] : [{ ...discussion, title: secondPage ? 'Dúvida sobre JavaScript (continuação)' : 'Dúvida sobre JavaScript' }], totalCount: url.searchParams.get('q') === 'semresultado' || url.searchParams.get('category') === 'ideas' ? 0 : 21, pageInfo });
      return Response.json({ status: 'ready', repositoryUrl, categories: [category, { id: 'ideas', name: 'Ideias' }], items: mode === 'empty' || url.searchParams.get('category') === 'ideas' ? [] : [{ ...discussion, number: secondPage ? 8 : 7, title: secondPage ? 'Outra conversa' : discussion.title }], pageInfo: mode === 'empty' || url.searchParams.get('category') === 'ideas' ? { hasNextPage: false, endCursor: null } : pageInfo });
    };
  ` });
}

export async function checkDiscussions({ send, evaluate, click, waitFor, navigate }) {
  const mode = value => evaluate(`sessionStorage.setItem('discussionTestMode', ${JSON.stringify(value)})`);
  const button = label => `[...document.querySelectorAll('main button')].find(e=>e.textContent.trim()===${JSON.stringify(label)})`;
  await mode('slow');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigate('/');
  assert.equal(await evaluate(`!!document.querySelector('main [role="status"] [data-slot="skeleton"]')`), true);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('main [data-slot="skeleton"]')).animationName`), 'none');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('main')).transform`), 'none');
  await waitFor(`!!document.querySelector('[aria-label="Conversas"]')`);
  await waitFor(`!document.querySelector('main [data-slot="skeleton"]')`);
  await send('Emulation.setEmulatedMedia', { features: [] });
  await mode('showcase');
  await navigate('/');
  await waitFor(`document.querySelectorAll('[aria-label="Conversas"] > li').length === 4`);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Conversas"]').textContent.includes('Sites de vagas')`), false);
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Publicidade"]').parentElement.previousElementSibling?.querySelector('article') && !!document.querySelector('[aria-label="Publicidade"]').parentElement.nextElementSibling?.querySelector('article')`), true);
  assert.equal(await evaluate(`(()=>{const article=document.querySelector('[aria-label="Conversas"] article');const image=article?.querySelector('img');return image?.alt===('Imagem de '+article.querySelector('h2').textContent)&&image?.getBoundingClientRect().height<=144&&getComputedStyle(image).objectFit==='cover'})()`), true, 'Feed images fill their compact preview without distortion');
  await mode('ready');
  await navigate('/');
  assert.equal(await evaluate(`!!document.querySelector('main [aria-label="Mantenedores"]')`), false);
  await waitFor(`!!document.querySelector('[aria-label="Conversas"]')`);
  await click(`document.querySelector('#discussion-search')`);
  await send('Input.insertText', { text: 'erro js' });
  assert.equal(await evaluate(`!!${button('Buscar')}`), false);
  await waitFor(`document.querySelector('main').textContent.includes('Dúvida sobre JavaScript')`);
  assert.equal(await evaluate(`document.querySelector('[role="status"]').textContent.includes('21 conversas encontradas')`), true);
  await click(button('Próxima'));
  await waitFor(`window.discussionRequests.at(-1).includes('after=cursor-2') && window.discussionRequests.at(-1).includes('q=erro+js')`);
  await waitFor(`document.querySelector('a[href*="conversa=7"]')?.textContent === 'Dúvida sobre JavaScript (continuação)'`);
  await click(`document.querySelector('[aria-label="Conversas"] article')`);
  await waitFor(`!!document.querySelector('[aria-label="Comentários"]')`);
  assert.equal(await evaluate(`document.querySelector('main').textContent.includes('Sites de vagas')`), false);
  await waitFor(`!!document.querySelector('[aria-label="Publicidade"]').nextElementSibling`);
  assert.equal(await evaluate(`(()=>{const next=document.querySelector('[aria-label="Publicidade"]').nextElementSibling;return next.matches('button') || !!next.querySelector('button')})()`), true);
  await click(`document.querySelector('[aria-label="Comentários"] details > summary')`);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Comentários"] details').open`), false);
  await click(`document.querySelector('[aria-label="Comentários"] details > summary')`);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Comentários"] details').open`), true);
  await click(`[...document.querySelectorAll('main a')].find(e=>e.textContent.includes('Voltar à busca'))`);
  await waitFor(`document.querySelector('#discussion-search')?.value === 'erro js'`);
  await click(`document.querySelector('[aria-label="Categoria das conversas"]')`);
  await click(`[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.trim()==='Ideias')`);
  await waitFor(`document.querySelector('main').textContent.includes('Nenhuma conversa encontrada')`);
  assert.equal(await evaluate(`window.discussionRequests.at(-1).includes('q=erro+js') && window.discussionRequests.at(-1).includes('category=ideas') && !window.discussionRequests.at(-1).includes('after=')`), true);
  await click(button('Limpar busca'));
  await waitFor(`document.querySelector('main').textContent.includes('Ainda não há conversas nesta categoria')`);
  assert.equal(await evaluate(`document.querySelector('#discussion-search').value`), '');
  await navigate('/?q=semresultado');
  await waitFor(`document.querySelector('main').textContent.includes('Nenhuma conversa encontrada')`);
  await navigate('/');
  await waitFor(`!!document.querySelector('[aria-label="Conversas"]')`);
  assert.equal(await evaluate(`document.querySelector('a[href="/?conversa=7"]').textContent`), 'Como começar em tecnologia?');
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Publicidade"]')`), true);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Ferramentas do fórum"]').getBoundingClientRect().height <= 80`), true);
  await click(button('Próxima'));
  await waitFor(`document.querySelector('main').textContent.includes('Outra conversa')`);
  assert.equal(await evaluate(`window.discussionRequests.some(url=>url.includes('after=cursor-2'))`), true);
  await click(button('Anterior'));
  await waitFor(`!!document.querySelector('a[href="/?conversa=7"]')`);
  await click(`document.querySelector('[aria-label="Categoria das conversas"]')`);
  await click(`[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.trim()==='Ideias')`);
  await waitFor(`document.querySelector('main').textContent.includes('Ainda não há conversas nesta categoria')`);
  assert.equal(await evaluate(`window.discussionRequests.at(-1).includes('category=ideas') && !window.discussionRequests.at(-1).includes('after=')`), true);
  await mode('empty');
  await navigate('/');
  await waitFor(`document.querySelector('main').textContent.includes('Comece a primeira conversa')`);
  await mode('error');
  await navigate('/');
  await waitFor(`!!document.querySelector('main [role="alert"]')`);
  await mode('ready');
  await click(button('Tentar novamente'));
  await waitFor(`!!document.querySelector('a[href="/?conversa=7"]')`);
  await click(`document.querySelector('a[href="/?conversa=7"]')`);
  await waitFor(`!!document.querySelector('[aria-label="Comentários"]')`);
  assert.equal(await evaluate(`location.search`), '?conversa=7');
  assert.equal(await evaluate(`document.querySelector('main').textContent.includes('Resposta aceita')`), true);
  assert.equal(await evaluate(`document.querySelector('main').textContent.includes('Ver todas as 6 respostas no GitHub')`), true);
  assert.equal(await evaluate(`document.querySelectorAll('main img').length`), 0, 'Discussion body must be escaped');
  assert.equal(await evaluate(`document.querySelector('main').textContent.includes('<img src=x onerror=alert(1)>')`), true);
  await click(button('Próxima'));
  await waitFor(`document.querySelector('main').textContent.includes('Segundo comentário')`);
  await mode('locked');
  await navigate('/?conversa=7');
  await waitFor(`document.querySelector('main').textContent.includes('Conversa encerrada')`);
  assert.equal(await evaluate(`document.querySelector('main').textContent.includes('Responder no GitHub')`), false);
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: false });
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'Mobile thread overflow');
  await navigate('/?conversa=404');
  await waitFor(`document.querySelector('main').textContent.includes('Esta conversa não foi encontrada')`);
  await mode('unconfigured');
  await navigate('/');
  await waitFor(`document.querySelector('main').textContent.includes('As conversas da comunidade vão aparecer aqui')`);

  await mode('ready');
  await evaluate(`sessionStorage.setItem('participationMode', 'guest')`);
  await navigate('/');
  await waitFor(`!![...document.querySelectorAll('header button')].find(e=>e.textContent.trim()==='Entrar com GitHub')`);
  await click(`[...document.querySelectorAll('header button')].find(e=>e.textContent.trim()==='Entrar com GitHub')`);
  await waitFor(`document.querySelector('[role="dialog"]')?.textContent.includes('Primeira vez no GitHub?')`);
  assert.equal(await evaluate(`document.querySelector('[role="dialog"] a[href="https://github.com/signup"]')?.target`), '_blank');
  await click(`[...document.querySelectorAll('[role="dialog"] button')].find(e=>e.textContent.trim()==='Cancelar')`);
  await waitFor(`!document.querySelector('[role="dialog"]')`);
  await waitFor(`!!${button('Novo tópico')}`);
  await click(button('Novo tópico'));
  await waitFor(`document.querySelector('[role="dialog"]')?.textContent.includes('Você está deslogado')`);
  assert.equal(await evaluate(`!!document.querySelector('[role="dialog"] [aria-label="Ajuda para entrar com GitHub"]')`), true);
  assert.equal(await evaluate(`!![...document.querySelectorAll('[role="dialog"] button')].find(e=>e.textContent.trim()==='Entrar com GitHub')`), true);
  assert.equal(await evaluate(`document.querySelectorAll('textarea').length`), 0);
  await evaluate(`window.realPopupOpen = window.open; window.popupPageMarker = 'preserved'; window.popupOriginalUrl = location.href; window.open = (url) => { window.popupLoginUrl = url; return window.testLoginPopup = { closed: false, close() { this.closed = true; }, focus() {} }; }`);
  await click(`[...document.querySelectorAll('[role="dialog"] button')].find(e=>e.textContent.trim()==='Entrar com GitHub')`);
  assert.equal(await evaluate(`window.popupLoginUrl`), '/api/auth/login?returnUrl=%2Fauth%2Fcomplete.html');
  assert.equal(await evaluate(`location.href === window.popupOriginalUrl`), true);
  await evaluate(`sessionStorage.setItem('participationMode', 'member')`);
  await waitFor(`!!document.querySelector('header [aria-label="Menu do usuário ana"]')`);
  assert.equal(await evaluate(`window.popupPageMarker`), 'preserved');
  assert.equal(await evaluate(`window.testLoginPopup.closed`), true);
  assert.equal(await evaluate(`!!document.querySelector('header img[alt="Foto de ana"]')`), true);
  assert.equal(await evaluate(`!![...document.querySelectorAll('header button')].find(e=>e.textContent.trim()==='Entrar com GitHub')`), false);
  await waitFor(`!!document.querySelector('[role="dialog"] textarea')`);
  await click(button('Cancelar'));
  await evaluate(`window.open = window.realPopupOpen`);
  await click(`document.querySelector('header [aria-label="Menu do usuário ana"]')`);
  await waitFor(`!!document.querySelector('[role="menu"]')`);
  assert.equal(await evaluate(`document.querySelector('[role="menu"]').textContent.includes('Contribuir') && document.querySelector('[role="menu"]').textContent.includes('Sair') && document.querySelector('[role="menu"]').textContent.includes('Ativar tema')`), true);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await waitFor(`!document.querySelector('[role="menu"]')`);
  await waitFor(`!!${button('Novo tópico')}`);
  await click(button('Novo tópico'));
  await click(`document.querySelector('input[id$="-title"]')`);
  await send('Input.insertText', { text: 'Um novo tópico' });
  await click(`document.querySelector('[aria-label="Categoria"]')`);
  await click(`[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.trim()==='Dúvidas')`);
  await click(`document.querySelector('textarea')`);
  await send('Input.insertText', { text: 'Texto do tópico' });
  await click(button('Publicar'));
  await waitFor(`location.search === '?conversa=7' && !!document.querySelector('[aria-label="Comentários"]')`);
  await waitFor(`!!${button('Participe da conversa…')}`);
  await click(button('Participe da conversa…'));
  await click(`document.querySelector('textarea')`);
  await send('Input.insertText', { text: 'Meu comentário' });
  await click(button('Publicar'));
  await waitFor(`window.lastPublication?.body === 'Meu comentário'`);
  assert.equal(await evaluate(`window.lastPublication.number`), 7);
  assert.equal(await evaluate(`window.lastCsrf`), 'test-csrf');
  await waitFor(`!document.querySelector('textarea')`);
  await waitFor(`!!${button('Responder')}`);
  await click(button('Responder'));
  await click(`document.querySelector('textarea')`);
  await send('Input.insertText', { text: 'Minha resposta' });
  await click(button('Publicar'));
  await waitFor(`window.lastPublication?.body === 'Minha resposta'`);
  assert.equal(await evaluate(`window.lastPublication.replyToId`), 'comment-1');
  await evaluate(`sessionStorage.setItem('participationMode', 'error')`);
  await navigate('/?conversa=7');
  await waitFor(`!!${button('Participe da conversa…')}`);
  await click(button('Participe da conversa…'));
  await click(`document.querySelector('textarea')`);
  await send('Input.insertText', { text: 'Preservar rascunho' });
  await click(button('Publicar'));
  await waitFor(`document.querySelector('main [role="alert"]')?.textContent === 'Publicação recusada.'`);
  assert.equal(await evaluate(`document.querySelector('textarea').value`), 'Preservar rascunho');
  await mode('locked');
  await navigate('/?conversa=7');
  await waitFor(`document.querySelector('main').textContent.includes('Conversa encerrada')`);
  assert.equal(await evaluate(`!!${button('Participe da conversa…')} || !!${button('Responder')}`), false);
  for (const [path, title] of [['/comunidades', 'Comunidades'], ['/sobre', 'Sobre o Guia da TI']]) {
    await navigate(`${path}/`);
    assert.equal(await evaluate(`document.querySelector('main h1').textContent`), title);
    if (path === '/sobre') { await waitFor(`!!document.querySelector('#mantenedores a[href="https://github.com/ana"] img')`); assert.equal(await evaluate(`document.querySelector('#mantenedores h2').textContent`), 'Mantenedores'); }
    if (path === '/sobre') {
      assert.equal(await evaluate(`!!document.querySelector('#apoiadores a[href="https://www.hostgator.com.br/"]')`), true);
      assert.equal(await evaluate(`document.querySelector('[aria-label="Principal"] a[href="/sobre"]').getAttribute('aria-current')`), 'page');
    }
  }
  await mode('suggestion');
  await navigate('/?conversa=7');
  await waitFor(`!!document.querySelector('[aria-label="Detalhes da indicação"]')`);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Detalhes da indicação"]').textContent.includes('Pública')`), true);
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Detalhes da indicação"] a[href="https://example.org"]')`), true);
  assert.equal(await evaluate(`[...document.querySelectorAll('main a')].some(a=>a.href.includes('/contribuir'))`), false);
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Respostas ao comentário"]')`), true);
  await evaluate(`window.noticeItems.push({id:'remote-notice',login:'bia',name:'Curso de exemplo',category:'platforms',url:'https://github.com/example/community/discussions/10'})`);
  await waitFor(`document.querySelector('[aria-label="Avisos de sugestões"]').textContent.includes('bia adicionou Curso de exemplo em Plataformas de cursos')`);
  await click(`document.querySelector('[aria-label="Fechar aviso"]')`);
  await waitFor(`!document.querySelector('[aria-label="Fechar aviso"]')`);
  if (process.env.UI_SCREENSHOT_PATH) {
    const capture = await send('Page.captureScreenshot', {captureBeyondViewport:true});
    await writeFile(process.env.UI_SCREENSHOT_PATH.replace(/\.png$/, '.discussion.png'), Buffer.from(capture.data, 'base64'));
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  console.log('Suggestion discussion OK: separate details and comments, nested replies, no suggestion button, mobile layout and live notices.');
}
