import {ID, hexId} from '../src/core.mjs';
import {createApi} from '../src/api.mjs';
import {createExplorerApp} from '../src/app.mjs';
import {createCampaignBridge} from '../src/campaign.mjs';
export class Collection extends Map { [Symbol.iterator]() {return this.values();} }

export function mockScene(id = 'sceneA') {
  const radius = 38, sizeX = Math.sqrt(3) * radius;
  const grid = {isHexagonal: true, type: 2, size: sizeX,
    getCenterPoint: ({i, j}) => ({x: 40 + (j + (i % 2) / 2) * sizeX, y: 40 + i * radius * 1.5}),
    getOffsetRange: () => [0, 0, 8, 9],
    getVertices: offset => {
      const center = grid.getCenterPoint(offset);
      return Array.from({length: 6}, (_, n) => ({x: center.x + radius * Math.cos((60 * n - 30) * Math.PI / 180), y: center.y + radius * Math.sin((60 * n - 30) * Math.PI / 180)}));
    }
  };
  return {id, name: 'Opath · Fronteiras da Queda', grid, flags: {}, background: {src: ''}, dimensions: {sceneRect: {x: 0, y: 0, width: 620, height: 480}},
    testUserPermission: () => true,
    async update(data) {
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split('.'); let target = this;
        for (const part of parts.slice(0, -1)) target = target[part] ??= {};
        target[parts.at(-1)] = structuredClone(value);
      }
      return this;
    }};
}
export function mockGame() {
  const scene = mockScene();
  const values = new Map();
  const user = {id: 'gm', name: 'Mestra', isGM: true};
  return {user, scenes: new Collection([[scene.id, scene]]), actors: new Collection(), journal: new Collection(), users: new Collection([['gm', user]]), modules: new Collection(),
    settings: {get: (module,key) => values.get(`${module}.${key}`) ?? (key === 'tagCatalog' ? [] : {}), set: async (module,key,value) => {values.set(`${module}.${key}`,structuredClone(value)); return value;}}};
}
export async function uiFixture() {
  const game = mockGame(), scene = game.scenes.get('sceneA'), events = [], errors = [];
  globalThis.game = game;
  globalThis.canvas = {scene, animatePan: () => Promise.resolve()};
  globalThis.ui = {notifications: {info() {}, error(message) {errors.push(message);}}};
  class Application {render() {this.rendered = true; return this;} _onRender() {}}
  globalThis.foundry = {applications: {api: {ApplicationV2: Application, HandlebarsApplicationMixin: Base => Base}}};
  let selected; const selections = new Set();
  const api = createApi(game, {select: (h,{additive = false,toggle = true} = {}) => {
    if (!additive) selections.clear();
    if (additive && toggle && selections.has(h.id)) selections.delete(h.id); else selections.add(h.id);
    selected = [...selections].at(-1);
  }, emit: (name, data) => events.push({name, data})});
  const documents = new Map(), calls = {saved: [], npcWrites: []};
  const bridge = createCampaignBridge(game,api);
  Object.assign(api,bridge);
  bridge.registerCatalog({regions:[{id:'forah',name:'Protetorado de Forah'},{id:'mirmir',name:'Deserto de Mirmir'}],places:[],tags:[{id:'role:merchant',label:'Mercador'},{id:'rota',label:'Rota'}]});
  // Provedores públicos simulados (o Explorador só os alcança pela API da família).
  game.modules.set('quedaco',{active:true,api:{family:'quedaco',contractVersion:1,id:'quedaco',capabilities:{npcDatabase:true,explorerCatalog:true,npcLocation:true},
    listNpcs: () => Array.from(game.actors).filter(a => a.flags?.quedaco?.npc && a.testUserPermission(game.user,'OBSERVER')).map(a => ({uuid:a.uuid,name:a.name,img:a.img,role:a.flags.quedaco.npc.role,regionId:a.flags.quedaco.npc.regionId,explorerLocation:a.flags.quedaco.npc.explorerLocation ?? null})),
    getExplorerCatalog: () => ({regions:[],places:[],tags:[]}),
    setNpcExplorerLocation: async (uuid, location) => {
      if (!game.user.isGM) throw Error('Somente a Mestra pode atribuir NPCs a uma área.');
      const actor = game.actors.get(uuid.replace('Actor.',''));
      calls.npcWrites.push({uuid,location}); actor.flags.quedaco.npc.explorerLocation = location ? {hexId:location.hexId,sceneId:location.sceneId} : null;
    }}});
  const book = {id:'book',uuid:'JournalEntry.book',name:'Diário da Mestra',pages:[],flags:{},testUserPermission:() => true,sheet:{render() {}}};
  game.journal.set(book.id,book);
  game.modules.set('quedaco-calendario',{active:true,api:{family:'quedaco',contractVersion:1,id:'quedaco-calendario',capabilities:{calendar:true},
    getCurrentDate:() => ({day:4,cycleName:'Primeiro Ciclo',year:349,absoluteDay:83763,mode:'lunar'}),getTimelines:() => ({activeId:'main'}),
    saveLocationRecord: async input => {
      calls.saved.push(input);
      const id = `note${book.pages.length+1}`, page = {id,uuid:`JournalEntry.book.JournalEntryPage.${id}`,title:input.title,record:input};
      book.pages.push(page); documents.set(page.uuid,page); return page.uuid;
    },
    listPlaceNotes: ref => book.pages.filter(p => p.record.place?.ref === ref).map(p => ({uuid:p.uuid,title:p.title,authorId:'gm',absoluteDay:p.record.absoluteDay,timelineId:p.record.timelineId,visibility:p.record.visibility,dateLabel:`Dia ${p.record.absoluteDay}`})),
    openRecord: async uuid => documents.get(uuid)}});
  await api.configureScene(scene.id, {enabled: true});
  const records = [
    {i: 2, j: 2, state: 'explored', name: 'Travessia da Aurora', terrain: 'Floresta', region: 'Protetorado de Forah', regionId:'forah', tags: ['rota', 'encontro'], description: 'Uma antiga estrada corta a floresta. As marcas de uma caravana seguem até a ponte.', journalUuid: 'JournalEntry.diaryA'},
    {i: 2, j: 3, state: 'explored', name: 'Ponte dos Ecos', terrain: 'Água', region: 'Fronteira do Norte'},
    {i: 3, j: 2, state: 'partial', name: 'Nome ainda não revelado'},
    {i: 3, j: 3, state: 'explored', name: 'Acampamento abandonado'},
    {i: 4, j: 3, state: 'partial'},
  ];
  for (const record of records) await api.updateHex(hexId(scene.id, record), record);
  api.selectHex(hexId(scene.id, records[0]));
  const report = action => Promise.resolve().then(action).catch(e => errors.push(e.message));
  const App = createExplorerApp({getApi: () => api, getSelection: () => selected, getSelections:() => [...selections], clearSelection:() => {selections.clear(); selected = null;}, report});
  const app = new App(); app.sceneId = scene.id;
  return {game, scene, api, app, events, errors, documents, calls};
}
