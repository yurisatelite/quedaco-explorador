import {ID, readConfig} from './core.mjs';
import {createApi} from './api.mjs';
import {createExplorerApp} from './app.mjs';
import {createExplorerLayer} from './layer.mjs';
import {createCampaignBridge, familyApi} from './campaign.mjs';
import {installSceneConfig, validateSceneUpdate} from './scene-config.mjs';
let api, app, selectedId, bridge;
const selectedIds = new Set();
const report = action => Promise.resolve().then(action).catch(error => {console.error(ID, error); ui.notifications.error(error.message);});
const open = (sceneId) => {
  if (!game.user.isGM) throw Error('O painel do Explorador é exclusivo da Mestra.');
  if (!app) return;
  if (sceneId) app.sceneId = sceneId;
  app.render({force: true}); return app;
};
function refresh() {
  canvas?.[ID]?.refresh();
  if (app?.rendered) app.render({force: true});
}
Hooks.once('init', () => {
  const layerClass = createExplorerLayer({getApi: () => api, getSelection: () => selectedId, getSelections: () => [...selectedIds], open, report});
  CONFIG.Canvas.layers[ID] = {layerClass, group: 'interface'};
  for (const [key, type, initial] of [['tagCatalog', Array, []], ['currentLocation', Object, {}]]) {
    game.settings.register(ID, key, {scope: 'world', config: false, type, default: initial, onChange: refresh});
  }
});
Hooks.once('ready', async () => {
  const App = createExplorerApp({getApi: () => api, getSelection: () => selectedId, getSelections: () => [...selectedIds], clearSelection: () => {selectedIds.clear(); selectedId = null; refresh();}, report});
  app = new App();
  api = createApi(game, {open, emit: (name, data) => Hooks.callAll(name, data),
    select: (hex, {additive = false, toggle = true} = {}) => {
      if (!additive || app.sceneId !== hex.sceneId) selectedIds.clear();
      if (additive && toggle && selectedIds.has(hex.id)) selectedIds.delete(hex.id); else selectedIds.add(hex.id);
      selectedId = [...selectedIds].at(-1) ?? null; app.sceneId = hex.sceneId; refresh();
    },
    selectMany: (hexes,{additive = false} = {}) => {
      if (!hexes.length) return;
      if (!additive || app.sceneId !== hexes[0].sceneId) selectedIds.clear();
      for (const hex of hexes) selectedIds.add(hex.id);
      selectedId = [...selectedIds].at(-1); app.sceneId = hexes[0].sceneId; refresh();
    },
    focus: async hex => {const scene = game.scenes.get(hex.sceneId); await scene.view(); await canvas.animatePan(scene.grid.getCenterPoint(hex));}});
  bridge = createCampaignBridge(game, api, {emit: (name, data) => Hooks.callAll(name, data)});
  Object.assign(api, bridge);
  if (game.user.isGM && (!game.users.activeGM || game.users.activeGM.id === game.user.id)) {
    for (const scene of game.scenes) if (readConfig(scene).enabled && (scene.flags?.[ID]?.schema ?? 1) < 2) {
      try {await api.configureScene(scene.id, {});} catch (error) {console.warn(`${ID}: migração adiada para ${scene.name}: ${error.message}`);}
    }
  }
  await bridge.initialize();
  const module = game.modules.get(ID);
  const descriptor = Object.freeze({
    ...api,
    family: 'quedaco', contractVersion: 1, id: ID, title: module.title, version: module.version,
    capabilities: Object.freeze({mapExplorer: true, areaDatabase: true, currentLocation: true, npcPlacement: true, areaNotes: true}),
    open: sceneId => open(sceneId),
    getStatus: () => ({ready: true, integrations: {quedaco: !!familyApi(game, 'quedaco', 'npcDatabase'), calendar: !!familyApi(game, 'quedaco-calendario', 'calendar')}})
  });
  module.api = descriptor;
  Hooks.callAll(`${ID}:ready`, descriptor);
  Hooks.callAll('quedaco:register', descriptor);
  refresh();
});
Hooks.on('updateScene', scene => {if (canvas.scene?.id === scene.id || app?.sceneId === scene.id) refresh();});
Hooks.on('canvasReady', () => {selectedIds.clear(); selectedId = null; if (app) app.sceneId = canvas.scene?.id; refresh();});
Hooks.on('deleteScene', () => {selectedIds.clear(); selectedId = null; refresh();});
Hooks.on('renderSceneConfig', (application, html) => report(() => installSceneConfig(application, html, {open, report})));
Hooks.on('preUpdateScene', (scene, changes) => {
  try {
    validateSceneUpdate(scene, changes, {expand: foundry.utils.expandObject, setProperty: foundry.utils.setProperty, cloneScene: (document, patch) => document.clone(patch, {save: false, keepId: true})});
  } catch (error) {ui.notifications.error(error.message); return false;}
});
for (const hook of ['updateActor', 'createActor', 'deleteActor', 'createJournalEntry', 'updateJournalEntry', 'deleteJournalEntry', 'createJournalEntryPage', 'deleteJournalEntryPage']) Hooks.on(hook, refresh);
Hooks.on('updateJournalEntryPage', refresh);
Hooks.on('quedaco:register', () => report(async () => {if (bridge) {await bridge.initialize(); refresh();}}));
Hooks.on(`${ID}:catalogChanged`, refresh);
Hooks.on('renderSceneDirectory', (directory, html) => {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0] ?? directory.element;
  if (!root || root.querySelector('[data-qe-open]')) return;
  const button = document.createElement('button'); button.type = 'button'; button.dataset.qeOpen = '';
  button.innerHTML = '<i class="fa-solid fa-compass"></i> QUEDAÇO - Explorador';
  button.addEventListener('click', () => open());
  (root.querySelector('.header-actions') ?? root.querySelector('.directory-header') ?? root).prepend(button);
});
