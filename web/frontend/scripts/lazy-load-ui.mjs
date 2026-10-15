import assert from 'node:assert/strict';

// Blocks the lazy chunks of the contribution form and the community filter, and checks that the page survives and the retry downloads them again.
export async function checkLazyLoadFailure({ send, evaluate, waitFor, navigate, click, errors }) {
  const button = text => `[...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent.trim()===${JSON.stringify(text)})`;
  const filterButton = "[...document.querySelectorAll('main button')].find(button=>button.textContent.includes('Filtrar comunidades'))";
  const alert = `document.querySelector('[role="dialog"] [role="alert"]')?.textContent || ''`;
  const pageIntact = `!!document.querySelector('main h1') && document.querySelectorAll('main table tbody tr').length > 0`;
  const block = urls => send('Network.setBlockedURLs', { urls });
  // Some browsers keep the failed address in the module map, so the retry must request a new one.
  const retried = name => evaluate(`performance.getEntriesByType('resource').some(entry=>entry.name.includes('/assets/${name}-') && entry.name.includes('.js?retry='))`);
  const before = errors.length;
  await send('Network.enable');
  try {
    await navigate('/');
    await block(['*/assets/ResourceContribution-*']);
    const contribute = `window.dispatchEvent(new CustomEvent('guia:contribute',{detail:'communities'}))`;
    await evaluate(contribute);
    await waitFor(`(document.querySelector('[data-slot="dialog-content"] [role="alert"]')?.textContent || '').includes('Não foi possível carregar o formulário')`);
    assert.equal(await evaluate(`!!document.querySelector('main h1')`), true);
    await block([]);
    await evaluate(contribute);
    // Without a session, the loaded form asks the visitor to sign in.
    await waitFor(`(document.querySelector('[data-slot="dialog-content"]')?.textContent || '').includes('Entre com o GitHub para sugerir')`);
    assert.equal(await retried('ResourceContribution'), true);

    await navigate('/comunidades/');
    await block(['*/assets/CommunityLocationFilter-*']);
    await click(filterButton);
    await waitFor(`(${alert}).includes('Não foi possível carregar o filtro de localização')`);
    assert.equal(await evaluate(pageIntact), true, 'The page must stay mounted when the filter fails to load');
    assert.equal(await evaluate(`!!${button('Aplicar filtros')} && !!${button('Tentar novamente')}`), true);
    await click(button('Cancelar'));
    await waitFor(`!document.querySelector('[role="dialog"]')`);
    await click(`[...document.querySelectorAll('[role="tab"]')].find(tab=>tab.textContent==='Discord')`);
    await waitFor(`new URLSearchParams(location.search).get('plataforma') === 'discord'`);
    await click(`[...document.querySelectorAll('[role="tab"]')].find(tab=>tab.textContent==='Geral')`);
    // Reopening also tries the download again, without keeping the cached rejection.
    await click(filterButton);
    await waitFor(`(${alert}).includes('Não foi possível carregar o filtro de localização')`);
    await block([]);
    await click(button('Tentar novamente'));
    await waitFor(`document.querySelectorAll('[role="dialog"] svg [data-uf]').length === 27`);
    assert.equal(await retried('CommunityLocationFilter'), true);
    assert.equal(await evaluate(alert), '');

    await block(['*/assets/WorldMap-*']);
    await click(`[...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent.includes('Internacionais'))`);
    await waitFor(`(${alert}).includes('Não foi possível carregar o mapa mundial')`);
    assert.equal(await evaluate(`${pageIntact} && !!${button('Aplicar filtros')}`), true);
    await block([]);
    await click(button('Tentar novamente'));
    await waitFor(`!!document.querySelector('svg[aria-label="Mapa do mundo inteiro selecionado"]')`);
    assert.equal(await retried('WorldMap'), true);
    await click(button('Aplicar filtros'));
    await waitFor(`!document.querySelector('[role="dialog"]')`);
    assert.equal(await evaluate(`new URLSearchParams(location.search).get('alcance')`), 'international');
  } finally {
    await block([]);
    await send('Network.disable');
  }
  // The blocked downloads are expected. Any other browser error still fails the run.
  const unexpected = errors.splice(before).filter(error => !error.includes('ERR_BLOCKED_BY_CLIENT'));
  errors.push(...unexpected);
}
