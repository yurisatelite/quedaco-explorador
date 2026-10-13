import {ID, hexId} from '../src/core.mjs';
import {createApi} from '../src/api.mjs';
import {createExplorerApp} from '../src/app.mjs';

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
  class Collection extends Map { [Symbol.iterator]() {return this.values();} }
  return {user: {isGM: true}, scenes: new Collection([[scene.id, scene]])};
}
export async function uiFixture() {
  const game = mockGame(), scene = game.scenes.get('sceneA'), events = [], errors = [];
  globalThis.game = game;
  globalThis.canvas = {scene, animatePan: () => Promise.resolve()};
  globalThis.ui = {notifications: {info() {}, error(message) {errors.push(message);}}};
  class Application {render() {this.rendered = true; return this;} _onRender() {}}
  globalThis.foundry = {applications: {api: {ApplicationV2: Application, HandlebarsApplicationMixin: Base => Base}}};
  let selected;
  const api = createApi(game, {select: h => {selected = h.id;}, emit: (name, data) => events.push({name, data})});
  await api.configureScene(scene.id, {enabled: true});
  const records = [
    {i: 2, j: 2, state: 'explored', name: 'Travessia da Aurora', terrain: 'Floresta', region: 'Fronteira do Norte', tags: ['rota', 'encontro'], description: 'Uma antiga estrada corta a floresta. As marcas de uma caravana seguem até a ponte.', journalUuid: 'JournalEntry.diaryA'},
    {i: 2, j: 3, state: 'explored', name: 'Ponte dos Ecos', terrain: 'Água', region: 'Fronteira do Norte'},
    {i: 3, j: 2, state: 'partial', name: 'Nome ainda não revelado'},
    {i: 3, j: 3, state: 'explored', name: 'Acampamento abandonado'},
    {i: 4, j: 3, state: 'partial'},
  ];
  for (const record of records) await api.updateHex(hexId(scene.id, record), record);
  api.selectHex(hexId(scene.id, records[0]));
  const report = action => Promise.resolve().then(action).catch(e => errors.push(e.message));
  const App = createExplorerApp({getApi: () => api, getSelection: () => selected, report});
  const app = new App(); app.sceneId = scene.id;
  return {game, scene, api, app, events, errors};
}
