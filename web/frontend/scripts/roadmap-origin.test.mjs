import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterByOrigin, originQueryValue, readOrigin, roadmapOrigin, roadmapOriginLabels } from '../src/roadmap-origin.ts';

const community = { slug: 'dados', roadmap: { level: 'beginner', sectionCount: 3, stepCount: 8 } };
const external = { slug: 'roadmap-sh' };

test('a roadmap with a step tree comes from the community, any other comes from an external source', () => {
  assert.equal(roadmapOrigin(community), 'community');
  assert.equal(roadmapOrigin(external), 'external');
  assert.deepEqual(roadmapOriginLabels, { community: 'Comunidade do Guia', external: 'Fonte externa' });
});

test('reads the origin filter from the query string and ignores invalid values', () => {
  assert.equal(readOrigin('?origem=comunidade'), 'community');
  assert.equal(readOrigin('?ordem=hypes&origem=externa'), 'external');
  for (const search of ['', '?origem=', '?origem=todas', '?origem=Comunidade', '?origem=community']) assert.equal(readOrigin(search), 'all');
});

test('writes the same query values the filter reads', () => {
  for (const origin of ['community', 'external']) assert.equal(readOrigin('?origem=' + originQueryValue(origin)), origin);
  assert.equal(originQueryValue('all'), '');
});

test('filters by origin without changing the order', () => {
  const items = [external, community, { slug: 'odin' }];
  assert.deepEqual(filterByOrigin(items, 'all'), items);
  assert.deepEqual(filterByOrigin(items, 'community').map(item => item.slug), ['dados']);
  assert.deepEqual(filterByOrigin(items, 'external').map(item => item.slug), ['roadmap-sh', 'odin']);
  assert.deepEqual(filterByOrigin([], 'community'), []);
});
