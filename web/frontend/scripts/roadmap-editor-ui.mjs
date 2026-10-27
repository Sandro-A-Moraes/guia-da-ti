import assert from 'node:assert/strict';

const conflictMessage = 'Este roadmap mudou desde que você abriu o editor. Abra o editor de novo para trabalhar a partir da versão mais recente.';

// Fixtures exist only in the browser test; production always uses the backend.
export async function installRoadmapFixtures(send) {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const roadmapFetch = window.fetch.bind(window);
    window.roadmapSourceCalls = 0;
    window.fetch = async (input, options) => {
      const url = new URL(String(input), location.origin);
      const mode = sessionStorage.getItem('roadmapMode') || 'ok';
      const source = url.pathname.match(/^\\/api\\/roadmaps\\/([^/]+)\\/source$/);
      if (source) {
        window.roadmapSourceCalls++;
        if (mode === 'missing') return new Response('{}', { status: 404 });
        const step = (id, title) => ({ id, title, importance: 'recommended' });
        return Response.json({ sha: 'sha-' + window.roadmapSourceCalls, roadmap: { slug: source[1], type: 'roadmaps', name: 'Caminho em dados', summary: 'Um roteiro para organizar os primeiros estudos.', description: 'Descrição do roteiro de teste para a edição.',
          areas: ['dados'], technologies: ['python'], languages: ['pt-BR'], updatedAt: '2026-10-01',
          roadmap: { level: 'beginner', sections: [{ id: 'base', title: 'Base', steps: [step('logica', 'Lógica'), step('python', 'Python'), step('sql', 'SQL')] }, { id: 'pratica', title: 'Prática', steps: [step('projeto', 'Projeto'), step('portfolio', 'Portfólio')] }] } } });
      }
      if (url.pathname === '/api/roadmaps/proposals') {
        window.lastRoadmap = JSON.parse(options.body);
        window.lastRoadmapCsrf = options.headers['X-CSRF-Token'];
        if (mode === 'conflict') return Response.json({ error: ${JSON.stringify(conflictMessage)} }, { status: 400 });
        if (mode === 'rejected') return Response.json({ error: 'Confira o nome, o resumo e a descrição do roadmap.' }, { status: 400 });
        const result = { url: 'https://github.com/guia-da-ti/guia-da-ti-dados/pull/11' };
        const notice = { id: 'roadmap:' + (window.noticeItems?.length ?? 0), login: 'ana', name: window.lastRoadmap.name, category: 'roadmaps', url: result.url };
        window.noticeItems?.push(notice);
        return Response.json({ ...result, notice });
      }
      return roadmapFetch(input, options);
    };` });
}

export async function checkRoadmapEditor({ catalog, send, evaluate, waitFor, navigate, click, selectOption, key, sleep }) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate('/');
  await evaluate(`sessionStorage.setItem('participationMode','member'); sessionStorage.setItem('roadmapMode','ok'); Object.keys(localStorage).filter(k => k.startsWith('guia:roadmap-draft')).forEach(k => localStorage.removeItem(k))`);
  const form = '[data-contribution-form]';
  const title = () => evaluate(`document.querySelector('${form} h2')?.textContent`);
  const active = text => waitFor(`document.querySelector('${form} h2')?.textContent === ${JSON.stringify(text)}`);
  const button = text => `[...document.querySelectorAll('${form} button')].find(b => b.textContent.trim() === ${JSON.stringify(text)})`;
  const next = () => click(button('Continuar'));
  const fill = async (selector, value) => {
    await click(`document.querySelector(${JSON.stringify(selector)})`);
    await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});const set=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  };
  const addTo = async (parent, text) => { await fill(`[data-new="${parent}"]`, text); await click(`document.querySelector('[data-new="${parent}"]').closest('div.flex').querySelector('button')`); };
  const announcement = () => evaluate(`document.querySelector('${form} [aria-live="polite"].sr-only')?.textContent`);
  const noOverflow = async label => assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth && document.querySelector('[role="dialog"]').scrollWidth <= document.querySelector('[role="dialog"]').clientWidth`), true, label);
  const closeDialog = async () => { await click(`document.querySelector('[data-slot="dialog-close"]')`); await waitFor(`!document.querySelector('[data-slot="dialog-content"]')`); };
  const openSuggest = async () => { await navigate('/roadmaps/'); await click(`document.querySelector('main button[aria-label="Sugerir roadmap"]')`); await waitFor(`!!document.querySelector('[data-slot="dialog-content"]')`); };

  // Two ways to suggest a roadmap.
  await openSuggest();
  await waitFor(`document.querySelector('[data-slot="dialog-title"]')?.textContent === 'Sugerir um roadmap'`);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-slot="dialog-content"] button span.font-medium')].map(el => el.textContent)`), ['Montar um roadmap aqui', 'Indicar um roadmap de outro site']);
  await click(`[...document.querySelectorAll('[data-slot="dialog-content"] button')].find(b => b.textContent.includes('Indicar um roadmap de outro site'))`);
  await waitFor(`!!document.querySelector('${form}')`);
  assert.equal(await evaluate(`document.querySelector('${form} [name="type"]')?.value`), 'roadmaps');
  await closeDialog();

  // A full proposal, using only the keyboard-friendly controls.
  await openSuggest();
  await click(`[...document.querySelectorAll('[data-slot="dialog-content"] button')].find(b => b.textContent.includes('Montar um roadmap aqui'))`);
  await active('Identificação');
  await fill('input[name="name"]', 'Dados do zero');
  await fill('input[name="summary"]', 'Um caminho de estudo para começar em dados.');
  await fill('textarea[name="description"]', 'Roadmap de teste para quem nunca trabalhou com dados e quer um caminho simples.');
  assert.equal(await evaluate(`document.querySelector('${form}').textContent.includes('O endereço será /roadmaps/dados-do-zero')`), true);
  await next(); await active('Classificação');
  await selectOption('Assunto principal', 'Dados');
  await selectOption('Nível de quem vai estudar', 'Iniciante');
  await next(); await active('Estrutura');
  await next();
  assert.equal(await evaluate(`!!document.querySelector('${form} [role="alert"]')`), true, 'An empty structure blocks the step');
  await addTo('sections', 'Fundamentos'); await addTo('sections', 'Prática');
  assert.equal(await announcement(), 'Bloco “Prática” incluído.');
  for (const text of ['Lógica', 'Planilhas', 'SQL']) await addTo('fundamentos', text);
  for (const text of ['Projeto', 'Portfólio']) await addTo('pratica', text);
  await waitFor(`document.querySelector('#roadmap-structure-status').textContent.startsWith('2 de 2 a 20 blocos · 5 de')`);
  assert.equal(await evaluate(`!document.querySelector('${form} [aria-label="O que ainda falta"]')`), true);

  // Move and remove by keyboard. Focus stays on a usable button.
  await evaluate(`document.querySelector('[data-node="planilhas"][data-action="up"]').focus()`);
  await key('Enter');
  await waitFor(`document.querySelector('[data-node="planilhas"][data-action="up"]')?.disabled === true`);
  assert.match(await announcement(), /“Planilhas” foi para cima\. Posição 1 de 3\./);
  await waitFor(`document.activeElement?.dataset?.node === 'planilhas' && document.activeElement?.dataset?.action === 'down'`);
  assert.equal(await evaluate(`document.querySelector('[data-node="sql"][data-action="down"]').disabled`), true, 'The last step cannot move down');
  await evaluate(`document.querySelector('button[aria-label="Remover a etapa SQL"]').focus()`);
  await key('Enter');
  await waitFor(`!document.querySelector('[data-node="sql"]')`);
  assert.equal(await announcement(), 'Etapa “SQL” removido.');
  await waitFor(`document.activeElement?.id === 'roadmap-structure-status'`);
  assert.equal(await evaluate(`!!document.querySelector('${form} [aria-label="O que ainda falta"]')`), true, 'Four steps are not enough');
  await addTo('fundamentos', 'SQL');
  await waitFor(`document.activeElement?.dataset?.node === 'sql'`);

  // Alternatives and the removal confirmation.
  await click(`document.querySelector('button[aria-label="Detalhes da etapa Lógica"]')`);
  await click(`[...document.querySelectorAll('${form} button')].find(b => b.textContent.trim() === 'Agrupar como alternativa com a próxima')`);
  await waitFor(`!!document.querySelector('${form}')?.textContent.includes('Faz parte de um grupo')`);
  await sleep(300);
  await click(`document.querySelector('button[aria-label="Remover o bloco Prática"]')`);
  await waitFor(`[...document.querySelectorAll('[data-slot="dialog-title"]')].some(t => t.textContent === 'Remover bloco?')`);
  await click(`[...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.trim() === 'Cancelar')`);
  await waitFor(`![...document.querySelectorAll('[data-slot="dialog-title"]')].some(t => t.textContent.includes('Remover'))`);
  assert.equal(await evaluate(`!!document.querySelector('[data-node="pratica"]')`), true, 'Cancel keeps the block');

  await next(); await active('Revisar e enviar');
  assert.equal(await evaluate(`!!document.querySelector('${form} [aria-label="Legenda da importância"]')`), true, 'The review shows the roadmap preview');
  assert.equal(await evaluate(`document.querySelector('${form} button[type="submit"]').disabled`), true, 'Sending needs the acknowledgement');
  await click(`document.querySelector('${form} [data-contribution-step]:not([hidden]) [role="checkbox"]')`);
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 1, mobile: false });
  await noOverflow('Editor overflows at 375px');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await click(`document.querySelector('${form} button[type="submit"]')`);
  await waitFor(`window.lastRoadmap?.name === 'Dados do zero'`);
  const sent = await evaluate(`window.lastRoadmap`);
  assert.deepEqual(sent.areas, ['dados']);
  assert.equal(sent.roadmap.level, 'beginner');
  assert.equal(sent.roadmap.sections.length, 2);
  assert.equal(sent.roadmap.sections[0].steps.map(s => s.id).join(), 'planilhas,logica,sql');
  assert.equal('slug' in sent || 'baseSha' in sent, false);
  assert.equal(await evaluate(`window.lastRoadmapCsrf`), 'test-csrf');
  await waitFor(`document.querySelector('[data-slot="dialog-content"]')?.textContent.includes('PR aberto para revisão.')`);
  assert.equal(await evaluate(`document.querySelector('[data-slot="dialog-content"] a[href$="/pull/11"]')?.textContent`), 'Acompanhar PR');
  assert.equal(await evaluate(`Object.keys(localStorage).some(k => k.startsWith('guia:roadmap-draft'))`), false, 'A sent roadmap leaves no draft');
  await closeDialog();

  // A rejected proposal shows the server message and keeps the form.
  await evaluate(`sessionStorage.setItem('roadmapMode','rejected')`);
  await openSuggest();
  await click(`[...document.querySelectorAll('[data-slot="dialog-content"] button')].find(b => b.textContent.includes('Montar um roadmap aqui'))`);
  await active('Identificação');
  await fill('input[name="name"]', 'Rascunho de teste');
  await sleep(800);
  await closeDialog();
  await openSuggest();
  await click(`[...document.querySelectorAll('[data-slot="dialog-content"] button')].find(b => b.textContent.includes('Montar um roadmap aqui'))`);
  await waitFor(`document.querySelector('${form}')?.textContent.includes('Rascunho recuperado')`);
  assert.equal(await evaluate(`document.querySelector('input[name="name"]').value`), 'Rascunho de teste');
  await click(`[...document.querySelectorAll('${form} button')].find(b => b.textContent.trim() === 'Descartar rascunho')`);
  await waitFor(`document.querySelector('input[name="name"]').value === ''`);
  assert.equal(await evaluate(`Object.keys(localStorage).some(k => k.startsWith('guia:roadmap-draft'))`), false, 'Discarding removes the draft');
  await closeDialog();

  // Editing a published roadmap, when the catalog has one.
  const published = catalog.resources.find(resource => resource.roadmap);
  if (published) {
    await evaluate(`sessionStorage.setItem('roadmapMode','conflict')`);
    await navigate(`/roadmaps/${published.slug}/`);
    await click(`[...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Sugerir alteração')`);
    await active('Identificação');
    assert.equal(await evaluate(`document.querySelector('input[name="name"]').value`), 'Caminho em dados');
    assert.equal(await evaluate(`document.querySelector('${form}').textContent.includes('O endereço continua /roadmaps/${published.slug}.')`), true);
    await next(); await active('Classificação'); await next(); await active('Estrutura'); await next(); await active('Revisar e enviar');
    await click(`document.querySelector('${form} [data-contribution-step]:not([hidden]) [role="checkbox"]')`);
    await click(`document.querySelector('${form} button[type="submit"]')`);
    await waitFor(`window.lastRoadmap?.slug === ${JSON.stringify(published.slug)}`);
    assert.equal(await evaluate(`window.lastRoadmap.baseSha`), 'sha-1');
    await waitFor(`document.querySelector('${form}')?.textContent.includes('O roadmap mudou')`);
    assert.equal(await evaluate(`document.querySelector('${form} textarea[aria-label="Seu texto, para copiar"]').value.includes('Caminho em dados')`), true);
    await evaluate(`sessionStorage.setItem('roadmapMode','ok')`);
    await click(`[...document.querySelectorAll('${form} button')].find(b => b.textContent.trim() === 'Abrir o editor de novo')`);
    await active('Identificação');
    await next(); await next(); await next(); await active('Revisar e enviar');
    await click(`document.querySelector('${form} [data-contribution-step]:not([hidden]) [role="checkbox"]')`);
    await click(`document.querySelector('${form} button[type="submit"]')`);
    await waitFor(`window.lastRoadmap?.baseSha === 'sha-2'`);
    await waitFor(`document.querySelector('[data-slot="dialog-content"]')?.textContent.includes('PR aberto para revisão.')`);
    await closeDialog();
    await evaluate(`sessionStorage.setItem('roadmapMode','missing')`);
    await navigate(`/roadmaps/${published.slug}/`);
    await click(`[...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Sugerir alteração')`);
    await waitFor(`document.querySelector('[data-slot="dialog-content"] [role="alert"]')?.textContent.includes('Não encontramos este roadmap.')`);
    await closeDialog();
  }

  // Dark theme keeps the editor readable and inside the dialog.
  await evaluate(`sessionStorage.setItem('roadmapMode','ok')`);
  await openSuggest();
  await click(`document.querySelector('[data-slot="dialog-close"]')`);
  await waitFor(`!document.querySelector('[data-slot="dialog-content"]')`);
  // The theme menu lives in the user menu when signed in, so the class is set directly.
  await evaluate(`document.documentElement.classList.add('dark')`);
  await click(`document.querySelector('main button[aria-label="Sugerir roadmap"]')`);
  await waitFor(`!!document.querySelector('[data-slot="dialog-content"]')`);
  await click(`[...document.querySelectorAll('[data-slot="dialog-content"] button')].find(b => b.textContent.includes('Montar um roadmap aqui'))`);
  await active('Identificação');
  await noOverflow('Editor overflows in the dark theme');
  await closeDialog();
  await evaluate(`document.documentElement.classList.remove('dark')`);
  await evaluate(`sessionStorage.removeItem('roadmapMode'); sessionStorage.removeItem('participationMode')`);
  console.log('Roadmap editor OK: two entry options, full proposal, keyboard moves, confirmation, draft, edit, conflict, 375px and dark theme.');
}
