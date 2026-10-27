import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCatalog, validateResource, checkRoadmapReferences, taxonomy } from '../scripts/validate.mjs';
const sample = { slug: 'exemplo', type: 'courses', name: 'Exemplo', summary: 'Um curso de demonstração.', description: 'Descrição de demonstração.', url: 'https://example.org/curso', areas: ['backend'], technologies: ['csharp'], languages: ['pt-BR'], updatedAt: '2026-01-01' };

test('images and discussion links survive catalog validation without unsafe URLs or pending upload IDs', () => {
  assert.doesNotThrow(() => validateResource({...sample,imageUrl:'https://raw.githubusercontent.com/example/catalog/main/assets/images/cover.png',discussionNumber:7},'courses/exemplo.json'));
  for (const change of [{imageUrl:'http://example.org/image.png'},{imageUrl:'https://127.0.0.1/image.png'},{imageUrl:'https://person:secret@example.org/image.png'},{imageUrl:'https://host.internal/image.png'},{imageUploadId:'pending.png'},{discussionNumber:0},{discussionNumber:1.5}]) assert.throws(() => validateResource({...sample,...change},'courses/exemplo.json'));
});

test('university ownership is restricted to public/private and universities', () => {
  for (const universityType of ['public', 'private']) {
    assert.doesNotThrow(() => validateResource({...sample, type:'universities', universityType}, 'universities/exemplo.json'));
    assert.throws(() => validateResource({...sample, universityType}, 'courses/exemplo.json'));
  }
  for (const universityType of ['', 'unknown', null]) assert.throws(() => validateResource({...sample, type:'universities', universityType}, 'universities/exemplo.json'));
});
test('catálogo de demonstração válido', async () => assert.ok((await buildCatalog()).resources.length > 0));
test('rejeita campos desconhecidos, taxonomia e URLs inseguras', () => {
  for (const change of [{ name: '' }, { script: 'x' }, { areas: ['Front End'] }, { url: 'javascript:alert(1)' }, { url: 'https://127.0.0.1/a' }, { url: 'https://user:pass@example.org' }, { updatedAt: '2099-01-01' }]) {
    assert.throws(() => validateResource({ ...sample, ...change }, 'courses/exemplo.json'));
  }
});
test('rejeita caminho divergente e URL duplicada com fragmento', () => {
  assert.throws(() => validateResource(sample, 'courses/outro.json'));
  const seen = new Set();
  validateResource(sample, 'courses/exemplo.json', seen);
  assert.throws(() => validateResource({ ...sample, url: sample.url + '#a' }, 'courses/exemplo.json', seen));
});

test("accepts all supported resource types and rejects unknown types", () => {
  for (const type of taxonomy.types) {
    assert.doesNotThrow(() => validateResource({ ...sample, type }, `${type}/exemplo.json`));
  }
  assert.throws(() => validateResource({ ...sample, type: "unknown" }, "unknown/exemplo.json"));
});

test("accepts ISO country tags and rejects malformed country tags", () => {
  assert.doesNotThrow(() => validateResource({ ...sample, countries: ["US", "CA"] }, "courses/exemplo.json"));
  for (const countries of [["us"], ["USA"], ["U1"], ["US", "US"], Array(21).fill("US")]) {
    assert.throws(() => validateResource({ ...sample, countries }, "courses/exemplo.json"));
  }
});

test('validates community location scopes and official UFs', () => {
 const community={...sample,type:'communities'};
 for(const communityLocation of [{scope:'regional',states:['SP','RJ']},{scope:'national'},{scope:'international'}]) assert.doesNotThrow(()=>validateResource({...community,communityLocation},'communities/exemplo.json'));
 for(const communityLocation of [{scope:'regional',states:[]},{scope:'regional',states:['XX']},{scope:'regional',states:['SP','SP']},{scope:'national',states:['SP']},{scope:'international',states:[]},{scope:'world'},{scope:'regional',states:['SP'],unknown:true}]) assert.throws(()=>validateResource({...community,communityLocation},'communities/exemplo.json'));
 assert.throws(()=>validateResource({...sample,communityLocation:{scope:'national'}},'courses/exemplo.json'));
 assert.doesNotThrow(()=>validateResource(community,'communities/exemplo.json'));
});

test('validates community platforms and meeting modalities',()=>{
 const community={...sample,type:'communities'};
 for(const communityModality of ['online','in-person','hybrid']) assert.doesNotThrow(()=>validateResource({...community,communityModality,communityPlatforms:['discord','telegram']},'communities/exemplo.json'));
 for(const extra of [{communityPlatforms:[]},{communityPlatforms:['unknown']},{communityPlatforms:['discord','discord']},{communityModality:'unknown'}]) assert.throws(()=>validateResource({...community,...extra},'communities/exemplo.json'));
 assert.throws(()=>validateResource({...sample,communityPlatforms:['discord']},'courses/exemplo.json'));
 assert.throws(()=>validateResource({...sample,communityModality:'online'},'courses/exemplo.json'));
});

