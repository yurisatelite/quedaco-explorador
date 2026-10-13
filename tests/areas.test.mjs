import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../src/api.mjs';
import {ID} from '../src/core.mjs';
import {mockGame} from '../tools/fixture.mjs';

async function setup() {const game = mockGame(), api = createApi(game); await api.configureScene('sceneA',{enabled:true}); return {game,api,scene:game.scenes.get('sceneA')};}
test('disable and renumber preserve immutable IDs, metadata and persisted numbers through reload', async () => {
  const {api,scene,game} = await setup();
  await api.updateHex('sceneA:1:1',{name:'Ponte Azul',description:'Dados que não podem mudar',region:'Forah',regionId:'forah',terrain:'Floresta',tags:['rota'],journalUuid:'JournalEntry.diary'});
  const before = api.getHex('sceneA:1:1');
  await api.setActive(Array.from({length:9},(_,j) => `sceneA:0:${j}`),false);
  assert.equal(api.getSummary('sceneA').total,63);
  assert.equal(api.getHex(before.id).number,before.number);
  await api.renumberAreas('sceneA');
  const after = createApi(game).getHex(before.id);
  assert.equal(after.id,before.id); assert.equal(after.number,before.number-9);
  for (const key of ['name','description','region','regionId','terrain','journalUuid']) assert.equal(after[key],before[key]);
  assert.deepEqual(after.tags,before.tags);
  assert.equal(scene.flags[ID].hexes['1_1'].name,'Ponte Azul');
  assert.equal(api.exportScene('sceneA').hexes.length,72);
  await api.setActive('sceneA:0:0',true); assert.equal(api.getSummary('sceneA').total,64);
  assert.equal(new Set(api.listHexes('sceneA').map(h => h.number)).size,64);
});
test('batch edits preserve individual names and add tags without changing unrelated content', async () => {
  const {api} = await setup();
  await api.updateHex('sceneA:1:1',{name:'Ponte',description:'Anotação A',tags:['antiga']});
  await api.updateHex('sceneA:1:2',{name:'Torre',description:'Anotação B',state:'partial'});
  await api.updateHexes(['sceneA:1:1','sceneA:1:2'],{region:'Deserto de Mirmir',regionId:'mirmir',terrain:'Deserto',tags:['rota']},{tagMode:'add'});
  assert.equal(api.getHex('sceneA:1:1').name,'Ponte'); assert.equal(api.getHex('sceneA:1:2').name,'Torre');
  assert.equal(api.getHex('sceneA:1:2').description,'Anotação B'); assert.equal(api.getHex('sceneA:1:2').state,'partial');
  assert.deepEqual(api.getHex('sceneA:1:1').tags,['antiga','rota']);
  await api.updateHexes(['sceneA:1:1','sceneA:1:2'],{regionId:'',region:''});
  assert.equal(api.listHexes('sceneA',{unassigned:true}).length,72);
});
test('players cannot find disabled areas and migrations keep old records', async () => {
  const {api,game,scene} = await setup();
  await api.setActive('sceneA:0:0',false); game.user.isGM = false;
  assert.equal(api.listHexes('sceneA',{includeInactive:true}).length,71);
  assert.throws(() => api.selectHex('sceneA:0:0'),/desativada/);
  assert.throws(() => api.renumberAreas('sceneA'),/Mestra/);
  game.user.isGM = true;
  scene.flags[ID].schema = 1; delete scene.flags[ID].hexes['2_2'].number;
  scene.flags[ID].hexes['2_2'] = {name:'Local da versão antiga',state:'explored',region:'Nome legado'};
  await api.configureScene('sceneA',{});
  assert.equal(api.getHex('sceneA:2:2').name,'Local da versão antiga');
  assert.equal(api.getHex('sceneA:2:2').region,'Nome legado');
  assert.ok(api.getHex('sceneA:2:2').number);
});
test('box selection calls the controller once and rejects mixed scenes before changing selection', async () => {
  const game = mockGame(); let calls = 0, selected;
  const api = createApi(game,{selectMany:hexes => {calls++; selected = hexes;}});
  await api.configureScene('sceneA',{enabled:true});
  api.selectHexes(['sceneA:1:1','sceneA:1:2','sceneA:1:1']);
  assert.equal(calls,1); assert.equal(selected.length,2);
  assert.throws(() => api.selectHexes(['sceneA:1:1','sceneB:1:2']),/única cena/);
  assert.equal(calls,1);
});
