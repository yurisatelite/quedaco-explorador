import {ID, STATES, TERRAINS, readConfig, enumerateHexes, summary} from './core.mjs';

export function createExplorerApp({getApi, getSelection, getSelections = () => [getSelection()].filter(Boolean), clearSelection = () => {}, report}) {
  const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
  return class ExplorerApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {id: `${ID}-window`, classes: ['qe-app'], window: {title: 'QUEDAÇO - Explorador', resizable: true}, position: {width: 1200, height: 800}};
    static PARTS = {body: {template: `modules/${ID}/templates/explorer.hbs`}};
    tab = 'exploration'; sceneId = null; search = ''; filter = ''; showInactive = false; unassigned = false;
    async _prepareContext() {
      const api = getApi(), isGM = game.user.isGM;
      const scenes = Array.from(game.scenes).filter(s => isGM || s.testUserPermission(game.user, 'OBSERVER'));
      if (!scenes.some(s => s.id === this.sceneId)) this.sceneId = scenes.find(s => s.id === canvas.scene?.id)?.id ?? scenes[0]?.id ?? null;
      const scene = game.scenes.get(this.sceneId), config = scene ? readConfig(scene) : {};
      let hexes = [], geometry = [], error = '';
      try {if (scene) {hexes = api.listHexes(scene.id, {includeInactive: isGM}); geometry = enumerateHexes(scene);}} catch (e) {error = e.message;}
      const selected = hexes.find(h => h.id === getSelection()), selectionIds = getSelections().filter(id => hexes.some(h => h.id === id));
      const multiple = isGM && selectionIds.length > 1;
      const filtered = hexes.filter(h => (h.active || this.showInactive && isGM) && (!this.unassigned || !h.regionId && !h.region)
        && (!this.filter || h.state === this.filter) && (!this.search || [h.shortCode,h.label,h.name,h.region,h.terrain,...h.tags].join(' ').toLocaleLowerCase('pt-BR').includes(this.search.toLocaleLowerCase('pt-BR'))));
      const records = new Map(hexes.map(h => [h.id, h]));
      const cells = geometry.filter(g => g.active || this.showInactive && isGM).map(g => {
        const h = records.get(g.id), selected = selectionIds.includes(g.id);
        const labelText = config.labelMode === 'all' || multiple ? h?.shortCode : h?.name || h?.label;
        return {...g, state: h?.state ?? 'hidden', points: g.vertices.map(p => `${p.x},${p.y}`).join(' '), selected,
          name: h?.name || h?.label || g.label, labelLines: wrapMapLabel(labelText,Math.max(8,Math.floor(scene.grid.size * 0.85 / 6)),g.center),
          showLabel: g.active && config.labelMode !== 'none' && (config.labelMode === 'all' || selected) && (isGM || h?.state === 'explored')};
      });
      const catalog = api.getCatalog?.() ?? {regions: [], places: [], tags: []}, campaign = api.getCampaignContext?.() ?? {};
      const regionId = selected?.regionId || catalog.regions.find(r => r.name === selected?.region)?.id || (selected?.region ? `legacy:${selected.region}` : '');
      const regions = [...catalog.regions];
      if (selected?.region && !regions.some(r => r.id === regionId)) regions.push({id: regionId, name: selected.region});
      const tags = new Map(catalog.tags.map(t => [t.id, t]));
      for (const tag of selected?.tags ?? []) if (!tags.has(tag)) tags.set(tag, {id: tag, label: tag});
      const npcs = selected ? api.getNPCs?.(selected.id) ?? {present: [], regional: []} : {present: [], regional: []};
      const r = scene?.dimensions?.sceneRect;
      return {isGM, hasScene: !!scene, sceneName: scene?.name, sceneId: scene?.id, enabled: config.enabled, config, error,
        scenes: scenes.map(s => ({id: s.id, name: s.name, selected: s.id === this.sceneId})),
        nav: [{id: 'exploration', label: 'Exploração', icon: 'compass'}, {id: 'hexes', label: 'Áreas', icon: 'hexagon'},
          ...(isGM ? [{id: 'settings', label: 'Configuração', icon: 'sliders'}, {id: 'tags', label: 'Tags', icon: 'tags'}, {id: 'integration', label: 'Integrações', icon: 'plug'}] : [])].map(n => ({...n, active: n.id === this.tab})),
        exploration: this.tab === 'exploration', hexList: this.tab === 'hexes', settings: this.tab === 'settings', integration: this.tab === 'integration', tagManager: this.tab === 'tags',
        stats: summary(hexes), inactiveCount: hexes.filter(h => !h.active).length, unassignedCount: hexes.filter(h => h.active && !h.regionId && !h.region).length,
        selected, selectedName: selected?.name || selected?.label, selectedState: selected ? STATES[selected.state] : '',
        search: this.search, showInactive: this.showInactive, unassigned: this.unassigned, selectionIds, selectionCount: selectionIds.length, multiple,
        states: Object.entries(STATES).map(([value, label]) => ({value, label, selected: value === this.filter})),
        defaultStates: Object.entries(STATES).map(([value, label]) => ({value, label, selected: value === config.defaultState})),
        labelModes: [{value:'selected',label:'Só a área selecionada'},{value:'none',label:'Nenhum'},{value:'all',label:'Todos os números curtos'}].map(v => ({...v,selected:v.value === config.labelMode})),
        terrains: TERRAINS.map(label => ({label, selected: !multiple && label === selected?.terrain})), customTerrain: selected?.terrain && !TERRAINS.includes(selected.terrain) ? selected.terrain : '',
        regions: regions.map(r => ({...r, selected: !multiple && r.id === regionId})), noRegion: !regionId,
        places: catalog.places.map(p => ({...p, selected: !multiple && p.id === selected?.placeId})),
        tags: [...tags.values()].map(t => ({...t, selected: !multiple && selected?.tags.includes(t.id)})),
        filtered: filtered.slice(0,200).map(h => ({...h, stateLabel: h.active ? STATES[h.state] : 'Desativada', selected: selectionIds.includes(h.id)})), limited: filtered.length > 200, filteredCount: filtered.length,
        cells, viewBox: r ? `${r.x} ${r.y} ${r.width} ${r.height}` : '0 0 100 100', background: safeBackground(scene?.background?.src), bounds: r,
        legacy: !!scene?.flags?.['world-explorer']?.gridData, hasSelection: !!selected, npcs, npcCandidates: api.getNPCCandidates?.() ?? [],
        notes: selected ? api.listNotes?.(selected.id) ?? [] : [], currentLocationName: campaign.location?.name || campaign.location?.label,
        selectedIsCurrent: campaign.location?.id === selected?.id, canCreateNote: !!(campaign.canCreateNote && selected?.active && (isGM || campaign.location?.id === selected?.id)),
        dateText: campaign.date ? `${campaign.date.day} · ${campaign.date.cycleName ?? ''} · ${Math.abs(campaign.date.year)} ${campaign.date.year < 0 ? 'A.F.' : 'D.F.'}` : 'Calendário não conectado',
        integrationCode: `const explorer = game.modules.get("${ID}").api;\nconst contexto = explorer.getCampaignContext();\nHooks.on("${ID}:hexSelected", ({hex}) => {\n  console.log(hex.name || hex.label, hex.region);\n});`};
    }
    _onRender(context, options) {
      super._onRender(context, options);
      const root = this.element, api = getApi();
      const run = action => report(async () => {await action(); this.render({force:true});});
      root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {this.tab = b.dataset.tab; this.render({force:true});}));
      root.querySelector('[name="scene"]')?.addEventListener('change', e => {this.sceneId = e.target.value; clearSelection(); this.render({force:true});});
      root.querySelectorAll('[data-hex]').forEach(b => b.addEventListener('click', e => run(() => api.selectHex(b.dataset.hex, {additive: context.isGM && (e.shiftKey || e.ctrlKey || e.metaKey)}))));
      root.querySelectorAll('g[data-hex]').forEach(b => b.addEventListener('keydown', e => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); b.dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:e.shiftKey,ctrlKey:e.ctrlKey}));}}));
      root.querySelectorAll('[data-state]').forEach(b => b.addEventListener('click', () => run(() => api.setStates(context.selectionIds, b.dataset.state))));
      root.querySelectorAll('[data-view]').forEach(b => b.addEventListener('change', () => {this[b.dataset.view] = b.checked; this.render({force:true});}));
      root.querySelector('[data-filter-form]')?.addEventListener('submit', e => {e.preventDefault(); const data = new FormData(e.target); this.search = String(data.get('search')); this.filter = String(data.get('state')); this.render({force:true});});
      for (const selector of ['[data-hex-form]', '[data-batch-form]']) root.querySelector(selector)?.addEventListener('submit', e => {
        e.preventDefault(); const data = new FormData(e.target), patch = {};
        for (const field of ['name','terrain','description','sceneUuid','journalUuid']) if (data.has(field) && data.get(field) !== '__keep') patch[field] = String(data.get(field));
        if (data.has('regionId') && data.get('regionId') !== '__keep') {
          const value = String(data.get('regionId')), region = context.regions.find(r => r.id === value);
          patch.regionId = value.startsWith('legacy:') ? '' : value; patch.region = region?.name ?? ''; patch.placeId = '';
        }
        if (data.has('placeId') && data.get('placeId') !== '__keep') patch.placeId = String(data.get('placeId'));
        if (!context.multiple || data.getAll('tags').length) patch.tags = data.getAll('tags');
        run(async () => {await api.updateHexes(context.selectionIds, patch, {tagMode: context.multiple ? 'add' : 'replace'}); ui.notifications.info(`${context.selectionCount} área(s) salva(s).`);});
      });
      root.querySelector('[data-config-form]')?.addEventListener('submit', e => {
        e.preventDefault(); const data = new FormData(e.target);
        run(() => api.configureScene(context.sceneId,{enabled:data.has('enabled'),labelMode:String(data.get('labelMode')),defaultState:String(data.get('defaultState')),color:String(data.get('color')),gmOpacity:Number(data.get('gmOpacity'))}));
      });
      root.querySelector('[data-tag-form]')?.addEventListener('submit', e => {e.preventDefault(); const name = String(new FormData(e.target).get('tagName')); run(() => api.createTag(name));});
      root.querySelector('[data-npc-form]')?.addEventListener('submit', e => {e.preventDefault(); const uuid = String(new FormData(e.target).get('npc')); run(() => api.assignNPC(uuid, context.selected.id));});
      root.querySelectorAll('[data-remove-npc]').forEach(b => b.addEventListener('click', () => run(() => api.removeNPC(b.dataset.removeNpc, context.selected.id))));
      root.querySelectorAll('[data-note]').forEach(b => b.addEventListener('click', () => run(() => api.openNote(b.dataset.note))));
      root.querySelector('[data-note-form]')?.addEventListener('submit', e => {
        e.preventDefault(); const data = new FormData(e.target);
        run(async () => {await api.createNote({hexId:context.selected.id,title:String(data.get('title')),description:String(data.get('description'))}); ui.notifications.info('Nota publicada no diário, com data e localização.');});
      });
      root.querySelectorAll('[data-command]').forEach(b => b.addEventListener('click', () => run(async () => {
        switch (b.dataset.command) {
          case 'activate': await api.configureScene(context.sceneId,{enabled:true}); break;
          case 'canvas': await game.scenes.get(context.sceneId).view(); canvas[ID].activate(); break;
          case 'focus': await api.focusHex(context.selected.id); break;
          case 'clear': clearSelection(); break;
          case 'disable': await api.setActive(context.selectionIds,false); break;
          case 'enable': await api.setActive(context.selectionIds,true); break;
          case 'renumber': await api.renumberAreas(context.sceneId); break;
          case 'current': await api.setCurrentLocation(context.selected.id); break;
          case 'scene': case 'journal': {
            const uuid = b.dataset.command === 'scene' ? context.selected.sceneUuid : context.selected.journalUuid;
            const doc = await fromUuid(uuid); if (!doc?.testUserPermission(game.user,'OBSERVER')) throw Error('Sem acesso ao documento vinculado.');
            if (doc.documentName === 'Scene') await doc.view(); else await doc.sheet.render(true); break;
          }
          case 'import': {const result = await api.importWorldExplorer(context.sceneId); ui.notifications.info(`${result.imported} áreas importadas; ${result.skipped} preservadas ou ignoradas.`); break;}
          case 'export': foundry.utils.saveDataToFile(JSON.stringify(api.exportScene(context.sceneId),null,2),'application/json',`${ID}-${context.sceneId}.json`); break;
        }
      })));
    }
  };
}
export function safeBackground(value) {const path = String(value ?? ''); return !path || /^(?:javascript|data|file):/i.test(path) || path.startsWith('//') ? '' : path;}
export function wrapMapLabel(value,maxChars,center) {
  const lines = []; let current = '';
  for (const word of String(value ?? '').split(/\s+/)) {
    if (current && current.length + word.length + 1 > maxChars) {lines.push(current); current = '';}
    current = [current,word].filter(Boolean).join(' ');
  }
  if (current) lines.push(current);
  const visible = lines.slice(0,3);
  if (lines.length > 3) visible[2] += '…';
  return visible.map((text,index) => ({text:text.length > maxChars ? text.slice(0,maxChars-1)+'…' : text,x:center.x,y:center.y + (index-(visible.length-1)/2)*14}));
}
