import test from 'node:test';
import assert from 'node:assert/strict';
import {hexId, parseHexId, validateHex, validateConfig, enumerateHexes, summary, legacyRecords, readHex, ID} from '../src/core.mjs';
import {mockScene} from '../tools/fixture.mjs';

test('IDs bind scene and signed offsets and ignore editable names', () => {
  const id = hexId('sceneA', {i: -2, j: 4});
  assert.equal(id, 'sceneA:-2:4');
  assert.deepEqual(parseHexId(id), {sceneId: 'sceneA', i: -2, j: 4});
  assert.throws(() => parseHexId('sceneA:NaN:3'));
  assert.throws(() => parseHexId('sceneA:9007199254740993:0'));
});
test('hex validation retains only defined data, normalizes tags, rejects unsafe links', () => {
  const data = validateHex({name: ' Ruína ', tags: 'rota, rota, floresta', i: 77, arbitrary: 1}, {i: 1, j: 2});
  assert.equal(data.name, 'Ruína'); assert.equal(data.i, 1);
  assert.deepEqual(data.tags, ['rota', 'floresta']); assert.equal(data.arbitrary, undefined);
  assert.throws(() => validateHex({state: 'revealed'}, {i: 1, j: 2}));
  assert.throws(() => validateHex({sceneUuid: 'javascript:alert(1)'}, {i: 1, j: 2}));
});
test('coverage configuration rejects invalid states, colors and opacity', () => {
  assert.equal(validateConfig().enabled, false);
  assert.throws(() => validateConfig({gmOpacity: 2}));
  assert.throws(() => validateConfig({defaultState: 'constructor'}));
  assert.throws(() => validateConfig({color: 'red'}));
});
test('enumeration excludes padding and refuses square or excessive grids', () => {
  const scene = mockScene(); const cells = enumerateHexes(scene);
  assert.equal(cells.length, 72); assert.equal(new Set(cells.map(c => c.id)).size, 72);
  assert.equal(cells[0].vertices.length, 6);
  scene.grid.isHexagonal = false; assert.throws(() => enumerateHexes(scene), /hexagonal/);
  scene.grid.isHexagonal = true; scene.grid.getOffsetRange = () => [0, 0, 200, 200];
  assert.throws(() => enumerateHexes(scene), /limite/);
});
test('player API views hide metadata until fully explored and are detached copies', () => {
  const scene = mockScene(), offset = {i: 1, j: 1};
  scene.flags[ID] = {hexes: {'1_1': {state: 'hidden', name: 'Ruína secreta', tags: ['rota']}}};
  assert.equal(readHex(scene, offset).name, '');
  assert.equal(readHex(scene, offset, {isGM: true}).name, 'Ruína secreta');
  scene.flags[ID].hexes['1_1'].state = 'explored';
  const hex = readHex(scene, offset); hex.tags.push('mutação');
  assert.deepEqual(scene.flags[ID].hexes['1_1'].tags, ['rota']);
});
test('legacy parser handles the three states and skips malformed coordinates', () => {
  const records = legacyRecords({a: {offset: {i: 1, j: 1}, reveal: true}, b: {offset: {i: 2, j: 2}, reveal: 'partial'}, c: {offset: {i: 3, j: 3}, reveal: false}, d: {offset: {i: '4', j: 4}, reveal: true}});
  assert.deepEqual(summary(records), {total: 3, explored: 1, partial: 1, hidden: 1});
  assert.throws(() => legacyRecords(null));
});
