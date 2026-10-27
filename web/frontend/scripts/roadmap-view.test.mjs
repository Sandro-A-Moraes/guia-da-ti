import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRoadmapStale, groupSteps, stepAncestors, stepIds } from '../src/roadmap-view.ts';

test('warns only when the last update is more than 12 months old', () => {
  const now = new Date('2026-10-27T12:00:00Z');
  assert.equal(isRoadmapStale('2025-10-28', now), false);
  assert.equal(isRoadmapStale('2025-10-27', now), false);
  assert.equal(isRoadmapStale('2025-10-26', now), true);
  assert.equal(isRoadmapStale('2026-10-01', now), false);
});

test('groups neighbouring steps that share a choice and leaves the others alone', () => {
  const steps = [{ id: 'a' }, { id: 'b', choice: 'framework' }, { id: 'c', choice: 'framework' }, { id: 'd' }, { id: 'e', choice: 'banco' }, { id: 'f', choice: 'banco' }];
  const groups = groupSteps(steps);
  assert.deepEqual(groups.map(group => group.steps.map(step => step.id)), [['a'], ['b', 'c'], ['d'], ['e', 'f']]);
  assert.deepEqual(groups.map(group => group.choice), [undefined, 'framework', undefined, 'banco']);
});

test('finds the steps to open before showing a step or substep', () => {
  const sections = [{ steps: [{ id: 'a' }, { id: 'b', children: [{ id: 'b1' }, { id: 'b2' }] }] }, { steps: [{ id: 'c', children: [{ id: 'c1' }] }] }];
  assert.deepEqual(stepAncestors(sections, 'a'), []);
  assert.deepEqual(stepAncestors(sections, 'b2'), ['b']);
  assert.deepEqual(stepAncestors(sections, 'c1'), ['c']);
  assert.equal(stepAncestors(sections, 'x'), null);
  assert.deepEqual(stepIds(sections), ['b', 'c']);
});
