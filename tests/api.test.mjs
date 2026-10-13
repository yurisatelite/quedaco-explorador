import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../src/api.mjs';
import {ID} from '../src/core.mjs';
import {mockGame, mockScene} from '../tools/fixture.mjs';

async function setup() {
  const game = mockGame(), scene = game.scenes.get('sceneA'), events = [];
  const api = createApi(game, {emit: (name, payload) => events.push({name, payload})});
  await api.configureScene(scene.id, {enabled: true});
  return {game, scene, api, events};
}
test('parallel edits preserve independent fields and emit updates after persistence', async () => {
  const {api, scene, events} = await setup();
  await Promise.all([api.updateHex('sceneA:1:1', {name: 'Ponte'}), api.updateHex('sceneA:1:1', {region: 'Norte'}), api.setState('sceneA:1:2', 'partial')]);
  assert.equal(api.getHex('sceneA:1:1').name, 'Ponte'); assert.equal(api.getHex('sceneA:1:1').region, 'Norte');
  assert.equal(scene.flags[ID].hexes['1_2'].state, 'partial');
  assert.equal(events.filter(e => e.name.endsWith('hexStateChanged')).length, 1);
});
test('players can read permitted scenes and cannot mutate or export via any write API', async () => {
  const {game, api} = await setup(); game.user.isGM = false;
  assert.equal(api.listHexes('sceneA').length, 72);
  await assert.rejects(() => api.updateHex('sceneA:1:1', {name: 'x'}), /Mestra/);
  assert.throws(() => api.configureScene('sceneA', {enabled: false}), /Mestra/);
  assert.throws(() => api.setStates(['sceneA:1:1'], 'explored'), /Mestra/);
  assert.throws(() => api.importWorldExplorer('sceneA'), /Mestra/);
  assert.throws(() => api.exportScene('sceneA'), /Mestra/);
});
test('inaccessible scenes and out of bounds coordinates are rejected', async () => {
  const {api, game, scene} = await setup();
  assert.throws(() => api.getHex('sceneA:100:100'), /limites/);
  game.user.isGM = false; scene.testUserPermission = () => false;
  assert.throws(() => api.listHexes('sceneA'), /indisponível/);
});
test('paint batch deduplicates IDs, persists once, and validates before writing', async () => {
  const {api, scene, game} = await setup();
  let writes = 0; const update = scene.update.bind(scene); scene.update = data => {writes++; return update(data);};
  const result = await api.setStates(['sceneA:1:1', 'sceneA:1:2', 'sceneA:1:1'], 'explored');
  assert.equal(result.length, 2); assert.equal(writes, 1);
  await assert.rejects(() => api.setStates(['sceneA:1:3', 'sceneA:999:999'], 'partial'));
  assert.equal(writes, 1);
  game.scenes.set('sceneB', mockScene('sceneB'));
  assert.throws(() => api.setStates(['sceneA:1:1', 'sceneB:1:1'], 'hidden'), /única cena/);
});
test('grid changes block IDs, but the Mestra can disable the coverage', async () => {
  const {api, scene} = await setup(); scene.grid.size++;
  assert.throws(() => api.listHexes('sceneA'), /mudaram/);
  await assert.rejects(() => api.updateHex('sceneA:1:1', {name: 'x'}), /mudaram/);
  await api.configureScene('sceneA', {enabled: false});
  assert.equal(scene.flags[ID].config.enabled, false);
});
test('import preserves original flags and new metadata and can be rerun safely', async () => {
  const {api, scene} = await setup();
  const old = {a: {offset: {i: 1, j: 1}, reveal: true}, b: {offset: {i: 1, j: 2}, reveal: 'partial'}, c: {offset: {i: 999, j: 999}, reveal: true}};
  scene.flags['world-explorer'] = {gridData: structuredClone(old)};
  await api.updateHex('sceneA:1:1', {name: 'Meu hex', state: 'hidden'});
  assert.deepEqual(await api.importWorldExplorer('sceneA'), {imported: 1, skipped: 2});
  assert.equal(api.getHex('sceneA:1:1').name, 'Meu hex'); assert.equal(api.getHex('sceneA:1:1').state, 'hidden');
  assert.equal(api.getHex('sceneA:1:2').state, 'partial');
  assert.equal((await api.importWorldExplorer('sceneA')).imported, 0);
  assert.deepEqual(scene.flags['world-explorer'].gridData, old);
});
test('write queue recovers after invalid input and read lists redact hidden metadata', async () => {
  const {api, game} = await setup();
  await assert.rejects(() => api.setState('sceneA:1:1', 'invalid'));
  await api.updateHex('sceneA:1:1', {name: 'Segredo', region: 'Sala secreta'});
  game.user.isGM = false;
  assert.equal(api.listHexes('sceneA', {search: 'Segredo'}).length, 0);
  assert.equal(api.selectHex('sceneA:1:1').name, '');
});
