import {ID} from './core.mjs';
import {createApi} from './api.mjs';
import {createExplorerApp} from './app.mjs';
import {createExplorerLayer} from './layer.mjs';
let api, app, selectedId;
const report = action => Promise.resolve().then(action).catch(error => {console.error(ID, error); ui.notifications.error(error.message);});
const open = (sceneId) => {
  if (!app) return;
  if (sceneId) app.sceneId = sceneId;
  app.render({force: true}); return app;
};
function refresh() {
  canvas?.[ID]?.refresh();
  if (app?.rendered) app.render({force: true});
}
Hooks.once('init', () => {
  const layerClass = createExplorerLayer({getApi: () => api, getSelection: () => selectedId, open, report});
  CONFIG.Canvas.layers[ID] = {layerClass, group: 'interface'};
});
Hooks.once('ready', () => {
  const App = createExplorerApp({getApi: () => api, getSelection: () => selectedId, report});
  app = new App();
  api = createApi(game, {open, emit: (name, data) => Hooks.callAll(name, data),
    select: hex => {selectedId = hex.id; app.sceneId = hex.sceneId; refresh();},
    focus: async hex => {const scene = game.scenes.get(hex.sceneId); await scene.view(); await canvas.animatePan(scene.grid.getCenterPoint(hex));}});
  game.modules.get(ID).api = api;
  Hooks.callAll(`${ID}:ready`, api);
  refresh();
});
Hooks.on('updateScene', scene => {if (canvas.scene?.id === scene.id || app?.sceneId === scene.id) refresh();});
Hooks.on('canvasReady', () => {selectedId = null; if (app) app.sceneId = canvas.scene?.id; refresh();});
Hooks.on('deleteScene', () => {selectedId = null; refresh();});
Hooks.on('renderSceneDirectory', (directory, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0] ?? directory.element;
  if (!root || root.querySelector('[data-qe-open]')) return;
  const button = document.createElement('button'); button.type = 'button'; button.dataset.qeOpen = '';
  button.innerHTML = '<i class="fa-solid fa-compass"></i> Quedaço - Explorador';
  button.addEventListener('click', () => open());
  (root.querySelector('.header-actions') ?? root.querySelector('.directory-header') ?? root).prepend(button);
});
