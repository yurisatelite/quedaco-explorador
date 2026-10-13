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
test('public diary note captures calendar date, timeline and immutable location even after renumbering', async () => {
  const f = await uiFixture(); await f.api.setCurrentLocation('sceneA:2:2');
  const result = await f.api.createNote({title:'Chegada à ponte',description:'Nossa primeira visita.'});
  const page = f.documents.get(result.uuid), record = page.flags['opath-calendar'].record;
  assert.equal(record.visibility,'public'); assert.equal(record.absoluteDay,83763); assert.equal(record.timelineId,'main');
  assert.equal(result.location.hexId,'sceneA:2:2'); assert.match(result.location.dateLabel,/Primeiro Ciclo/);
  await f.api.setActive('sceneA:0:0',false); await f.api.renumberAreas('sceneA');
  assert.equal(f.api.listNotes('sceneA:2:2')[0].title,'Chegada à ponte');
  assert.equal(f.api.getCurrentLocation().id,'sceneA:2:2');
  assert.equal(page.flags[ID].location.hexId,'sceneA:2:2');
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
  f.game.modules.get('opath-calendar').active = false;
  await assert.rejects(() => f.api.createNote({title:'x',description:'y'}),/Calendário/);
});
test('shared mirrors inherit location without duplicating sources; inaccessible notes stay out', async () => {
  const f = await uiFixture(); await f.api.setCurrentLocation('sceneA:2:2');
  const note = await f.api.createNote({title:'Pública',description:'texto'}), page = f.documents.get(note.uuid);
  const mirror = {id:'mirror',uuid:'JournalEntry.mirror',name:page.name,pages:[],flags:{'opath-calendar':{sourceUuid:page.uuid,record:page.flags['opath-calendar'].record}},testUserPermission:() => true,
    async setFlag(module,key,value) {this.flags[module] ??= {}; this.flags[module][key] = structuredClone(value);}};
  f.game.journal.set(mirror.id,mirror); await f.api.mirrorLocation(page);
  assert.equal(mirror.flags[ID].location.hexId,'sceneA:2:2');
  assert.equal(f.api.listNotes('sceneA:2:2').length,1);
  page.testUserPermission = () => false;
  assert.equal(f.api.listNotes('sceneA:2:2')[0].uuid,mirror.uuid);
  mirror.testUserPermission = () => false;
  assert.equal(f.api.listNotes('sceneA:2:2').length,0);
});
test('catalog bridge reads the installed Quedaco regions and roles and allows custom tags', async () => {
  const f = await uiFixture();
  f.game.modules = new Collection([['quedaco',{active:true}]]);
  const bridge = createCampaignBridge(f.game,f.api,{importModule:async path => path.includes('book-world') ? {REGIONS:[{id:'mirmir',name:'Deserto de Mirmir',summary:'Não copiar esta prosa'}],PLACES:[]} : {NPC_ROLES:{merchant:'Mercador'}}});
  await bridge.initialize();
  assert.equal(bridge.getCatalog().regions[0].id,'mirmir');
  assert.equal(bridge.getCatalog().regions[0].summary,undefined);
  assert.equal(bridge.getCatalog().tags[0].label,'Mercador');
  await bridge.createTag(' Ruína '); await bridge.createTag('ruína');
  assert.equal(bridge.getCatalog().tags.length,2);
  f.game.user.isGM = false; await assert.rejects(() => bridge.createTag('Nova'),/Mestra/);
});
