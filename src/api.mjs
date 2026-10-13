import {ID, SCHEMA, parseHexId, offsetKey, validateConfig, validateHex, readConfig, readHex, enumerateHexes, assertGeometry, geometrySignature, summary, legacyRecords} from './core.mjs';

export function createApi(game, {emit = () => {}, open = () => {}, select = () => {}, focus = () => {}} = {}) {
  const queues = new Map();
  function sceneFor(id) {
    const scene = game.scenes.get(id);
    if (!scene || (!game.user.isGM && !scene.testUserPermission(game.user, 'OBSERVER'))) throw Error('Cena indisponível para este usuário.');
    return scene;
  }
  function requireGM() { if (!game.user.isGM) throw Error('Somente a Mestra pode alterar a exploração.'); }
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
    geometry(scene, offset);
    return readHex(scene, offset, game.user);
  }
  function listHexes(sceneId, {state, search = ''} = {}) {
    const scene = sceneFor(sceneId); assertGeometry(scene);
    const query = String(search).toLocaleLowerCase('pt-BR');
    return enumerateHexes(scene).map(h => readHex(scene, h, game.user))
      .filter(h => (!state || h.state === state) && (!query || [h.id, h.label, h.name, h.region, h.terrain, ...h.tags].join(' ').toLocaleLowerCase('pt-BR').includes(query)));
  }
  async function updateHex(id, changes) {
    const {sceneId, ...offset} = parseHexId(id);
    return queued(sceneId, async () => {
      const scene = sceneFor(sceneId); geometry(scene, offset);
      if (!readConfig(scene).enabled) throw Error('Ative a exploração desta cena primeiro.');
      const previous = readHex(scene, offset, {isGM: true});
      const next = validateHex({...previous, ...changes}, offset, readConfig(scene));
      await scene.update({[`flags.${ID}.hexes.${offsetKey(offset)}`]: next});
      const current = readHex(scene, offset, {isGM: true});
      emit(`${ID}:hexUpdated`, {sceneId, hex: current, previous});
      if (previous.state !== current.state) emit(`${ID}:hexStateChanged`, {sceneId, hex: current, previousState: previous.state});
      return current;
    });
  }
  return {
    version: '0.1.0', schema: SCHEMA, open, getHex, listHexes,
    getConfig: sceneId => readConfig(sceneFor(sceneId)),
    getSummary: sceneId => summary(listHexes(sceneId)),
    updateHex,
    setState: (id, state) => updateHex(id, {state}),
    setStates: (ids, state) => {
      requireGM();
      const parsed = [...new Set(ids)].map(parseHexId);
      if (!parsed.length) return Promise.resolve([]);
      const sceneId = parsed[0].sceneId;
      if (parsed.some(h => h.sceneId !== sceneId)) throw Error('A pintura deve pertencer a uma única cena.');
      return queued(sceneId, async () => {
        const scene = sceneFor(sceneId); assertGeometry(scene);
        if (!readConfig(scene).enabled) throw Error('Ative a exploração desta cena primeiro.');
        const valid = new Set(enumerateHexes(scene).map(h => h.key)), data = {}, result = [];
        for (const offset of parsed) {
          if (!valid.has(offsetKey(offset))) throw Error('Hex fora dos limites do mapa.');
          const previous = readHex(scene, offset, {isGM: true});
          const next = validateHex({...previous, state}, offset, readConfig(scene));
          data[`flags.${ID}.hexes.${offsetKey(offset)}`] = next;
          result.push({previous, hex: {...previous, ...next}});
        }
        await scene.update(data);
        for (const {previous, hex} of result) {
          emit(`${ID}:hexUpdated`, {sceneId, hex, previous});
          if (previous.state !== state) emit(`${ID}:hexStateChanged`, {sceneId, hex, previousState: previous.state});
        }
        return result.map(r => r.hex);
      });
    },
    configureScene: (sceneId, changes) => queued(sceneId, async () => {
      const scene = sceneFor(sceneId), config = validateConfig({...readConfig(scene), ...changes});
      if (config.enabled) {enumerateHexes(scene); assertGeometry(scene);}
      const data = {[`flags.${ID}.config`]: config, [`flags.${ID}.schema`]: SCHEMA};
      if (config.enabled) data[`flags.${ID}.geometry`] = geometrySignature(scene);
      await scene.update(data);
      emit(`${ID}:sceneConfigured`, {sceneId, config});
      return config;
    }),
    selectHex: id => {const hex = getHex(id); select(hex); emit(`${ID}:hexSelected`, {sceneId: hex.sceneId, hex}); return hex;},
    focusHex: async id => {const hex = getHex(id); await focus(hex); return hex;},
    exportScene: sceneId => {
      requireGM(); const scene = sceneFor(sceneId);
      return {module: ID, schema: SCHEMA, sceneId, sceneName: scene.name, geometry: geometrySignature(scene), config: readConfig(scene), hexes: listHexes(sceneId)};
    },
    importWorldExplorer: sceneId => queued(sceneId, async () => {
      const scene = sceneFor(sceneId); assertGeometry(scene);
      if (!readConfig(scene).enabled) throw Error('Ative a exploração antes de importar.');
      const valid = new Set(enumerateHexes(scene).map(h => h.key));
      const legacy = legacyRecords(scene.flags?.['world-explorer']?.gridData);
      const update = {}, records = [];
      for (const cell of legacy) {
        const key = offsetKey(cell);
        // Import fills missing cells only; never overwrites edits in the new module.
        if (!valid.has(key) || scene.flags?.[ID]?.hexes?.[key] || Object.hasOwn(update, `flags.${ID}.hexes.${key}`)) continue;
        update[`flags.${ID}.hexes.${key}`] = validateHex(cell, cell, readConfig(scene)); records.push(cell);
      }
      if (records.length) await scene.update(update);
      emit(`${ID}:legacyImported`, {sceneId, count: records.length});
      return {imported: records.length, skipped: legacy.length - records.length};
    })
  };
}
