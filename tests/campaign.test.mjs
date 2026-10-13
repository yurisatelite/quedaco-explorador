import test from 'node:test';
import assert from 'node:assert/strict';
import {uiFixture, Collection} from '../tools/fixture.mjs';
import {ID} from '../src/core.mjs';
import {createCampaignBridge} from '../src/campaign.mjs';

function npc(id, role = 'merchant') {
  return {id,uuid:`Actor.${id}`,name:`NPC ${id}`,flags:{quedaco:{npc:{role,regionId:'forah'}}},testUserPermission:() => true,
    async update(data) {for (const [key,value] of Object.entries(data)) {const fields = key.split('.'); let target = this; for (const part of fields.slice(0,-1)) target = target[part] ??= {}; target[fields.at(-1)] = structuredClone(value);}}};
}
test('NPC exact presence differs from regional suggestions, survives renumbering and can be removed', async () => {
  const f = await uiFixture(), actor = npc('merchantA'); f.game.actors.set(actor.id,actor);
  assert.equal(f.api.getNPCs('sceneA:2:2').present.length,0);
  assert.equal(f.api.getNPCs('sceneA:2:2').regional.length,1);
  await f.api.assignNPC(actor.uuid,'sceneA:2:2');
  assert.equal(f.api.getNPCs('sceneA:2:2').present[0].name,'NPC merchantA');
  assert.equal(f.api.getNPCs('sceneA:2:2').regional.length,0);
  await f.api.setActive('sceneA:0:0',false); await f.api.renumberAreas('sceneA');
  assert.equal(actor.flags.quedaco.npc.explorerLocation.hexId,'sceneA:2:2');
  assert.equal(f.api.getNPCs('sceneA:2:2').present.length,1);
  await f.api.removeNPC(actor.uuid,'sceneA:2:2');
  assert.equal(f.api.getNPCs('sceneA:2:2').present.length,0);
});
test('players cannot assign NPCs and actor permissions protect names', async () => {
  const f = await uiFixture(), actor = npc('secret'); f.game.actors.set(actor.id,actor);
  await f.api.assignNPC(actor.uuid,'sceneA:2:2'); f.game.user.isGM = false;
  await assert.rejects(() => f.api.assignNPC(actor.uuid,'sceneA:2:3'),/Mestra/);
  actor.testUserPermission = () => false;
  assert.equal(f.api.getNPCs('sceneA:2:2').present.length,0);
  assert.equal(f.api.getNPCCandidates().length,0);
});
test('public diary note is delegated to the Calendar API with an immutable place reference', async () => {
  const f = await uiFixture(); await f.api.setCurrentLocation('sceneA:2:2');
  const result = await f.api.createNote({title:'Chegada à ponte',description:'Nossa primeira visita.'});
  const record = f.calls.saved[0];
  assert.equal(record.visibility,'public'); assert.equal(record.absoluteDay,83763); assert.equal(record.timelineId,'main');
  assert.equal(record.place.ref,'sceneA:2:2'); assert.equal(record.place.source,ID);
  assert.equal(result.location.hexId,'sceneA:2:2'); assert.match(result.location.dateLabel,/Primeiro Ciclo/);
  await f.api.setActive('sceneA:0:0',false); await f.api.renumberAreas('sceneA');
  assert.equal(f.api.listNotes('sceneA:2:2')[0].title,'Chegada à ponte');
  assert.equal(f.api.getCurrentLocation().id,'sceneA:2:2');
  assert.equal(await f.api.openNote(result.uuid),f.documents.get(result.uuid));
});
test('player note uses only the GM location and date; absent calendar or disabled area blocks creation', async () => {
  const f = await uiFixture(); await f.api.setCurrentLocation('sceneA:2:2'); f.game.user.isGM = false;
  await assert.rejects(() => f.api.setCurrentLocation('sceneA:2:3'),/Mestra/);
  await assert.rejects(() => f.api.createNote({hexId:'sceneA:2:3',title:'x',description:'y'}),/Mestra/);
  const note = await f.api.createNote({title:'Nota do jogador',description:'Texto',absoluteDay:0});
  assert.equal(note.location.absoluteDay,83763);
  f.game.user.isGM = true; await f.api.setActive('sceneA:2:2',false);
  assert.equal(f.api.getCurrentLocation(),null);
  await assert.rejects(() => f.api.createNote({title:'x',description:'y'}),/localização/);
  f.game.modules.get('quedaco-calendario').active = false;
  await assert.rejects(() => f.api.createNote({title:'x',description:'y'}),/Calendário/);
  assert.deepEqual(f.api.listNotes('sceneA:2:2'),[]);
});
test('the Explorer never reads or writes documents of other modules (only public APIs)', async () => {
  const f = await uiFixture(), {readFile} = await import('node:fs/promises');
  for (const file of ['campaign.mjs','main.mjs','app.mjs','api.mjs']) {
    const source = await readFile(new URL(`../src/${file}`,import.meta.url),'utf8');
    assert.doesNotMatch(source,/\/modules\/quedaco|importModule|opath-calendar|mirrorLocation/);
    assert.doesNotMatch(source,/setFlag\(|flags\??\.quedaco/);
  }
  await f.api.setCurrentLocation('sceneA:2:2'); await f.api.createNote({title:'a',description:'b'});
  assert.equal(f.documents.size,1);
});
test('catalog bridge reads the QUEDAÇO public API and allows custom tags', async () => {
  const f = await uiFixture();
  const bridge = createCampaignBridge(f.game,f.api);
  f.game.modules.get('quedaco').api.getExplorerCatalog = () => ({regions:[{id:'mirmir',name:'Deserto de Mirmir',summary:'Não copiar esta prosa'}],places:[],tags:[{id:'role:merchant',label:'Mercador'}]});
  await bridge.initialize();
  assert.equal(bridge.getCatalog().regions[0].id,'mirmir');
  assert.equal(bridge.getCatalog().regions[0].summary,undefined);
  assert.equal(bridge.getCatalog().tags[0].label,'Mercador');
  await bridge.createTag(' Ruína '); await bridge.createTag('ruína');
  assert.equal(bridge.getCatalog().tags.length,2);
  f.game.user.isGM = false; await assert.rejects(() => bridge.createTag('Nova'),/Mestra/);
});
test('QUEDAÇO main absent or incompatible: exploration stays, NPC features report unavailability', async () => {
  const f = await uiFixture(), actor = npc('merchantB'); f.game.actors.set(actor.id,actor);
  f.game.modules.get('quedaco').api = {family:'quedaco'};
  assert.deepEqual(f.api.getNPCs('sceneA:2:2'),{present:[],regional:[]});
  await assert.rejects(() => f.api.assignNPC(actor.uuid,'sceneA:2:2'),/QUEDAÇO/);
  assert.equal(f.api.getHex('sceneA:2:2').name,'Travessia da Aurora');
});

test('main.mjs publica o descritor do protocolo v1 e emite quedaco:register', async () => {
  const {readFile} = await import('node:fs/promises');
  const source = await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
  assert.match(source,/family: 'quedaco'/); assert.match(source,/contractVersion: 1/);
  assert.match(source,/Hooks\.callAll\('quedaco:register', descriptor\)/); assert.match(source,/module\.api = descriptor/);
  const manifest = JSON.parse(await readFile(new URL('../module.json',import.meta.url),'utf8'));
  assert.equal(manifest.title,'QUEDAÇO - Explorador'); assert.equal(manifest.id,'quedaco-explorador');
});