test('validates creator content categories independently of technical areas', () => {
  for (const type of ['creators', 'youtube']) {
    const creator = {...sample, type, creatorCategories: ['career', 'humor', 'lifestyle']};
    assert.doesNotThrow(() => validateResource(creator, type + '/exemplo.json'));
    for (const creatorCategories of [[], ['unknown'], ['career', 'career'], [null]]) assert.throws(() => validateResource({...creator, creatorCategories}, type + '/exemplo.json'));
  }
  assert.throws(() => validateResource({...sample, creatorCategories: ['career']}, 'courses/exemplo.json'));
});

test('validates audience and one safe public link for each community platform',()=>{
 const community={...sample,type:'communities',communityPlatforms:['discord','website'],communityAudience:'general',communityLinks:[{platform:'discord',url:'https://discord.gg/example'},{platform:'website',url:'https://example.org/community'}]};
 for(const communityAudience of ['general','male','female','lgbt']) assert.doesNotThrow(()=>validateResource({...community,communityAudience},'communities/exemplo.json'));
 for(const changes of [{communityAudience:'unknown'},{communityPlatforms:['discord']},{communityLinks:[]},{communityLinks:[{platform:'discord',url:'https://example.org/one'},{platform:'discord',url:'https://example.org/two'}]},{communityLinks:[{platform:'discord',url:'https://127.0.0.1/test'},{platform:'website',url:'https://example.org'}]},{communityLinks:[{platform:'discord',url:'https://private.internal/test'},{platform:'website',url:'https://example.org'}]},{communityLinks:[{platform:'discord',url:'http://example.org'},{platform:'website',url:'https://example.org'}]}]) assert.throws(()=>validateResource({...community,...changes},'communities/exemplo.json'));
 assert.throws(()=>validateResource({...sample,communityAudience:'female'},'courses/exemplo.json'));
 assert.throws(()=>validateResource({...sample,communityLinks:community.communityLinks,communityPlatforms:community.communityPlatforms},'courses/exemplo.json'));
});

test('community member counts distinguish exact and more-than totals and reject invalid data',()=>{
 const r={...sample,type:'communities',communityMembers:{count:4000,moreThan:true,checkedAt:'2026-10-07'}};
 assert.doesNotThrow(()=>validateResource(r,'communities/exemplo.json'));
 for(const change of [{count:-1},{count:1.5},{count:2147483648},{moreThan:'yes'},{checkedAt:'2099-01-01'},{checkedAt:'invalid'},{checkedAt:'2026-02-30'}])assert.throws(()=>validateResource({...r,communityMembers:{...r.communityMembers,...change}},'communities/exemplo.json'));
 assert.throws(()=>validateResource({...sample,communityMembers:r.communityMembers},'courses/exemplo.json'));
 assert.doesNotThrow(()=>validateResource({...r,communityMembers:{count:0,checkedAt:'2026-10-07'}},'communities/exemplo.json'));
});

const { url: _url, ...base } = sample;
const step = (id, extra = {}) => ({ id, title: 'Etapa ' + id, importance: 'essential', ...extra });
const roadmap = () => ({
  level: 'beginner',
  sections: [
    { id: 'base', title: 'Base', steps: [step('logica', { description: 'Pensar em passos.', resources: [{ type: 'courses', slug: 'exemplo' }], links: [{ title: 'Guia externo', url: 'https://example.org/guia' }] }), step('dados', { children: [step('tabelas', { importance: 'optional' })] })] },
    { id: 'pratica', title: 'Prática', steps: [step('python', { choice: 'linguagem' }), step('csharp', { choice: 'linguagem', importance: 'recommended' }), step('projeto')] }
  ]
});
const community = (change = {}) => ({ ...base, type: 'roadmaps', slug: 'exemplo', roadmap: roadmap(), ...change });
const file = 'roadmaps/exemplo.json';
const many = count => ({ ...roadmap(), sections: [{ id: 'unico', title: 'Único', steps: Array.from({ length: count }, (_, i) => step('e' + i)) }, { id: 'outro', title: 'Outro', steps: [step('fim')] }] });

test('community roadmaps are valid without url', () => {
  assert.doesNotThrow(() => validateResource(community(), file));
  assert.throws(() => validateResource(community({ url: 'https://example.org/roadmap' }), file));
});

test('resources other than community roadmaps still require url and the roadmaps type', () => {
  assert.throws(() => validateResource({ ...base }, 'courses/exemplo.json'));
  assert.throws(() => validateResource({ ...base, type: 'roadmaps' }, file));
  assert.throws(() => validateResource(community({ type: 'courses' }), 'courses/exemplo.json'));
  assert.doesNotThrow(() => validateResource({ ...base, type: 'roadmaps', url: 'https://example.org/externo' }, file));
});

