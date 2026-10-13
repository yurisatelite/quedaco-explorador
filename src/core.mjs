export const ID = 'quedaco-explorador';
export const SCHEMA = 2;
export const MAX_HEXES = 5000;
export const STATES = Object.freeze({hidden: 'Oculto', partial: 'Parcial', explored: 'Explorado'});
export const DEFAULT_CONFIG = Object.freeze({enabled: false, defaultState: 'hidden', showLabels: true, labelMode: 'selected', gmOpacity: 0.22, color: '#111827'});
export const TERRAINS = ['Não definido', 'Planície', 'Floresta', 'Montanha', 'Deserto', 'Pântano', 'Água', 'Urbano'];
const clone = value => structuredClone(value);
const text = (value, max = 200) => String(value ?? '').trim().slice(0, max);

export function offsetKey({i, j}) {
  if (!Number.isSafeInteger(i) || !Number.isSafeInteger(j)) throw Error('Coordenadas de hex inválidas.');
  return `${i}_${j}`;
}
export function hexId(sceneId, offset) {
  if (!/^[\w-]+$/.test(sceneId)) throw Error('ID de cena inválido.');
  return `${sceneId}:${offset.i}:${offset.j}`;
}
export function parseHexId(id) {
  const match = /^([\w-]+):(-?\d+):(-?\d+)$/.exec(String(id));
  if (!match) throw Error('ID de hex inválido. Use cena:linha:coluna.');
  const offset = {i: Number(match[2]), j: Number(match[3])};
  offsetKey(offset);
  return {sceneId: match[1], ...offset};
}
export function shortCode(number) { return number ? `A${String(number).padStart(3, '0')}` : '—'; }
export function labelFor({number}) { return number ? `Área ${String(number).padStart(3, '0')}` : 'Área desativada'; }
export function validateConfig(input = {}) {
  const config = {...DEFAULT_CONFIG, ...input};
  if (!Object.hasOwn(STATES, config.defaultState)) throw Error('Estado padrão inválido.');
  if (!/^#[0-9a-f]{6}$/i.test(config.color)) throw Error('Cor de cobertura inválida.');
  if (!Number.isFinite(config.gmOpacity) || config.gmOpacity < 0 || config.gmOpacity > 1) throw Error('Opacidade inválida.');
  const labelMode = input.labelMode ?? (input.showLabels === false ? 'none' : DEFAULT_CONFIG.labelMode);
  if (!['none', 'selected', 'all'].includes(labelMode)) throw Error('Exibição dos nomes inválida.');
  return {enabled: config.enabled === true, defaultState: config.defaultState, showLabels: labelMode !== 'none', labelMode, gmOpacity: config.gmOpacity, color: config.color};
}
export function readConfig(scene) { return validateConfig(scene.flags?.[ID]?.config); }
export function validateHex(input, offset, config = DEFAULT_CONFIG) {
  offsetKey(offset);
  const state = input.state ?? config.defaultState;
  if (!Object.hasOwn(STATES, state)) throw Error('Estado de exploração inválido.');
  const tags = Array.isArray(input.tags) ? input.tags : String(input.tags ?? '').split(',');
  const link = value => {
    const uuid = text(value, 180);
    if (uuid && !/^(?:Scene|JournalEntry)\.[\w.-]+$/.test(uuid)) throw Error('Vínculo inválido. Use o UUID de uma cena ou diário do mundo.');
    return uuid;
  };
  const number = input.number ?? null;
  if (number !== null && (!Number.isSafeInteger(number) || number < 1 || number > 999999)) throw Error('Número da área inválido.');
  return {i: offset.i, j: offset.j, active: input.active !== false, number, state, name: text(input.name), terrain: text(input.terrain, 80), region: text(input.region), regionId: text(input.regionId, 100), placeId: text(input.placeId, 100),
    description: text(input.description, 12000), tags: [...new Set(tags.map(t => text(t, 60)).filter(Boolean))].slice(0, 30),
    sceneUuid: link(input.sceneUuid), journalUuid: link(input.journalUuid)};
}
export function geometrySignature(scene) {
  const grid = scene.grid;
  const r = scene.dimensions.sceneRect;
  return JSON.stringify([grid.type, grid.size, r.x, r.y, r.width, r.height]);
}
export function enumerateHexes(scene) {
  const grid = scene.grid;
  if (!grid?.isHexagonal) throw Error('Configure a cena com uma grade hexagonal nas configurações do Foundry.');
  const rect = scene.dimensions?.sceneRect;
  if (!rect || !(rect.width > 0 && rect.height > 0)) throw Error('Dimensões de cena inválidas.');
  const [i0, j0, i1, j1] = grid.getOffsetRange(rect);
  if ((i1 - i0) * (j1 - j0) > MAX_HEXES) throw Error(`A cena excede o limite de ${MAX_HEXES} hexes desta versão. Aumente o tamanho da grade.`);
  const result = [];
  for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
    const offset = {i, j}, center = grid.getCenterPoint(offset);
    if (center.x < rect.x || center.y < rect.y || center.x >= rect.x + rect.width || center.y >= rect.y + rect.height) continue;
    const record = scene.flags?.[ID]?.hexes?.[offsetKey(offset)];
    const number = record?.number ?? result.length + 1;
    result.push({id: hexId(scene.id, offset), key: offsetKey(offset), label: labelFor({number}), shortCode: shortCode(number), number, active: record?.active !== false, ...offset,
      center, vertices: grid.getVertices(offset)});
  }
  return result;
}
export function assertGeometry(scene) {
  const saved = scene.flags?.[ID]?.geometry;
  if (saved && saved !== geometrySignature(scene)) throw Error('A grade ou os limites do mapa mudaram. Restaure a configuração original para preservar os IDs dos hexes.');
}
export function readHex(scene, offset, {isGM = false} = {}) {
  const config = readConfig(scene);
  const record = validateHex(scene.flags?.[ID]?.hexes?.[offsetKey(offset)] ?? {}, offset, config);
  const number = record.number ?? offset.number ?? enumerateHexes(scene).find(h => h.key === offsetKey(offset))?.number ?? null;
  const base = {id: hexId(scene.id, offset), sceneId: scene.id, label: labelFor({number}), shortCode: shortCode(number)};
  if (!isGM && (record.state !== 'explored' || !record.active)) return {...base, i: offset.i, j: offset.j, number, active: record.active, state: record.state,
    name: '', terrain: '', region: '', regionId: '', placeId: '', description: '', tags: [], sceneUuid: '', journalUuid: ''};
  return {...base, ...clone(record), number};
}
export function summary(hexes) {
  return hexes.filter(h => h.active !== false).reduce((total, hex) => {total[hex.state]++; total.total++; return total;}, {total: 0, hidden: 0, partial: 0, explored: 0});
}
/** Reads saved user data only. No dependency on World Explorer's executable code. */
export function legacyRecords(gridData) {
  if (!gridData || typeof gridData !== 'object' || Array.isArray(gridData)) throw Error('Não há dados do World Explorer nesta cena.');
  const records = [];
  for (const cell of Object.values(gridData)) {
    if (!cell?.offset || ![true, false, 'partial'].includes(cell.reveal)) continue;
    try {
      const {i, j} = cell.offset;
      offsetKey({i, j});
      records.push({i, j, state: cell.reveal === true ? 'explored' : cell.reveal === 'partial' ? 'partial' : 'hidden'});
    } catch { /* Malformed legacy coordinates do not enter the new module. */ }
  }
  return records;
}
