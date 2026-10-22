// Browser smoke test without extra test dependencies. Uses a local Chrome installation.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { checkYouTubeCuration } from './youtube-curation-ui.mjs';
import { checkSocialCuration } from './social-curation-ui.mjs';
import { checkCommunityCuration } from './community-curation-ui.mjs';
import { checkCreatorCategories } from './creator-categories-ui.mjs';
import { checkRouteFlash } from './navigation-ui.mjs';
import { checkScrollbarLayout } from './scrollbar-ui.mjs';
import { installStudyFixtures, checkStudy } from './study-ui.mjs';
import { checkStudyCuration } from './study-curation-ui.mjs';
import { checkUniversityFilter } from './university-filter-ui.mjs';
import { checkContributionWizard } from './contribution-wizard-ui.mjs';
import { checkContributionImages } from './contribution-images-ui.mjs';
import { installDiscussionFixtures, checkDiscussions } from './discussions-ui.mjs';
import { checkLazyLoadFailure } from './lazy-load-ui.mjs';

const profile = await mkdtemp(join(tmpdir(), 'guia-ui-'));
const chrome = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome');
const processHandle = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const base = process.env.TEST_URL || 'http://localhost:5081';
const catalog = JSON.parse(await readFile(new URL('../src/generated/catalog.json', import.meta.url), 'utf8'));
const pageSize = 20;
let socket;
let launchError;
processHandle.on('error', error => { launchError = error; });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let port;
  for (let i = 0; i < 100; i++) {
    if (launchError) throw launchError;
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await sleep(100); }
  }
  if (!port) throw new Error('Chrome did not start. Configure CHROME_PATH.');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map(), errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { const request = pending.get(message.id); pending.delete(message.id); if (message.error) request.reject(message.error); else request.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
  };
  function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); }
  async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; }
  async function waitFor(expression) { for (let i = 0; i < 80; i++) { if (await evaluate(expression)) return; await sleep(100); } throw new Error(`Timed out: ${expression}`); }
  async function navigate(path) { if (path.startsWith('/contribuir')) { const category=new URL(path,base).searchParams.get('categoria')||''; await navigate('/'); await evaluate('window.dispatchEvent(new CustomEvent("guia:contribute",{detail:'+JSON.stringify(category)+'}))'); await waitFor('!!document.querySelector("[data-slot=dialog-content]")'); return; } await send('Page.navigate', { url: base + path }); await waitFor(`document.readyState === 'complete' && !!document.querySelector('main h1') && location.pathname === ${JSON.stringify(new URL(path, base).pathname)}`); await sleep(500); }

  async function click(expression) {
    for(let i=0;i<25;i++) {

      const step=await evaluate(`(()=>{const panel=(${expression})?.closest('[data-contribution-step]');const active=document.querySelector('[data-contribution-step]:not([hidden])');return panel?.hidden?{target:Number(panel.dataset.contributionStep),current:Number(active.dataset.contributionStep)}:null})()`);
      if(!step)break;
      await click(`[...document.querySelectorAll('[data-contribution-form] button')].find(b=>b.textContent.trim()===${JSON.stringify(step.target>step.current?'Continuar':'Voltar')})`);
      await waitFor(`Number(document.querySelector('[data-contribution-step]:not([hidden])').dataset.contributionStep)!==${step.current}`);

    }
    const point = await evaluate(`(async()=>{const el=${expression};if (!el) throw Error('Missing element: ' + ${JSON.stringify(expression)});el.scrollIntoView({block:'center',behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`); await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  }

  async function selectOption(label,text) { await click('document.querySelector('+JSON.stringify('[role="combobox"][aria-label="'+label+'"]')+')'); await waitFor('!!document.querySelector('+JSON.stringify('[role="listbox"]')+')'); await click('[...document.querySelectorAll('+JSON.stringify('[role="option"]')+')].find(option=>option.textContent.trim()==='+JSON.stringify(text)+')'); }
  async function hover(expression) { const point = await evaluate(`(()=>{const el=${expression}; if(!el)throw Error('Missing element');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }); }
  async function key(key, code = key) { const windowsVirtualKeyCode = { Enter: 13, Escape: 27, ArrowDown: 40, ArrowRight: 39, ArrowLeft: 37, Tab: 9 }[key]; await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, ...(key === 'Enter' ? { text: '\r' } : {}) }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode }); }
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await installDiscussionFixtures(send);
  await installStudyFixtures(send,catalog);
  await checkStudy({send,evaluate,waitFor,navigate,click,selectOption});
  await checkStudyCuration({catalog,send,evaluate,waitFor,navigate,click});
  await checkUniversityFilter({catalog,send,evaluate,waitFor,navigate,click,selectOption});
  await checkContributionWizard({send,evaluate,waitFor,navigate,click,selectOption,sleep});
  await checkContributionImages({send,evaluate,waitFor,navigate,click,selectOption});
  await checkScrollbarLayout({send,evaluate,waitFor,navigate,click,key});
  await checkCreatorCategories({send, evaluate, waitFor, navigate, click, selectOption});
  await checkYouTubeCuration({selectOption,send, evaluate, waitFor, navigate, click, selectOption});
  await checkSocialCuration({send, evaluate, waitFor, navigate, click, selectOption});
  await checkCommunityCuration({send, evaluate, waitFor, navigate, click, selectOption});
  await checkLazyLoadFailure({send, evaluate, waitFor, navigate, click, errors});
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate('/');
  await checkRouteFlash({send,evaluate,waitFor,navigate});
  assert.equal(await evaluate(`!!document.querySelector('main [aria-label="Patrocínio master"]')`), false);
  assert.equal(await evaluate(`!!document.querySelector('main #apoiadores')`), true);
  assert.equal(await evaluate(`document.querySelector('main #apoiadores a[href="/#contato"]').textContent`), 'Apoie o Guia');
  assert.equal(await evaluate(`[...document.querySelectorAll('[data-slot="navigation-menu-trigger"]')].some(element => element.textContent.trim() === 'Projeto')`), false);
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Principal"] a[href="/forum"]')`), true);
  for (const path of ['/apoiadores', '/apoiadores/']) {
    const redirect = await fetch(base + path, { redirect: 'manual' });
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.get('location'), '/#apoiadores');
  }
  await waitFor(`document.querySelector('footer').textContent.includes('12 usuários ativos')`);
  await waitFor(`!!document.querySelector('footer [aria-label="Mantenedores"] a img')`);
  assert.equal(await evaluate(`document.querySelectorAll('footer [aria-label="Mantenedores"] a img').length`), 8);
  assert.equal(await evaluate(`document.querySelector('footer a[href="/#mantenedores"]').textContent.trim()`), '+2 mais');
  const footerCenters = await evaluate(`[...document.querySelector('footer .site-frame').children].map(element => {const rect=element.getBoundingClientRect();return rect.y+rect.height/2})`);
  assert.ok(Math.max(...footerCenters) - Math.min(...footerCenters) < 2, JSON.stringify(footerCenters));
  assert.ok(await evaluate(`(()=>{const frame=document.querySelector('footer .site-frame'), bounds=frame.getBoundingClientRect(), online=frame.children[1].getBoundingClientRect();return Math.abs(online.x+online.width/2-(bounds.x+bounds.width/2))<2})()`));
  await hover(`document.querySelector('footer [aria-label="Mantenedores"] a')`);
  await waitFor(`document.querySelector('[role="tooltip"]')?.textContent.includes('5 contribuições nos repositórios do Guia')`);
  assert.equal(await evaluate(`document.querySelector('main h1').textContent`), 'Fórum do Guia da TI');
  assert.equal(await evaluate(`document.querySelector('main h1').getBoundingClientRect().height <= 1`), true);
  assert.equal(await evaluate(`document.querySelectorAll('main [aria-label="Categorias"], main [aria-label="Busca"], main [aria-label="Resultados"]').length`), 0);
  assert.equal(await evaluate(`document.body.textContent.includes('Seu próximo passo')`), false);
  assert.equal(await evaluate(`document.querySelector('main').textContent.includes('As conversas da comunidade vão aparecer aqui')`), true);
  const groups = JSON.parse(await readFile('src/navigation.json', 'utf8')).filter(group => !['creators', 'communities'].includes(group.id)).map(group => ({ ...group, categories: group.categories.filter(category => category.id !== 'courses') }));
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Principal"] a[href="/criadores"]')`), true);
  assert.deepEqual(await evaluate(`[...document.querySelector('[aria-label="Principal"] ul').children].slice(0,3).map(element=>element.textContent.trim())`), ['Início', 'Comunidades', 'Criadores']);
  assert.equal(await evaluate(`[...document.querySelectorAll('[data-slot="navigation-menu-trigger"]')].some(element => element.textContent.trim() === 'Criadores')`), false);
  const categoryHref = category => category.platform ? `/criadores?plataforma=${category.platform}` : '/' + category.route;
  const openPanels = "document.querySelectorAll('[data-slot=\"navigation-menu-content\"][data-state=\"open\"]')";
  await hover(`document.querySelector('[data-slot="navigation-menu-trigger"]')`);
  await waitFor(`${openPanels}.length === 1`);
  for (const group of groups) {
    await hover(`[...document.querySelectorAll('[data-slot="navigation-menu-trigger"]')].find(e=>e.textContent.trim()===${JSON.stringify(group.name)})`);
    await waitFor(`${openPanels}.length === 1 && !!${openPanels}[0].querySelector('a[href="/${group.categories[0].route}"]')`);
    assert.deepEqual(await evaluate(`[...${openPanels}[0].querySelectorAll('a')].map(a=>a.getAttribute('href'))`), group.categories.map(categoryHref));
    const bounds = await evaluate(`(()=>{const r=${openPanels}[0].getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,viewport:document.documentElement.getBoundingClientRect().width,top:r.top,headerBottom:document.querySelector('header').getBoundingClientRect().bottom}})()`);
    assert.ok(Math.abs(bounds.width - bounds.viewport) <= 1 && bounds.left === 0 && Math.abs(bounds.top - bounds.headerBottom) <= 1, JSON.stringify(bounds));
  }
  await hover(`${openPanels}[0].querySelector('a')`);
  await sleep(250);
  assert.equal(await evaluate(`${openPanels}.length`), 1, 'Panel must stay open when entering it');
  await key('Escape');
  await waitFor(`!document.querySelector('[data-slot="navigation-menu-content"]') || document.querySelector('[data-slot="navigation-menu-content"]').getAttribute('data-state') === 'closed'`);
  await evaluate(`document.querySelector('[data-slot="navigation-menu-trigger"]').focus()`); await key('Enter');
  await waitFor(`${openPanels}.length === 1`);
  await key('ArrowDown');
  await waitFor(`document.activeElement?.getAttribute('data-slot') === 'navigation-menu-link'`);
  await key('Escape');
  await waitFor(`!document.querySelector('[data-slot="navigation-menu-content"]') || document.querySelector('[data-slot="navigation-menu-content"]').getAttribute('data-state') === 'closed'`);
  await navigate('/areas/design/');
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('main table th'), element => element.textContent)`), ['Item', 'Categoria', 'Atualização', 'Ações']);
  assert.equal(await evaluate(`document.querySelectorAll('main table tbody tr').length`), Math.min(pageSize, catalog.resources.filter(resource => resource.areas.includes('design')).length));
  assert.deepEqual(await evaluate(`(()=>{const style=getComputedStyle(document.querySelector('main table').parentElement); return {background:style.backgroundColor,shadow:style.boxShadow}})()`), { background: 'rgb(255, 255, 255)', shadow: 'none' });
  await evaluate(`(()=>{const input=document.querySelector('#resource-search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Pessoa Criadora');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor(`!!document.querySelector('main table a[aria-label="Ver perfil: Pessoa Criadora — exemplo"]')`);
  const profileAction = "document.querySelector('main table a[aria-label=\"Ver perfil: Pessoa Criadora — exemplo\"]')";
  assert.equal(await evaluate(`${profileAction}.target`), '_blank');
  assert.equal(await evaluate(`${profileAction}.getAttribute('href')`), 'https://example.org/criador-exemplo');
  await evaluate(`(()=>{const input=document.querySelector('#resource-search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor(`document.querySelectorAll('main table tbody tr').length === ${Math.min(pageSize, catalog.resources.filter(resource => resource.areas.includes('design')).length)}`);
  for (const width of [320, 390, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `Catalog overflow at ${width}px`);
  }
  for (const route of ['/empresas/', '/divulgue/']) {
    await navigate(route);
    for (const width of [320, 360, 390, 414, 768]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `${route} overflow at ${width}px`);
    }
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate('/areas/backend/');
  await evaluate(`(()=>{const input=document.querySelector('#resource-search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Primeiros passos');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor(`!!document.querySelector('main table a[aria-label="Ver detalhes: Primeiros passos com C#"]')`);
  await click(`document.querySelector('main table a[aria-label="Ver detalhes: Primeiros passos com C#"]')`);
  await waitFor(`document.querySelector('main h1').textContent === 'Primeiros passos com C#'`);
  assert.equal(await evaluate(`!!document.querySelector('main a[href="https://example.org/curso-exemplo"][target="_blank"]')`), true);
  await navigate('/comunidades/');
  await waitFor(`document.querySelectorAll('main table tbody tr').length === ${Math.min(pageSize,catalog.resources.filter(resource=>resource.type==='communities').length)}`);
  assert.equal(await evaluate(`[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Sugerir comunidade')`),true);
  assert.equal(await evaluate(`document.querySelectorAll('svg [data-uf]').length`),0);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[role="tab"]')].map(tab=>tab.textContent.trim())`),['Geral','WhatsApp','Telegram','Discord','Facebook','LinkedIn','Reddit','GitHub','Site próprio','Outra']);
  assert.equal(await evaluate(`[...document.querySelectorAll('[role="tab"]')].every(tab=>!!tab.querySelector('svg'))`),true);
  await evaluate(`document.querySelector('[role="tab"][aria-selected="true"]').focus()`); await key('ArrowRight');
  await waitFor(`document.querySelector('[role="tab"][aria-selected="true"]').textContent==='WhatsApp'`);
  assert.equal(await evaluate(`new URLSearchParams(location.search).get('plataforma')`),'whatsapp');
  await click(`[...document.querySelectorAll('[role="tab"]')].find(tab=>tab.textContent==='Geral')`);
  for(const width of [320,390,768,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'Community tabs overflow at '+width);
  }
  const filterButton = "[...document.querySelectorAll('main button')].find(button=>button.textContent.includes('Filtrar comunidades'))";
  await click(filterButton);
  await waitFor(`document.querySelector('[role="dialog"]')?.textContent.includes('Filtrar comunidades')`);
  // The map loads on demand after the dialog opens.
  await waitFor(`document.querySelectorAll('svg [data-uf]').length === 27`);
  await evaluate(`document.querySelector('[data-uf="SP"]').focus()`); await key('Enter');
  await evaluate(`document.querySelector('[data-uf="RJ"]').focus()`); await key('Enter');
  assert.equal(await evaluate(`document.querySelectorAll('svg path[aria-pressed="true"]').length`),2);
  assert.equal(await evaluate(`location.search`),'');
  await click(`[...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent.trim()==='Regiões')`);
  await evaluate(`document.querySelector('[data-uf="SP"]').focus()`); await key('Enter');
  assert.equal(await evaluate(`document.querySelectorAll('svg path[aria-pressed="true"]').length`),4);
  await click(`[...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent.trim()==='Sul')`);
  assert.equal(await evaluate(`document.querySelectorAll('svg path[aria-pressed="true"]').length`),7);
  for(const width of [320,390,768,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'Community dialog overflow at '+width);
    assert.equal(await evaluate(`document.querySelector('[role="dialog"]').scrollWidth <= document.querySelector('[role="dialog"]').clientWidth`),true);
  }
  if(process.env.COMMUNITY_SCREENSHOT_PATH) {const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(process.env.COMMUNITY_SCREENSHOT_PATH,Buffer.from(screenshot.data,'base64'));}
  await click(`[...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent.includes('Brasil inteiro'))`);
  assert.equal(await evaluate(`document.querySelectorAll('svg path[aria-pressed="true"]').length`),27);
  assert.equal(await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent.includes('Brasil inteiro')).getAttribute('data-variant')`),'default');
  const nationalDialogSize=await evaluate(`(()=>{const r=document.querySelector('[role="dialog"]').getBoundingClientRect();return {width:r.width,height:r.height}})()`);
  assert.equal(await evaluate(`!!document.querySelector('select[name="filterModality"]')`),false);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await click(`[...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent.includes('Internacionais'))`);
  await waitFor(`!!document.querySelector('svg[aria-label="Mapa do mundo inteiro selecionado"]')`);
  assert.deepEqual(await evaluate(`(()=>{const r=document.querySelector('[role="dialog"]').getBoundingClientRect();return {width:r.width,height:r.height}})()`),nationalDialogSize);
  await waitFor(`[...document.querySelectorAll('svg[aria-label="Mapa do mundo inteiro selecionado"] path')].some(path=>path.style.opacity && Number(path.style.opacity)<1)`);
  await waitFor(`[...document.querySelectorAll('svg[aria-label="Mapa do mundo inteiro selecionado"] path')].every(path=>!path.style.opacity)`);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await waitFor(`(()=>{const rect=document.querySelector('[role="dialog"]').getBoundingClientRect();return rect.left>=0 && rect.right<=innerWidth && rect.top>=0 && rect.bottom<=innerHeight})()`);
  if(process.env.COMMUNITY_SCREENSHOT_PATH){const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(process.env.COMMUNITY_SCREENSHOT_PATH.replace('.png','.world.png'),Buffer.from(screenshot.data,'base64'));}
  for(const width of [320,768,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await click(`[...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent.includes('Brasil inteiro'))`);
    const size=await evaluate(`(()=>{const r=document.querySelector('[role="dialog"]').getBoundingClientRect();return {width:r.width,height:r.height}})()`);
    await click(`[...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent.includes('Internacionais'))`);
    assert.deepEqual(await evaluate(`(()=>{const r=document.querySelector('[role="dialog"]').getBoundingClientRect();return {width:r.width,height:r.height}})()`),size,'Dialog size changed at '+width);
  }
  assert.equal(await evaluate(`document.querySelectorAll('[role="dialog"] [role="combobox"]').length`),0);
  await click(`[...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent==='Aplicar filtros')`);
  await waitFor(`!document.querySelector('[role="dialog"]')`);
  assert.equal(await evaluate(`new URLSearchParams(location.search).get('alcance')`),'international');
  await click(`[...document.querySelectorAll('[role="tab"]')].find(tab=>tab.textContent==='Discord')`);
  assert.equal(await evaluate(`new URLSearchParams(location.search).get('categorias')`),null);
  assert.equal(await evaluate(`new URLSearchParams(location.search).get('plataforma')`),'discord');
  assert.equal(await evaluate(`document.querySelector('main').textContent.includes('Ainda não há comunidades nesta localização')`),true);
  await click(filterButton);
  await click(`[...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent==='Limpar filtros')`);
  await click(`[...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent==='Cancelar')`);
  assert.equal(await evaluate(`new URLSearchParams(location.search).get('plataforma')`),'discord');
  await click(`[...document.querySelectorAll('main button')].find(button=>button.textContent==='Limpar filtros')`);
  assert.equal(await evaluate(`new URLSearchParams(location.search).get('plataforma')`),'discord');
  await click(`[...document.querySelectorAll('[role="tab"]')].find(tab=>tab.textContent==='Geral')`);
  await waitFor(`document.querySelectorAll('main table tbody tr').length === ${Math.min(pageSize,catalog.resources.filter(resource=>resource.type==='communities').length)}`);
  await navigate('/comunidades/?alcance=regional&estados=SP,RJ,XX');
  await click(filterButton);
  await waitFor(`document.querySelectorAll('svg path[aria-pressed="true"]').length===2`);
  await key('Escape');
  await navigate('/criadores/');
  assert.equal(await evaluate(`document.querySelector('main h1').textContent`), 'Criadores');
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[role="tab"]'), element => element.textContent.trim())`), ['YouTube', 'Instagram', 'TikTok', 'LinkedIn', 'Twitter / X']);
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('[role="tab"]')).every(element => !!element.querySelector('svg'))`), true);
  assert.equal(await evaluate(`document.querySelector('[role="tab"][aria-selected="true"]').textContent`), 'YouTube');
  assert.equal(await evaluate(`document.querySelectorAll('[role="tabpanel"] table tbody tr').length`), Math.min(pageSize, catalog.resources.filter(resource => resource.type === 'youtube').length));
  await evaluate(`document.querySelector('[role="tab"][aria-selected="true"]').focus()`);
  await key('ArrowRight');
  await waitFor(`document.querySelector('[role="tab"][aria-selected="true"]').textContent === 'Instagram'`);
  assert.equal(await evaluate(`new URLSearchParams(location.search).get('plataforma')`), 'instagram');
  assert.equal(await evaluate(`document.querySelectorAll('[role="tabpanel"] table tbody tr').length`), Math.min(pageSize, catalog.resources.filter(resource => new URL(resource.url).hostname.endsWith('instagram.com')).length));
  await navigate('/criadores/?plataforma=tiktok');
  await waitFor(`document.querySelector('[role="tab"][aria-selected="true"]').textContent === 'TikTok'`);
  for (const width of [320, 390, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `Creators overflow at ${width}px`);
  }
  await navigate('/eventos/');
  await waitFor(`document.body.textContent.includes('Ainda não há recursos aqui')`);
  const footerBounds = await evaluate(`(()=>{const r=document.querySelector('footer').getBoundingClientRect();return {bottom:r.bottom,left:r.left,right:r.right,viewport:document.documentElement.getBoundingClientRect().width,height:innerHeight}})()`);
  assert.ok(Math.abs(footerBounds.bottom - footerBounds.height) <= 1 && footerBounds.left === 0 && Math.abs(footerBounds.right - footerBounds.viewport) <= 1, JSON.stringify(footerBounds));
  assert.equal(await evaluate(`!!document.querySelector('footer a[href="https://fulldev.com.br"]')`), true);
  await navigate('/');
  await waitFor(`document.querySelector('[aria-label="O Guia em números"] dd').textContent === '18'`);
  await waitFor(`!!document.querySelector('#mantenedores a img')`);
  await hover(`document.querySelector('#mantenedores a')`);
  await waitFor(`document.querySelector('[role="tooltip"]')?.textContent.includes('ana')`);
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="O Guia em números"] dt').length`), 4);
  await waitFor(`document.querySelectorAll('[aria-label="O Guia em números"] dd')[0].textContent === '18'`);
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="O Guia em números"] dd')[2].textContent`), new Intl.NumberFormat('pt-BR').format(catalog.resources.filter(resource => !resource.demo).length));
  for (const width of [320, 390, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `About overflow at ${width}px`);
  }
  await evaluate(`sessionStorage.setItem('activityTestMode', 'error')`);
  await navigate('/');
  await waitFor(`document.querySelector('footer').textContent.includes('Atividade indisponível')`);
  assert.equal(await evaluate(`document.querySelector('[aria-label="O Guia em números"] dd').textContent`), String.fromCharCode(0x2014));
  assert.equal(await evaluate(`document.querySelector('[aria-label="O Guia em números"]').textContent.includes('Usuários ativos')`), false);
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="O Guia em números"] dd')[0].textContent`), String.fromCharCode(0x2014));
  await evaluate(`sessionStorage.removeItem('activityTestMode')`);
  await navigate('/');
  await waitFor(`document.querySelector('[aria-label="O Guia em n\u00fameros"] dd').textContent === '18'`);
  await waitFor(`document.querySelector('footer').textContent.includes('12 usu\u00e1rios ativos')`);
  await navigate('/');
  await click(`document.querySelector('[aria-label="Ativar tema escuro"]')`);
  await waitFor(`document.documentElement.classList.contains('dark')`);
  await click(`document.querySelector('[data-slot="navigation-menu-trigger"]')`); await waitFor(`document.querySelector('[data-slot="navigation-menu-content"]')?.getAttribute('data-state') === 'open'`);
  await key('Escape');
  await click(`document.querySelector('[aria-label="Ativar tema claro"]')`);
  for (const width of [768, 320, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: false });
    await sleep(200);
    const dimensions = await evaluate(`(()=>{const m=document.querySelector('[data-slot="navigation-menu"]'),l=document.querySelector('[data-slot="navigation-menu-list"]'),s=getComputedStyle(l);return {viewport:innerWidth,document:document.documentElement.scrollWidth,header:document.querySelector('header').getBoundingClientRect().width,menu:m.getBoundingClientRect().width,menuClass:m.className,list:l.getBoundingClientRect().width,listClass:l.className,listScroll:l.scrollWidth,listCSS:{width:s.width,minWidth:s.minWidth,maxWidth:s.maxWidth,flex:s.flex,overflow:s.overflow}}})()`);
    assert.ok(dimensions.document <= dimensions.viewport, `Overflow at ${width}px: ${JSON.stringify(dimensions)}`);
  }
  await click(`document.querySelector('[data-slot="sheet-trigger"]')`);
  await waitFor(`document.querySelector('[data-slot="sheet-content"]')?.getAttribute('data-state') === 'open'`);
  const mobileTriggers = "document.querySelectorAll('[aria-label=\"Navegação para celular\"] button[aria-expanded]')";
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Navegação para celular"] a[href="/criadores"]')`), true);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[aria-label="Navegação para celular"] a')].slice(0,3).map(element=>element.textContent.trim())`), ['Início', 'Comunidades', 'Criadores']);
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Navegação para celular"] a[href="/apoiadores"]')`), false);
  assert.equal(await evaluate(`[...${mobileTriggers}].some(element=>element.textContent.trim()==='Criadores')`), false);
  assert.equal(await evaluate(`[...${mobileTriggers}].filter(e=>e.getAttribute('aria-expanded')==='true').length`), 0);
  for (const group of groups) {
    await click(`[...${mobileTriggers}].find(e=>e.textContent.trim()===${JSON.stringify(group.name)})`);
    await waitFor(`[...${mobileTriggers}].filter(e=>e.getAttribute('aria-expanded')==='true').length === 1`);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('[aria-label="Navegação para celular"] [role="region"][data-state="open"] a')].map(a=>a.getAttribute('href'))`), group.categories.map(categoryHref));
  }
  await click(`[...${mobileTriggers}].find(e=>e.getAttribute('aria-expanded')==='true')`);
  await waitFor(`[...${mobileTriggers}].every(e=>e.getAttribute('aria-expanded')==='false')`);
  await key('Escape');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await sleep(200);
  await click(`document.querySelector('[data-slot="navigation-menu-trigger"]')`); await waitFor(`document.querySelector('[data-slot="navigation-menu-content"]')?.getAttribute('data-state') === 'open'`);
  assert.equal(await evaluate(`document.querySelector('[data-slot="navigation-menu-content"]').textContent.includes('Plataformas de cursos')`), true);
  for (const category of groups.flatMap(group => group.categories).filter(category => category.id !== 'courses')) {
    const response = await fetch(base + categoryHref(category));
    assert.equal(response.status, 200, category.route);
    assert.ok((await response.text()).includes(category.platform ? 'Todos os criadores' : category.name), category.route);
  }
  await checkDiscussions({ send, evaluate, click, waitFor, navigate });
  await evaluate(`sessionStorage.setItem('participationMode', 'member')`);
  await navigate('/contribuir/');
  await waitFor(`!!document.querySelector('input[name="url"]')`);
  await selectOption('Categoria do guia','Criadores');
  await evaluate(`(()=>{const input=document.querySelector('input[name="url"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'https://www.youtube.com/@ana');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor(`document.querySelector('input[name="name"]').value === 'Canal da Ana'`);
  assert.equal(await evaluate(`document.querySelector('textarea[name="description"]').value`), 'Conteúdo de tecnologia e programação para iniciantes.');
  assert.equal(await evaluate(`!!document.querySelector('img[alt="Foto de Canal da Ana"]')`), true);
  assert.equal(await evaluate(`document.querySelector('[data-contribution-form]').textContent.includes('1.200 inscritos')`), true);
  await evaluate(`sessionStorage.setItem('creatorTestMode', 'error');(()=>{const input=document.querySelector('input[name="url"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'https://www.youtube.com/@bia');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor(`document.querySelector('[data-contribution-form]').textContent.includes('A rede não disponibilizou')`);
  assert.equal(await evaluate(`!!document.querySelector('img[alt="Foto de Canal da Ana"]')`), false);
  assert.equal(await evaluate(`document.querySelector('input[name="name"]').value`), '');
  await evaluate(`sessionStorage.removeItem('creatorTestMode')`);
  await click(`[...document.querySelectorAll('[data-contribution-form] button')].find(b=>b.textContent.trim()==='Voltar')`);
  await selectOption('Categoria do guia','Comunidades');
  await waitFor(`!!document.querySelector('[role="combobox"][aria-label="Área de atuação"]')`);
  await selectOption('Área de atuação','Regional');
  await waitFor(`!!document.querySelector('button[data-field="communityStates"][data-value="SP"]')`);
  await click(`document.querySelector('button[data-field="communityStates"][data-value="SP"]')`);
  await evaluate(`(()=>{
    for(const [name,value] of Object.entries({url:'https://example.org/new-community',name:'Comunidade Paulista',summary:'Uma comunidade de tecnologia em São Paulo.'})) {
      const input=document.querySelector('input[name="'+name+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));
    }
    const textarea=document.querySelector('textarea[name="description"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(textarea,'Uma comunidade de tecnologia para pessoas de São Paulo.');textarea.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('button[data-field="communityPlatforms"][data-value="discord"]').click();
  })()`);
  await selectOption('Público da comunidade','Geral');
  await evaluate(`(()=>{const input=document.querySelector('input[name="communityMemberCount"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'4000');input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('button[data-field="communityMembersMoreThan"]').click();})()`);
  await click(`document.querySelector('button[data-field="communityPlatforms"][data-value="website"]')`);
  await evaluate(`(()=>{const input=document.querySelector('input[name="communityLink-website"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'https://example.org/new-community');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate(`(()=>{const input=document.querySelector('input[name="communityLink-discord"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'https://discord.gg/example');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await selectOption('Modalidade','Online');
  await selectOption('Categoria da comunidade','Networking');
  await click(`document.querySelector('[data-contribution-form] button[type="submit"]')`);
  await waitFor(`window.lastContribution?.communityLocation?.states?.includes('SP')`);
  assert.deepEqual(await evaluate(`window.lastContribution.communityLocation`), {scope:'regional',states:['SP']});
  assert.deepEqual(await evaluate(`window.lastContribution.communityPlatforms`), ['discord','website']);
  assert.equal(await evaluate(`window.lastContribution.communityAudience`),'general');
  assert.deepEqual(await evaluate(`window.lastContribution.communityMembers`),{count:4000,moreThan:true,checkedAt:new Date().toISOString().slice(0,10)});
  assert.deepEqual(await evaluate(`window.lastContribution.communityLinks`),[{platform:'discord',url:'https://discord.gg/example'},{platform:'website',url:'https://example.org/new-community'}]);
  assert.equal(await evaluate(`window.lastContribution.communityModality`), 'online');
  await waitFor(`!!document.querySelector('[data-contribution-form] a[href="https://github.com/guia-da-ti/guia-da-ti-dados/pull/10"]')`);
  assert.equal(await evaluate(`document.querySelector('[data-contribution-form] a[href="https://github.com/guia-da-ti/guia-da-ti-dados/pull/10"]').textContent`),'Acompanhar PR');
  assert.equal(await evaluate(`document.querySelector('main').textContent.includes('A conversa #10')`),false);
  await navigate('/contribuir/?categoria=communities');
  await waitFor(`document.querySelector('[role="combobox"][aria-label="Categoria do guia"]')?.textContent.includes('Comunidade')`);
  assert.equal(await evaluate(`!!document.querySelector('button[data-field="communityPlatforms"]')`),true);
  assert.equal(await evaluate(`document.querySelector('[data-contribution-form] button[type="submit"]').disabled`),true);
  if (process.env.UI_SCREENSHOT_PATH) {
    await evaluate(`sessionStorage.setItem('discussionTestMode', 'showcase'); sessionStorage.removeItem('participationMode')`);
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('/');
    await waitFor(`document.querySelectorAll('[aria-label="Conversas"] > li').length === 4`);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(process.env.UI_SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'));
    await click(`document.querySelector('[data-slot="navigation-menu-trigger"]')`);
    await waitFor(`${openPanels}.length === 1`);
    const menuScreenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(process.env.UI_SCREENSHOT_PATH.replace(/\.png$/, '.menu.png'), Buffer.from(menuScreenshot.data, 'base64'));
  }
  assert.deepEqual(errors, [], 'Browser errors');
  console.log('UI OK: menus, keyboard navigation, catalog table, resource actions, home discussion area, empty state, about, dark theme and responsive layout.');
} finally {
  socket?.close();
  processHandle.kill();
}
