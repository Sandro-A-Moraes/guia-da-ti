import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearDraft, draftKey, emptyForm, formFromSource, isEditConflict, outlineText, readDraft, roadmapSlug, toProposal, writeDraft } from '../src/roadmap-editor.ts';

const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }; };
const form = { ...emptyForm(), name: ' Front-end para começar ', summary: 'Resumo do roadmap de teste.', description: 'Descrição do roadmap de teste.', area: 'frontend', level: 'beginner', sections: [{ id: 'base', title: 'Base', steps: [{ id: 'html', title: 'HTML', importance: 'essential', children: [{ id: 'tags', title: 'Tags', description: 'Tags comuns', importance: 'recommended' }] }] }] };

test('the address shown while typing follows the backend slug rule', () => {
  assert.equal(roadmapSlug('Front-end: do zero ao projeto!'), 'front-end-do-zero-ao-projeto');
  assert.equal(roadmapSlug('Programação & Lógica'), 'programacao-logica');
  assert.equal(roadmapSlug('  --  '), '');
  assert.ok(roadmapSlug('a'.repeat(120)).length <= 80);
});

test('the proposal trims text, sends one area and prefers an uploaded image', () => {
  const create = toProposal(form);
  assert.equal(create.name, 'Front-end para começar');
  assert.deepEqual(create.areas, ['frontend']);
  assert.equal('slug' in create, false);
  assert.equal('baseSha' in create, false);
  assert.equal(create.roadmap.level, 'beginner');
  const edit = toProposal({ ...form, imageUrl: ' https://example.org/a.png ' }, { slug: 'front-end', baseSha: 'abc' });
  assert.equal(edit.slug, 'front-end');
  assert.equal(edit.baseSha, 'abc');
  assert.equal(edit.imageUrl, 'https://example.org/a.png');
  const uploaded = toProposal({ ...form, imageUrl: 'https://example.org/a.png' }, { imageUploadId: 'up.png' });
  assert.equal(uploaded.imageUploadId, 'up.png');
  assert.equal('imageUrl' in uploaded, false);
  assert.deepEqual(toProposal({ ...form, area: '' }).areas, []);
});

test('the source file fills the form', () => {
  const filled = formFromSource({ name: 'Dados', summary: 'Resumo longo o bastante.', description: 'Descrição longa o bastante.', areas: ['dados'], technologies: ['python'], languages: ['pt-BR'], roadmap: { level: 'advanced', sections: form.sections } });
  assert.equal(filled.area, 'dados');
  assert.equal(filled.level, 'advanced');
  assert.equal(filled.imageUrl, '');
  assert.equal(filled.sections, form.sections);
});

test('drafts are stored per roadmap and ignore damaged or foreign data', () => {
  const store = memory();
  writeDraft(undefined, { form }, store);
  writeDraft('front-end', { baseSha: 'abc', form }, store);
  assert.equal(readDraft(undefined, store).form.name, form.name);
  assert.equal(readDraft('front-end', store).baseSha, 'abc');
  assert.equal(readDraft('outro', store), null);
  store.setItem(draftKey('quebrado'), '{not json');
  assert.equal(readDraft('quebrado', store), null);
  store.setItem(draftKey('estranho'), JSON.stringify({ form: { name: 3, sections: 'x' } }));
  assert.equal(readDraft('estranho', store), null);
  clearDraft('front-end', store);
  assert.equal(readDraft('front-end', store), null);
});

test('blocked storage never throws', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(readDraft(undefined, blocked), null);
  assert.doesNotThrow(() => writeDraft(undefined, { form }, blocked));
  assert.doesNotThrow(() => clearDraft(undefined, blocked));
  assert.equal(readDraft(undefined, undefined), null);
});

test('a stale edit is recognised by the backend message and the outline keeps the typed text', () => {
  assert.equal(isEditConflict('Este roadmap mudou desde que você abriu o editor. Abra o editor de novo.'), true);
  assert.equal(isEditConflict('Confira o nome.'), false);
  assert.equal(isEditConflict(undefined), false);
  const outline = outlineText(form);
  assert.ok(outline.includes('Base'));
  assert.ok(outline.includes('  - HTML'));
  assert.ok(outline.includes('      - Tags: Tags comuns'));
});
