import assert from 'node:assert/strict';

export async function checkContributionWizard({ send, evaluate, waitFor, navigate, click, selectOption, sleep }) {
  await evaluate(`sessionStorage.setItem('participationMode','member')`);

await navigate('/');
await evaluate(`document.querySelector('[aria-label="Principal"] a[href="/sobre"]').focus()`);
await evaluate(`window.dispatchEvent(new CustomEvent('guia:contribute', { detail: 'universities' }))`);
await waitFor(`!!document.querySelector('[data-slot="dialog-content"]')`);

  await waitFor(`!!document.querySelector('[role="progressbar"]')`);
  assert.equal(await evaluate(`document.querySelector('[data-slot="dialog-content"]').getBoundingClientRect().width`),896);
  const next = () => click(`[...document.querySelectorAll('[data-contribution-form] button')].find(b=>b.textContent.trim()==='Continuar')`);
  const active = title =>
    waitFor(
      `document.querySelector('[data-contribution-form] h2')?.textContent === ${JSON.stringify(title)}`
    );
  const fill = async (name,value) => { await click(`document.querySelector('[data-contribution-form] input[name="${name}"], [data-contribution-form] textarea[name="${name}"]')`); await send('Input.insertText',{text:value}); };
  assert.equal(await evaluate(`document.querySelectorAll('[data-contribution-step]:not([hidden])').length`),1);

  await next(); await active('Tipo de instituição');

  await next();
  assert.equal(
    await evaluate(`document.querySelector('[data-contribution-form] h2')?.textContent`),
    'Tipo de instituição'
  );
  await selectOption('Tipo de instituição','Privada');
  await next(); await active('Link principal da faculdade');

  await next(); assert.equal(await evaluate(`!!document.querySelector('[data-contribution-form] [role="alert"]')`),true);
  await fill('url','https://example.org/wizard-university'); await next(); await active('Imagem'); await next(); await active('Nome da faculdade');
  await fill('name','Faculdade por etapas');
  await click(`[...document.querySelectorAll('[data-contribution-form] button')].find(b=>b.textContent.trim()==='Voltar')`);
  await active('Imagem');
  await click(`[...document.querySelectorAll('[data-contribution-form] button')].find(b=>b.textContent.trim()==='Voltar')`); await active('Link principal da faculdade');
  assert.equal(await evaluate(`document.querySelector('input[name="url"]').value`),'https://example.org/wizard-university');
  await next(); await active('Imagem'); await next(); await active('Nome da faculdade');
  assert.equal(await evaluate(`document.querySelector('input[name="name"]').value`),'Faculdade por etapas');
  await next(); await active('Apresentação da faculdade'); await fill('summary','Uma faculdade enviada pelo formulário em etapas.');
  await next(); await active('Detalhes da faculdade'); await fill('description','Descrição da faculdade para conferir o envio e a preservação dos campos.');
  await next(); await active('Assunto principal');
  await selectOption('Assunto principal','Educação');
  await next(); await active('Tecnologias (opcional)'); await next(); await active('Idiomas disponíveis'); await next(); await active('Revisar e enviar');
  assert.equal(await evaluate(`document.querySelector('[data-contribution-step]:not([hidden])').textContent.includes('Faculdade por etapas')`),true);
  await click(`document.querySelector('[data-contribution-form] button[type="submit"]')`);
  await waitFor(`window.lastContribution?.name === 'Faculdade por etapas'`);
  assert.equal(await evaluate(`window.lastContribution.universityType`),'private');
  await waitFor(`document.querySelector('[data-contribution-form] h2')?.textContent === 'Categoria do guia'`);

  assert.equal(
    await evaluate(`!!document.querySelector('[data-slot="dialog-content"]')`),
    true
  );

  assert.equal(
    await evaluate(`document.querySelector('[data-contribution-form] input[name="name"]')?.value`),
    ''
  );
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});

  await click(`document.querySelector('[data-slot="dialog-close"]')`);
  await waitFor(`!document.querySelector('[data-slot="dialog-content"]')`);
  await waitFor(`document.activeElement?.getAttribute('href') === '/sobre'`);

  assert.equal(
    await evaluate(`document.activeElement?.getAttribute('href')`),
    '/sobre'
  );

  await evaluate(`sessionStorage.removeItem('participationMode')`);

  console.log('Contribution wizard OK: 896px, one step, validation, back/next, preserved values, review, submission and mobile.');
}
