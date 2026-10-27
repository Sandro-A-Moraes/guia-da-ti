import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addSection, addStep, addSubstep, collectIds, countNodes, groupWithNext, moveNode, newId, removeNode, renameSection, treeProblems, ungroup, updateNode } from '../src/roadmap-tree.ts';

const step = (id, extra = {}) => ({ id, title: `Etapa ${id}`, importance: 'recommended', ...extra });
const section = (id, steps) => ({ id, title: `Bloco ${id}`, steps });
const ids = steps => steps.map(item => item.id);
const choices = steps => steps.map(item => item.choice);
const base = () => [
  section('a', [step('a1'), step('a2'), step('a3')]),
  section('b', [step('b1'), step('b2', { children: [step('b2x'), step('b2y')] })]),
];
const frozen = value => JSON.parse(JSON.stringify(value));

test('builds unique kebab-case ids without accents, up to 40 characters', () => {
  assert.equal(newId('Lógica de Programação!', new Set()), 'logica-de-programacao');
  assert.equal(newId('   ', new Set()), 'etapa');
  assert.equal(newId('Git', new Set(['git'])), 'git-2');
  assert.equal(newId('Git', new Set(['git', 'git-2'])), 'git-3');
  const long = newId('a'.repeat(60), new Set());
  assert.equal(long.length, 40);
  const next = newId('a'.repeat(60), new Set([long]));
  assert.ok(next.length <= 40 && next.endsWith('-2') && next !== long);
  assert.match(newId('Título — com símbolos & espaços', new Set()), /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test('new nodes get ids that are unique across the whole roadmap and stay stable on edits', () => {
  let tree = addSection(base(), 'A1');
  assert.equal(tree[2].id, 'a1-2');
  tree = addStep(tree, 'a', 'B1');
  tree = addSubstep(tree, 'a1', 'B2X');
  const all = [...collectIds(tree)];
  assert.equal(all.length, new Set(all).size);
  const edited = updateNode(updateNode(tree, 'a1', { title: 'Outro título' }), 'b2x', { title: 'Mais um' });
  assert.deepEqual([...collectIds(edited)].sort(), all.sort());
  assert.deepEqual(collectIds(renameSection(tree, 'a', 'Novo nome')), collectIds(tree));
  assert.equal(addStep(tree, 'a', 'Novo').at(0).steps.at(-1).importance, 'recommended');
});

test('counts steps and substeps and limits substeps to 12 per step', () => {
  assert.equal(countNodes(base()), 7);
  let tree = base();
  for (let i = 0; i < 12; i++) tree = addSubstep(tree, 'a1', `Sub ${i}`);
  assert.equal(tree[0].steps[0].children.length, 12);
  assert.equal(addSubstep(tree, 'a1', 'Mais uma'), tree);
  assert.equal(addSubstep(tree, 'inexistente', 'x'), tree);
  assert.equal(addSubstep(tree, 'b2x', 'neto'), tree);
});

test('updates a node by id and removes empty optional fields', () => {
  const tree = updateNode(base(), 'a1', { description: 'Texto', importance: 'essential', resources: [{ type: 'books', slug: 'livro' }], links: [{ title: 'Site', url: 'https://example.org' }] });
  assert.deepEqual(tree[0].steps[0], { id: 'a1', title: 'Etapa a1', importance: 'essential', description: 'Texto', resources: [{ type: 'books', slug: 'livro' }], links: [{ title: 'Site', url: 'https://example.org' }] });
  const cleaned = updateNode(tree, 'a1', { description: '   ', resources: [], links: undefined });
  assert.deepEqual(Object.keys(cleaned[0].steps[0]).sort(), ['id', 'importance', 'title']);
  const kept = updateNode(tree, 'a1', { title: 'Só o título' });
  assert.deepEqual(kept[0].steps[0].links, tree[0].steps[0].links, 'omitted patch keys keep the current value');
  assert.deepEqual(updateNode(base(), 'b2y', { title: 'Novo' })[1].steps[1].children[1].title, 'Novo');
  assert.equal(updateNode(base(), 'nao-existe', { title: 'x' }).length, 2);
  const tree2 = base();
  assert.equal(updateNode(tree2, 'nao-existe', { title: 'x' }), tree2);
});

test('removes sections, steps and substeps; removing the last substep drops the children key', () => {
  assert.deepEqual(removeNode(base(), 'a').map(item => item.id), ['b']);
  assert.deepEqual(ids(removeNode(base(), 'a2')[0].steps), ['a1', 'a3']);
  const withoutChild = removeNode(removeNode(base(), 'b2x'), 'b2y');
  assert.ok(!('children' in withoutChild[1].steps[1]));
  assert.equal(countNodes(removeNode(base(), 'b2')), 4);
  const tree = base();
  assert.equal(removeNode(tree, 'nao-existe'), tree);
});

test('moves sections, steps and substeps inside their own list and stops at the edges', () => {
  assert.deepEqual(moveNode(base(), 'b', -1).map(item => item.id), ['b', 'a']);
  assert.deepEqual(ids(moveNode(base(), 'a1', 1)[0].steps), ['a2', 'a1', 'a3']);
  assert.deepEqual(ids(moveNode(base(), 'a3', -1)[0].steps), ['a1', 'a3', 'a2']);
  assert.deepEqual(moveNode(base(), 'b2y', -1)[1].steps[1].children.map(item => item.id), ['b2y', 'b2x']);
  const tree = base();
  assert.equal(moveNode(tree, 'a1', -1), tree);
  assert.equal(moveNode(tree, 'a3', 1), tree);
  assert.equal(moveNode(tree, 'a', -1), tree);
  assert.equal(moveNode(tree, 'b2x', -1), tree);
  assert.equal(moveNode(tree, 'nao-existe', 1), tree);
});

test('groups a step with the next one and ungroups it, dissolving groups of one', () => {
  let tree = groupWithNext(base(), 'a1');
  assert.equal(tree[0].steps[0].choice, tree[0].steps[1].choice);
  assert.ok(tree[0].steps[0].choice);
  assert.equal(tree[0].steps[2].choice, undefined);
  const name = tree[0].steps[0].choice;
  tree = groupWithNext(tree, 'a2');
  assert.deepEqual(choices(tree[0].steps), [name, name, name]);
  assert.equal(groupWithNext(tree, 'a2'), tree, 'already in the same group');
  assert.equal(groupWithNext(tree, 'a3'), tree, 'no next step');
  const alone = ungroup(groupWithNext(base(), 'a1'), 'a2');
  assert.deepEqual(choices(alone[0].steps), [undefined, undefined, undefined]);
  assert.ok(alone[0].steps.every(item => !('choice' in item)));
  const split = ungroup(groupWithNext(groupWithNext(base(), 'a1'), 'a2'), 'a2');
  assert.deepEqual(choices(split[0].steps), [undefined, undefined, undefined]);
  const keep = ungroup(groupWithNext(groupWithNext(base(), 'a1'), 'a2'), 'a3');
  assert.equal(keep[0].steps[0].choice, keep[0].steps[1].choice);
  assert.equal(keep[0].steps[2].choice, undefined);
  const plain = base();
  assert.equal(ungroup(plain, 'a1'), plain);
  assert.equal(groupWithNext(plain, 'b2x'), plain, 'substeps are not grouped');
});

test('merges two neighbouring groups into one', () => {
  let tree = base();
  tree = [section('c', [step('c1'), step('c2'), step('c3'), step('c4')])];
  tree = groupWithNext(tree, 'c1');
  tree = groupWithNext(tree, 'c3');
  assert.notEqual(tree[0].steps[0].choice, tree[0].steps[2].choice);
  tree = groupWithNext(tree, 'c2');
  assert.equal(new Set(choices(tree[0].steps)).size, 1);
});

test('removing a step leaves no group of one', () => {
  const grouped = groupWithNext(base(), 'a1');
  const left = removeNode(grouped, 'a2');
  assert.ok(left[0].steps.every(item => !('choice' in item)));
  const triple = groupWithNext(groupWithNext(base(), 'a1'), 'a2');
  const two = removeNode(triple, 'a3');
  assert.equal(two[0].steps[0].choice, two[0].steps[1].choice);
  assert.ok(two[0].steps[0].choice);
});

test('a step moved out of its group leaves it, and a loose step jumps over a whole group', () => {
  const tree = [section('c', [step('c1'), step('c2'), step('c3'), step('c4')])];
  const grouped = groupWithNext(tree, 'c1');
  const name = grouped[0].steps[0].choice;
  assert.deepEqual(choices(moveNode(grouped, 'c1', 1)[0].steps), [name, name, undefined, undefined], 'moving inside the group keeps it');
  const out = moveNode(grouped, 'c2', 1);
  assert.deepEqual(ids(out[0].steps), ['c1', 'c3', 'c2', 'c4']);
  assert.deepEqual(choices(out[0].steps), [undefined, undefined, undefined, undefined]);
  const jump = moveNode(grouped, 'c3', -1);
  assert.deepEqual(ids(jump[0].steps), ['c3', 'c1', 'c2', 'c4']);
  assert.deepEqual(choices(jump[0].steps), [undefined, name, name, undefined]);
  const over = moveNode(grouped, 'c1', -1);
  assert.equal(over, grouped);
});

test('reports what still blocks sending', () => {
  assert.deepEqual(treeProblems(base()), []);
  assert.deepEqual(treeProblems([]), ['Inclua pelo menos 2 blocos.', 'Inclua pelo menos 5 etapas ou subetapas. Hoje há 0.']);
  assert.ok(treeProblems([section('a', [step('a1')]), section('b', [])]).some(text => text.includes('precisa de pelo menos uma etapa')));
  assert.ok(treeProblems([section('a', [step('a1')]), section('b', [step('b1')])]).includes('Inclua pelo menos 5 etapas ou subetapas. Hoje há 2.'));
  const many = [section('a', Array.from({ length: 80 }, (_, i) => step(`a${i}`))), section('b', Array.from({ length: 71 }, (_, i) => step(`b${i}`)))];
  assert.ok(treeProblems(many).includes('Use no máximo 150 etapas e subetapas no total.'));
  assert.ok(treeProblems(Array.from({ length: 21 }, (_, i) => section(`s${i}`, [step(`s${i}x`)]))).includes('Use no máximo 20 blocos.'));
  const crowded = base();
  crowded[0].steps[0].children = Array.from({ length: 13 }, (_, i) => step(`c${i}`));
  assert.ok(treeProblems(crowded).some(text => text.includes('aceita até 12 subetapas')));
  const titles = base();
  titles[0].steps[0].title = 'x';
  titles[1].title = ' ';
  assert.ok(treeProblems(titles).includes('Dê a cada etapa e subetapa um título de 2 a 80 caracteres.'));
  assert.ok(treeProblems(titles).includes('Dê a cada bloco um título de 2 a 80 caracteres.'));
  const longText = base();
  longText[0].steps[0].description = 'a'.repeat(401);
  assert.ok(treeProblems(longText).includes('A explicação de cada etapa aceita até 400 caracteres.'));
});

test('flags choice groups that are alone or apart', () => {
  const alone = [section('a', [step('a1', { choice: 'x' }), step('a2'), step('a3')]), section('b', [step('b1'), step('b2')])];
  assert.ok(treeProblems(alone).includes('A escolha “x” precisa de pelo menos duas etapas vizinhas.'));
  const apart = [section('a', [step('a1', { choice: 'x' }), step('a2', { choice: 'x' }), step('a3'), step('a4', { choice: 'x' }), step('a5', { choice: 'x' })]), section('b', [step('b1')])];
  assert.ok(treeProblems(apart).includes('As etapas da escolha “x” precisam ficar juntas.'));
  const fine = [section('a', [step('a1', { choice: 'x' }), step('a2', { choice: 'x' }), step('a3')]), section('b', [step('b1'), step('b2', { choice: 'x' }), step('b3', { choice: 'x' })])];
  assert.deepEqual(treeProblems(fine), []);
});

test('never changes the tree it receives', () => {
  const tree = base();
  const copy = frozen(tree);
  const operations = [
    () => addSection(tree, 'Novo'), () => addStep(tree, 'a', 'Novo'), () => addSubstep(tree, 'a1', 'Novo'), () => renameSection(tree, 'a', 'Outro'),
    () => updateNode(tree, 'a1', { title: 'Outro', description: 'x' }), () => removeNode(tree, 'a'), () => removeNode(tree, 'b2x'),
    () => moveNode(tree, 'a1', 1), () => moveNode(tree, 'b', -1), () => groupWithNext(tree, 'a1'), () => ungroup(groupWithNext(tree, 'a1'), 'a1'),
  ];
  for (const run of operations) {
    run();
    assert.deepEqual(tree, copy);
  }
});