test('roadmap size limits count steps and substeps', () => {
  assert.doesNotThrow(() => validateResource(community({ roadmap: many(4) }), file));
  assert.throws(() => validateResource(community({ roadmap: many(3) }), file), /5 a 150/);
  assert.doesNotThrow(() => validateResource(community({ roadmap: many(149) }), file));
  assert.throws(() => validateResource(community({ roadmap: many(150) }), file), /5 a 150/);
  const one = roadmap(); one.sections = one.sections.slice(0, 1);
  assert.throws(() => validateResource(community({ roadmap: one }), file));
  const crowded = roadmap(); crowded.sections[0].steps[1].children = Array.from({ length: 13 }, (_, i) => step('c' + i));
  assert.throws(() => validateResource(community({ roadmap: crowded }), file));
});

test('roadmap ids are unique across sections, steps and substeps', () => {
  for (const mutate of [r => { r.sections[1].id = 'base'; }, r => { r.sections[1].steps[0].id = 'logica'; }, r => { r.sections[0].steps[1].children[0].id = 'dados'; }, r => { r.sections[0].steps[0].id = 'Com Espaço'; }]) {
    const r = roadmap(); mutate(r);
    assert.throws(() => validateResource(community({ roadmap: r }), file));
  }
});

test('roadmap alternatives need two neighbouring steps in the same section', () => {
  const lone = roadmap(); delete lone.sections[1].steps[1].choice;
  assert.throws(() => validateResource(community({ roadmap: lone }), file), /escolha/);
  const apart = roadmap(); apart.sections[1].steps[2].choice = 'linguagem';
  assert.doesNotThrow(() => validateResource(community({ roadmap: apart }), file));
  const split = roadmap(); split.sections[1].steps.splice(1, 0, step('meio')); split.sections[1].steps[0].choice = 'linguagem';
  assert.throws(() => validateResource(community({ roadmap: split }), file));
  const crossSection = roadmap(); crossSection.sections[0].steps[0].choice = 'linguagem';
  assert.throws(() => validateResource(community({ roadmap: crossSection }), file));
});

test('roadmap rejects unknown fields, invalid importance and unsafe external links', () => {
  for (const mutate of [r => { r.sections[0].steps[0].importance = 'mandatory'; }, r => { r.sections[0].steps[0].extra = 1; }, r => { r.level = 'expert'; }, r => { r.extra = true; },
    r => { r.sections[0].steps[0].links[0].url = 'http://example.org/a'; }, r => { r.sections[0].steps[0].links[0].url = 'https://127.0.0.1/a'; },
    r => { r.sections[0].steps[0].links[0].url = 'https://user:pass@example.org/a'; }, r => { r.sections[0].steps[0].links[0].url = 'https://host.internal/a'; },
    r => { r.sections[0].steps[1].children[0].links = [{ title: 'Ruim', url: 'https://localhost/a' }]; },
    r => { r.sections[0].steps[0].links = Array.from({ length: 4 }, (_, i) => ({ title: 'Link ' + i, url: 'https://example.org/' + i })); },
    r => { r.sections[0].steps[0].resources = Array.from({ length: 9 }, (_, i) => ({ type: 'courses', slug: 'r' + i })); },
    r => { r.sections[0].steps[0].description = 'x'.repeat(401); }]) {
    const r = roadmap(); mutate(r);
    assert.throws(() => validateResource(community({ roadmap: r }), file));
  }
  const same = roadmap(); same.sections[1].steps[0].links = same.sections[0].steps[0].links;
  assert.doesNotThrow(() => validateResource(community({ roadmap: same }), file));
});

test('roadmap resource references must exist in the catalog', () => {
  const course = { ...sample, type: 'courses', slug: 'exemplo' };
  assert.doesNotThrow(() => checkRoadmapReferences([course, community()]));
  assert.throws(() => checkRoadmapReferences([community()]), /courses\/exemplo/);
  const nested = roadmap(); nested.sections[0].steps[1].children[0].resources = [{ type: 'books', slug: 'ausente' }];
  assert.throws(() => checkRoadmapReferences([course, community({ roadmap: nested })]), /books\/ausente/);
});

test('catalog build checks references across files and limits file size by folder', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'catalog-'));
  try {
    await mkdir(join(dir, 'courses')); await mkdir(join(dir, 'roadmaps'));
    await writeFile(join(dir, 'courses/exemplo.json'), JSON.stringify(sample));
    await writeFile(join(dir, 'roadmaps/exemplo.json'), JSON.stringify(community()) + ' '.repeat(30000));
    assert.equal((await buildCatalog(dir)).resources.length, 2);
    await writeFile(join(dir, 'roadmaps/exemplo.json'), JSON.stringify(community()) + ' '.repeat(200001));
    await assert.rejects(buildCatalog(dir), /Arquivo inválido/);
    await writeFile(join(dir, 'roadmaps/exemplo.json'), JSON.stringify(community()));
    await writeFile(join(dir, 'courses/exemplo.json'), JSON.stringify(sample) + ' '.repeat(20001));
    await assert.rejects(buildCatalog(dir), /Arquivo inválido/);
    await rm(join(dir, 'courses/exemplo.json'));
    await writeFile(join(dir, 'courses/outro.json'), JSON.stringify({ ...sample, slug: 'outro', url: 'https://example.org/outro' }));
    await assert.rejects(buildCatalog(dir), /courses\/exemplo/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
