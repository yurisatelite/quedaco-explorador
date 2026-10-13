import {ID, STATES, TERRAINS, readConfig, enumerateHexes, summary} from './core.mjs';

export function createExplorerApp({getApi, getSelection, report}) {
  const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
  return class ExplorerApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {id: `${ID}-window`, classes: ['qe-app'], window: {title: 'Quedaço - Explorador', resizable: true}, position: {width: 1140, height: 760}};
    static PARTS = {body: {template: `modules/${ID}/templates/explorer.hbs`}};
    tab = 'exploration';
    sceneId = null;
    search = '';
    filter = '';
    async _prepareContext() {
      const api = getApi(), isGM = game.user.isGM;
      const scenes = Array.from(game.scenes).filter(s => isGM || s.testUserPermission(game.user, 'OBSERVER'));
      if (!scenes.some(s => s.id === this.sceneId)) this.sceneId = scenes.find(s => s.id === canvas.scene?.id)?.id ?? scenes[0]?.id ?? null;
      const scene = game.scenes.get(this.sceneId);
      const config = scene ? readConfig(scene) : {};
      let hexes = [], geometry = [], error = '';
      try { if (scene) {hexes = api.listHexes(scene.id); geometry = enumerateHexes(scene);} } catch (e) {error = e.message;}
      const selected = hexes.find(h => h.id === getSelection());
      const filtered = hexes.filter(h => (!this.filter || h.state === this.filter) && (!this.search || [h.id, h.label, h.name, h.region, h.terrain, ...h.tags].join(' ').toLocaleLowerCase('pt-BR').includes(this.search.toLocaleLowerCase('pt-BR'))));
      const records = new Map(hexes.map(h => [h.id, h]));
      const cells = geometry.map(g => ({...g, state: records.get(g.id)?.state ?? 'hidden', points: g.vertices.map(p => `${p.x},${p.y}`).join(' '), selected: g.id === selected?.id,
        name: records.get(g.id)?.name || g.label}));
      const r = scene?.dimensions?.sceneRect;
      return {isGM, hasScene: !!scene, sceneName: scene?.name, sceneId: scene?.id, enabled: config.enabled, config, error,
        scenes: scenes.map(s => ({id: s.id, name: s.name, selected: s.id === this.sceneId})),
        nav: [{id: 'exploration', label: 'Exploração', icon: 'compass'}, {id: 'hexes', label: 'Hexes', icon: 'hexagon'},
          ...(isGM ? [{id: 'settings', label: 'Configuração', icon: 'sliders'}, {id: 'integration', label: 'Integrações', icon: 'plug'}] : [])].map(n => ({...n, active: n.id === this.tab})),
        exploration: this.tab === 'exploration', hexList: this.tab === 'hexes', settings: this.tab === 'settings', integration: this.tab === 'integration',
        stats: summary(hexes), selected, selectedState: selected ? STATES[selected.state] : '', selectedTags: selected?.tags.join(', ') ?? '',
        search: this.search, states: Object.entries(STATES).map(([value, label]) => ({value, label, selected: value === this.filter})),
        defaultStates: Object.entries(STATES).map(([value, label]) => ({value, label, selected: value === config.defaultState})),
        terrains: TERRAINS.map(label => ({label, selected: label === selected?.terrain})), customTerrain: selected?.terrain && !TERRAINS.includes(selected.terrain) ? selected.terrain : '',
        filtered: filtered.slice(0, 200).map(h => ({...h, stateLabel: STATES[h.state], selected: h.id === selected?.id})), limited: filtered.length > 200, filteredCount: filtered.length,
        cells, viewBox: r ? `${r.x} ${r.y} ${r.width} ${r.height}` : '0 0 100 100',
        background: safeBackground(scene?.background?.src), bounds: r,
        legacy: !!scene?.flags?.['world-explorer']?.gridData, hasSelection: !!selected,
        integrationCode: `const explorer = game.modules.get("${ID}").api;\nexplorer.open();\nHooks.on("${ID}:hexSelected", ({hex}) => {\n  console.log(hex.id, hex.region, hex.tags);\n});`};
    }
    _onRender(context, options) {
      super._onRender(context, options);
      const root = this.element, api = getApi();
      root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {this.tab = b.dataset.tab; this.render({force: true});}));
      root.querySelector('[name="scene"]')?.addEventListener('change', e => {this.sceneId = e.target.value; this.render({force: true});});
      root.querySelectorAll('[data-hex]').forEach(b => b.addEventListener('click', () => report(() => {
        api.selectHex(b.dataset.hex);
        return this.render({force: true});
      })));
      root.querySelectorAll('g[data-hex]').forEach(b => b.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); b.dispatchEvent(new MouseEvent('click', {bubbles: true}));}
      }));
      root.querySelectorAll('[data-state]').forEach(b => b.addEventListener('click', () => report(() => api.setState(getSelection(), b.dataset.state))));
      root.querySelector('[data-filter-form]')?.addEventListener('submit', e => {
        e.preventDefault(); const data = new FormData(e.target); this.search = String(data.get('search')); this.filter = String(data.get('state')); this.render({force: true});
      });
      root.querySelector('[data-hex-form]')?.addEventListener('submit', e => {
        e.preventDefault(); const data = new FormData(e.target), id = context.selected.id;
        report(async () => {await api.updateHex(id, Object.fromEntries(data)); ui.notifications.info('Hex salvo.');});
      });
      root.querySelector('[data-config-form]')?.addEventListener('submit', e => {
        e.preventDefault(); const data = new FormData(e.target);
        report(async () => {
          await api.configureScene(context.sceneId, {enabled: data.has('enabled'), showLabels: data.has('showLabels'), defaultState: String(data.get('defaultState')), color: String(data.get('color')), gmOpacity: Number(data.get('gmOpacity'))});
          ui.notifications.info('Configuração salva.');
        });
      });
      root.querySelectorAll('[data-command]').forEach(b => b.addEventListener('click', () => report(async () => {
        switch (b.dataset.command) {
          case 'activate': await api.configureScene(context.sceneId, {enabled: true}); break;
          case 'canvas': {
            const scene = game.scenes.get(context.sceneId); await scene.view(); canvas[ID].activate(); break;
          }
          case 'focus': await api.focusHex(context.selected.id); break;
          case 'scene': case 'journal': {
            const uuid = b.dataset.command === 'scene' ? context.selected.sceneUuid : context.selected.journalUuid;
            const document = await fromUuid(uuid);
            if (!document?.testUserPermission(game.user, 'OBSERVER')) throw Error('Sem acesso ao documento vinculado.');
            if (document.documentName === 'Scene') await document.view(); else await document.sheet.render(true);
            break;
          }
          case 'import': {
            const result = await api.importWorldExplorer(context.sceneId);
            ui.notifications.info(`${result.imported} hexes importados; ${result.skipped} preservados ou ignorados.`); break;
          }
          case 'export': {
            foundry.utils.saveDataToFile(JSON.stringify(api.exportScene(context.sceneId), null, 2), 'application/json', `${ID}-${context.sceneId}.json`); break;
          }
        }
        this.render({force: true});
      })));
    }
  };
}
export function safeBackground(value) {
  const path = String(value ?? '');
  if (!path || /^(?:javascript|data|file):/i.test(path) || path.startsWith('//')) return '';
  return path;
}
