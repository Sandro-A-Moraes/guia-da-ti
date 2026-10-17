import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

export async function checkContributionImages({send,evaluate,waitFor,navigate,click,selectOption}) {
  await evaluate(`sessionStorage.setItem('participationMode','member')`);
  await navigate('/plataformas/');
  const trigger=`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Sugerir plataforma')`;
  const route=await evaluate('location.href');
  await click(trigger);

  await waitFor(`!!document.querySelector('[data-contribution-form]')`);
  assert.equal(await evaluate('location.href'),route);
  await evaluate(`(()=>{for(const [name,value] of Object.entries({name:'Plataforma com imagem',url:'https://example.org/image-course',summary:'Uma plataforma com imagem no cadastro.',description:'Descrição para conferir a prévia e o envio da imagem.'})) {const el=document.querySelector('[data-contribution-form] [name="'+name+'"]');Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
  await waitFor(`document.querySelector('aside[aria-label="Como a sugestão aparecerá no Guia"]')?.textContent.includes('Plataforma com imagem')`);
  await click(`document.querySelector('[data-contribution-form] input[type="file"]')`);
  await evaluate(`(()=>{const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAvsAAAAASUVORK5CYII='),c=>c.charCodeAt(0));const data=new DataTransfer();data.items.add(new File([bytes],'foto.png',{type:'image/png'}));const el=document.querySelector('[data-contribution-form] input[type="file"]');el.files=data.files;el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await waitFor(`document.querySelector('aside img')?.src.startsWith('blob:') && document.querySelector('aside img').naturalWidth>0`);
  assert.equal(await evaluate(`document.querySelector('[name="imageUrl"]').disabled`),true);
  await selectOption('Assunto principal','Educação');
  if (process.env.CONTRIBUTION_SCREENSHOT_PATH) {
    await click(`[...document.querySelectorAll('[data-contribution-form] button')].find(b=>b.textContent.trim()==='Voltar')`);
    await click(`[...document.querySelectorAll('[data-contribution-form] button')].find(b=>b.textContent.trim()==='Voltar')`);
    const screenshot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(process.env.CONTRIBUTION_SCREENSHOT_PATH,Buffer.from(screenshot.data,'base64'));
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    const mobile=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(process.env.CONTRIBUTION_SCREENSHOT_PATH.replace(/\.png$/,'.mobile.png'),Buffer.from(mobile.data,'base64'));
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  }

  await click(`document.querySelector('[data-contribution-form] button[type="submit"]')`);
  await waitFor(`!!window.lastImageUpload && !!window.lastContribution?.imageUploadId`);
  assert.equal(await evaluate('window.lastImageUpload.csrf'), 'test-csrf');
  assert.equal(await evaluate('window.lastImageUpload.name'), 'foto.png');
  assert.equal(await evaluate('window.lastContribution.imageUploadId'), '11111111111111111111111111111111.png');
  assert.equal(await evaluate('window.lastContribution.imageUrl'), undefined);
   await waitFor(`document.querySelector('[data-contribution-form] h2')?.textContent === 'Categoria do guia'`);

  assert.equal(
    await evaluate(`!!document.querySelector('[data-slot="dialog-content"]')`),
    true
  );

  assert.equal(
    await evaluate(`document.querySelector('[data-contribution-form] input[name="name"]')?.value`),
    ''
  );

  assert.equal(await evaluate('location.href'), route);
  await evaluate(`sessionStorage.removeItem('participationMode')`);
  console.log('Contribution dialog OK: same route, upload credentials, metadata and dialog closure.');
}
