import {ID, SCHEMA, parseHexId, offsetKey, validateConfig, validateHex, readConfig, readHex, enumerateHexes, assertGeometry, geometrySignature, summary, legacyRecords, labelFor, shortCode} from './core.mjs';

export function createApi(game, {emit = () => {}, open = () => {}, select = () => {}, selectMany, focus = () => {}} = {}) {
  const queues = new Map();
  function sceneFor(id) {
    const scene = game.scenes.get(id);
    if (!scene || (!game.user.isGM && !scene.testUserPermission(game.user, 'OBSERVER'))) throw Error('Cena indisponível para este usuário.');
    return scene;
  }
  function requireGM() {if (!game.user.isGM) throw Error('Somente a Mestra pode alterar a exploração.');}
  function queued(sceneId, task) {
    requireGM();
    const pending = (queues.get(sceneId) ?? Promise.resolve()).catch(() => {}).then(task);
    queues.set(sceneId, pending);
    pending.finally(() => {if (queues.get(sceneId) === pending) queues.delete(sceneId);}).catch(() => {});
    return pending;
  }
  function geometry(scene, offset) {
    assertGeometry(scene);
    const hex = enumerateHexes(scene).find(h => h.key === offsetKey(offset));
    if (!hex) throw Error('Hex fora dos limites do mapa.');
    return hex;
  }
  function getHex(id) {
    const {sceneId, ...offset} = parseHexId(id), scene = sceneFor(sceneId);
    return readHex(scene, geometry(scene, offset), game.user);
  }
  function listHexes(sceneId, {state, search = '', includeInactive = false, unassigned = false} = {}) {
    const scene = sceneFor(sceneId); assertGeometry(scene);
    const query = String(search).toLocaleLowerCase('pt-BR');
    return enumerateHexes(scene).map(h => readHex(scene, h, game.user))
      .filter(h => (h.active || includeInactive && game.user.isGM) && (!unassigned || !h.regionId && !h.region) && (!state || h.state === state)
        && (!query || [h.shortCode, h.label, h.name, h.region, h.terrain, ...h.tags].join(' ').toLocaleLowerCase('pt-BR').includes(query)));
  }
  function updateHexes(ids, changes, {tagMode = 'replace'} = {}) {
    requireGM();
    const parsed = [...new Set(ids)].map(parseHexId);
    if (!parsed.length) return Promise.resolve([]);
    const sceneId = parsed[0].sceneId;
    if (parsed.some(h => h.sceneId !== sceneId)) throw Error('A seleção deve pertencer a uma única cena.');
    return queued(sceneId, async () => {
      const scene = sceneFor(sceneId); assertGeometry(scene);
      if (!readConfig(scene).enabled) throw Error('Ative a exploração desta cena primeiro.');
      const cells = new Map(enumerateHexes(scene).map(h => [h.key, h])), data = {}, result = [];
      const activeNumbers = new Set([...cells.values()].filter(c => c.active).map(c => c.number));
      let nextNumber = Math.max(0,...activeNumbers) + 1;
      for (const offset of parsed) {
        const cell = cells.get(offsetKey(offset));
        if (!cell) throw Error('Hex fora dos limites do mapa.');
        const previous = readHex(scene, cell, {isGM: true});
        if (!previous.active && Object.hasOwn(changes, 'state') && changes.active !== true) throw Error('Reative a área antes de alterar sua exploração.');
        const patch = {...changes};
        if (!previous.active && patch.active === true) {
          if (activeNumbers.has(previous.number)) patch.number = nextNumber++;
          activeNumbers.add(patch.number ?? previous.number);
        }
        if (tagMode === 'add' && Object.hasOwn(patch, 'tags')) patch.tags = [...previous.tags, ...(Array.isArray(patch.tags) ? patch.tags : String(patch.tags).split(','))];
        const next = validateHex({...previous, ...patch}, cell, readConfig(scene));
        data[`flags.${ID}.hexes.${offsetKey(offset)}`] = next;
        result.push({previous, hex: {...previous, ...next, label: labelFor(next), shortCode: shortCode(next.number)}});
      }
      await scene.update(data);
      for (const {previous, hex} of result) {
        emit(`${ID}:hexUpdated`, {sceneId, hex, previous});
        if (previous.state !== hex.state) emit(`${ID}:hexStateChanged`, {sceneId, hex, previousState: previous.state});
        if (previous.active !== hex.active) emit(`${ID}:hexActiveChanged`, {sceneId, hex});
      }
      return result.map(r => r.hex);
    });
  }
  async function updateHex(id, changes) {return (await updateHexes([id], changes))[0];}
  const api = {
    version: '0.2.0', schema: SCHEMA, open, getHex, listHexes,
    getConfig: sceneId => readConfig(sceneFor(sceneId)),
    getSummary: sceneId => summary(listHexes(sceneId)),
    updateHex, updateHexes,
    setState: (id, state) => updateHex(id, {state}),
    setStates: (ids, state) => updateHexes(ids, {state}),
    setActive: (ids, active) => updateHexes(Array.isArray(ids) ? ids : [ids], {active: active === true}),
    renumberAreas: sceneId => queued(sceneId, async () => {
      const scene = sceneFor(sceneId); assertGeometry(scene);
      if (!readConfig(scene).enabled) throw Error('Ative a exploração desta cena primeiro.');
      const cells = enumerateHexes(scene).filter(c => c.active), update = {};
      cells.forEach((cell, index) => {update[`flags.${ID}.hexes.${cell.key}.number`] = index + 1;});
      if (cells.length) await scene.update(update);
      emit(`${ID}:areasRenumbered`, {sceneId, count: cells.length});
      return {count: cells.length};
    }),
    configureScene: (sceneId, changes) => queued(sceneId, async () => {
      const scene = sceneFor(sceneId), patch = {...changes};
      if (Object.hasOwn(patch, 'showLabels') && !Object.hasOwn(patch, 'labelMode')) patch.labelMode = patch.showLabels ? 'selected' : 'none';
      const config = validateConfig({...readConfig(scene), ...patch});
      let cells = [];
      if (config.enabled) {cells = enumerateHexes(scene); assertGeometry(scene);}
      const data = {[`flags.${ID}.config`]: config, [`flags.${ID}.schema`]: SCHEMA};
      if (config.enabled) {
        data[`flags.${ID}.geometry`] = geometrySignature(scene);
        for (const cell of cells) if (!scene.flags?.[ID]?.hexes?.[cell.key]?.number) data[`flags.${ID}.hexes.${cell.key}.number`] = cell.number;
      }
      await scene.update(data);
      emit(`${ID}:sceneConfigured`, {sceneId, config});
      return config;
    }),
    selectHex: (id, options = {}) => {
      const hex = getHex(id); if (!hex.active && !game.user.isGM) throw Error('Área desativada.');
      select(hex, options); emit(`${ID}:hexSelected`, {sceneId: hex.sceneId, hex, additive: !!options.additive}); return hex;
    },
    selectHexes: (ids, options = {}) => {
      requireGM(); const parsed = [...new Set(ids)].map(parseHexId);
      if (!parsed.length) return [];
      const sceneId = parsed[0].sceneId;
      if (parsed.some(h => h.sceneId !== sceneId)) throw Error('A seleção deve pertencer a uma única cena.');
      const scene = sceneFor(sceneId); assertGeometry(scene);
      const cells = new Map(enumerateHexes(scene).map(h => [h.key,h]));
      const hexes = parsed.map(offset => {const cell = cells.get(offsetKey(offset)); if (!cell) throw Error('Hex fora dos limites do mapa.'); return readHex(scene,cell,game.user);});
      if (selectMany) selectMany(hexes,options); else hexes.forEach((h,index) => select(h,{additive:options.additive || index > 0,toggle:false}));
      emit(`${ID}:selectionChanged`,{sceneId,hexes}); return hexes;
    },
    focusHex: async id => {const hex = getHex(id); await focus(hex); return hex;},
    exportScene: sceneId => {
      requireGM(); const scene = sceneFor(sceneId);
      return {module: ID, schema: SCHEMA, sceneId, sceneName: scene.name, geometry: geometrySignature(scene), config: readConfig(scene), hexes: listHexes(sceneId, {includeInactive: true})};
    },
    importWorldExplorer: sceneId => queued(sceneId, async () => {
      const scene = sceneFor(sceneId); assertGeometry(scene);
      if (!readConfig(scene).enabled) throw Error('Ative a exploração antes de importar.');
      const valid = new Map(enumerateHexes(scene).map(h => [h.key, h]));
      const legacy = legacyRecords(scene.flags?.['world-explorer']?.gridData), update = {};
      let count = 0;
      for (const cell of legacy) {
        const key = offsetKey(cell), existing = scene.flags?.[ID]?.hexes?.[key];
        if (!valid.has(key) || existing?.state || Object.hasOwn(update, `flags.${ID}.hexes.${key}`)) continue;
        update[`flags.${ID}.hexes.${key}`] = validateHex({...existing, ...cell, number: existing?.number ?? valid.get(key).number}, cell, readConfig(scene)); count++;
      }
      if (count) await scene.update(update);
      emit(`${ID}:legacyImported`, {sceneId, count});
      return {imported: count, skipped: legacy.length - count};
    })
  };
  return api;
}
