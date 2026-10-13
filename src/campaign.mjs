import {ID} from './core.mjs';

const CALENDAR = 'opath-calendar';
const readable = (doc, game) => !!doc?.testUserPermission?.(game.user, 'OBSERVER');
const label = hex => hex.name || hex.label;
const dateLabel = date => `${date.day} · ${date.cycleName ?? `Ciclo ${date.cycle}`} · ${Math.abs(date.year)} ${date.year < 0 ? 'A.F.' : 'D.F.'}`;

export function createCampaignBridge(game, explorer, {emit = () => {}, importModule = path => import(path), resolveDocument = uuid => fromUuid(uuid)} = {}) {
  let catalog = {regions: [], places: [], tags: []}, notesProvider = null;
  const gm = () => {if (!game.user.isGM) throw Error('Somente a Mestra pode controlar a campanha.');};
  const actors = () => Array.from(game.actors ?? []).filter(a => readable(a, game) && a.flags?.quedaco?.npc);
  function calendar() {return game.modules?.get(CALENDAR)?.active ? game.modules.get(CALENDAR).api : null;}
  function getCurrentLocation() {
    const stored = game.settings.get(ID, 'currentLocation');
    if (!stored?.hexId) return null;
    try {const hex = explorer.getHex(stored.hexId); return hex.active ? hex : null;} catch {return null;}
  }
  function registerCatalog(next) {
    const list = entries => Array.isArray(entries) ? entries.filter(e => e && typeof e.id === 'string' && typeof e.name === 'string').map(e => ({id: e.id.slice(0,100), name: e.name.slice(0,200), regionId: String(e.regionId ?? ''), color: String(e.color ?? '')})) : [];
    catalog = {regions: list(next.regions), places: list(next.places), tags: Array.isArray(next.tags) ? next.tags.map(t => ({id: String(t.id), label: String(t.label)})) : []};
    emit(`${ID}:catalogChanged`, getCatalog());
  }
  function getCatalog() {
    const tags = [...catalog.tags, ...(game.settings.get(ID, 'tagCatalog') ?? [])];
    return structuredClone({...catalog, tags: [...new Map(tags.map(t => [t.id, t])).values()]});
  }
  function getNPCs(hexId) {
    const hex = explorer.getHex(hexId);
    if (!game.user.isGM && (!hex.active || hex.state !== 'explored')) return {present: [], regional: []};
    const simple = actor => ({uuid: actor.uuid ?? `Actor.${actor.id}`, name: actor.name, role: actor.flags.quedaco.npc.role ?? 'extra', img: actor.img});
    return {
      present: actors().filter(a => a.flags.quedaco.npc.explorerLocation?.hexId === hex.id).map(simple),
      regional: game.user.isGM ? actors().filter(a => !a.flags.quedaco.npc.explorerLocation?.hexId && hex.regionId && a.flags.quedaco.npc.regionId === hex.regionId).map(simple) : []
    };
  }
  async function mirrorLocation(page) {
    if (!game.user.isGM) return;
    const location = page?.flags?.[ID]?.location;
    if (!location || !page.flags?.[CALENDAR]?.record) return;
    for (const journal of game.journal ?? []) if (journal.flags?.[CALENDAR]?.sourceUuid === page.uuid
      && JSON.stringify(journal.flags?.[ID]?.location) !== JSON.stringify(location)) await journal.setFlag(ID, 'location', location);
  }
  function listNotes(hexId) {
    explorer.getHex(hexId);
    const result = [], sources = new Set();
    const append = (document, sourceUuid, record, location) => {
      if (!location || location.hexId !== hexId || !record || record.archived || sources.has(sourceUuid)) return;
      sources.add(sourceUuid);
      const owner = record.authorId ?? location.authorId;
      result.push({uuid: document.uuid, title: document.name, author: game.users?.get(owner)?.name ?? 'Diário de campanha', dateLabel: location.dateLabel ?? '', absoluteDay: record.absoluteDay, timelineId: record.timelineId, locationId: hexId, visibility: record.visibility});
    };
    for (const journal of game.journal ?? []) if (readable(journal, game)) for (const page of journal.pages ?? []) {
      if (readable(page, game)) append(page, page.uuid, page.flags?.[CALENDAR]?.record, page.flags?.[ID]?.location);
    }
    for (const journal of game.journal ?? []) if (readable(journal, game)) {
      append(journal, journal.flags?.[CALENDAR]?.sourceUuid ?? journal.uuid, journal.flags?.[CALENDAR]?.record, journal.flags?.[ID]?.location);
    }
    return result.sort((a, b) => b.absoluteDay - a.absoluteDay);
  }
  const api = {
    registerCatalog, getCatalog, getNPCs, listNotes, getCurrentLocation, mirrorLocation,
    registerNotesProvider(provider) {notesProvider = provider;},
    async initialize() {
      const main = game.modules?.get('quedaco');
      if (main?.active) {
        if (main.api?.getExplorerCatalog) registerCatalog(await main.api.getExplorerCatalog());
        else {
          const sources = await Promise.allSettled([importModule('/modules/quedaco/src/book-world.mjs'), importModule('/modules/quedaco/src/npcs.mjs')]);
          const world = sources[0].status === 'fulfilled' ? sources[0].value : {};
          const npc = sources[1].status === 'fulfilled' ? sources[1].value : {};
          registerCatalog({regions: world.REGIONS, places: world.PLACES, tags: Object.entries(npc.NPC_ROLES ?? {}).map(([id, name]) => ({id: `role:${id}`, label: name}))});
          if (sources.some(s => s.status === 'rejected')) console.warn(`${ID}: parte do catálogo do Quedaço não está disponível; os dados salvos foram preservados.`);
        }
      }
      if (calendar()) {
        if (calendar().saveLocationRecord) notesProvider = {save: input => calendar().saveLocationRecord(input)};
        else {
          try {const {createRecords} = await importModule('/modules/opath-calendar/scripts/records.mjs'); notesProvider = createRecords(game);}
          catch {console.warn(`${ID}: calendário sem API de anotações compatível.`);}
        }
      }
    },
    async createTag(name) {
      gm(); const value = String(name ?? '').trim();
      if (!value || value.length > 60) throw Error('Informe uma tag de até 60 caracteres.');
      const tags = [...(game.settings.get(ID, 'tagCatalog') ?? [])];
      const found = getCatalog().tags.find(t => t.label.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR'));
      if (found) return found;
      const tag = {id: value, label: value}; tags.push(tag);
      await game.settings.set(ID, 'tagCatalog', tags); emit(`${ID}:catalogChanged`, getCatalog()); return tag;
    },
    async assignNPC(actorUuid, hexId) {
      gm(); const hex = explorer.getHex(hexId);
      if (!hex.active) throw Error('Reative a área antes de atribuir NPCs.');
      const match = /^Actor\.([\w-]+)$/.exec(actorUuid), actor = match && game.actors?.get(match[1]);
      if (!actor?.flags?.quedaco?.npc) throw Error('Escolha um NPC cadastrado no Quedaço.');
      const update = {'flags.quedaco.npc.explorerLocation': {hexId: hex.id, sceneId: hex.sceneId}};
      if (hex.regionId) update['flags.quedaco.npc.regionId'] = hex.regionId;
      if (hex.placeId) update['flags.quedaco.npc.placeId'] = hex.placeId;
      await actor.update(update); emit(`${ID}:npcLocationChanged`, {actorUuid, hexId: hex.id}); return getNPCs(hex.id);
    },
    async removeNPC(actorUuid, hexId) {
      gm(); explorer.getHex(hexId);
      const match = /^Actor\.([\w-]+)$/.exec(actorUuid), actor = match && game.actors?.get(match[1]);
      if (actor?.flags?.quedaco?.npc?.explorerLocation?.hexId !== hexId) throw Error('Este NPC não está atribuído a esta área.');
      await actor.update({'flags.quedaco.npc.explorerLocation': null}); emit(`${ID}:npcLocationChanged`, {actorUuid, hexId: null});
    },
    getNPCCandidates: () => game.user.isGM ? actors().map(a => ({uuid: a.uuid ?? `Actor.${a.id}`, name: a.name})) : [],
    async setCurrentLocation(hexId) {
      gm(); const hex = explorer.getHex(hexId);
      if (!hex.active) throw Error('A localização do grupo precisa ser uma área ativa.');
      await game.settings.set(ID, 'currentLocation', {hexId: hex.id, sceneId: hex.sceneId});
      emit(`${ID}:locationChanged`, {hex}); return hex;
    },
    getCampaignContext() {
      const clock = calendar(), timelines = clock?.getTimelines?.();
      return {location: getCurrentLocation(), date: clock?.getCurrentDate?.() ?? null, timelineId: timelines?.activeId ?? 'main', canCreateNote: !!(clock && notesProvider)};
    },
    async createNote({title, description, hexId, absoluteDay} = {}) {
      const clock = calendar();
      if (!clock || !notesProvider) throw Error('Ative uma versão compatível do Calendário de Opath para criar notas datadas no diário pessoal.');
      const current = getCurrentLocation();
      const hex = game.user.isGM && hexId ? explorer.getHex(hexId) : current;
      if (!hex?.active) throw Error('A Mestra precisa definir a localização do grupo.');
      if (!game.user.isGM && hexId && hexId !== current?.id) throw Error('A nota deve usar a localização definida pela Mestra.');
      const date = clock.getCurrentDate();
      const day = game.user.isGM && absoluteDay !== undefined ? Number(absoluteDay) : date.absoluteDay;
      if (!Number.isSafeInteger(day)) throw Error('Data inválida.');
      const timelineId = clock.getTimelines?.()?.activeId ?? 'main';
      const uuid = await notesProvider.save({title: String(title ?? '').trim(), description: String(description ?? '').trim(),
        location: [label(hex), hex.region].filter(Boolean).join(' · ').slice(0,200), weather: '', image: '', links: [], visibility: 'public', sharedWith: [], repeat: 'once', absoluteDay: day, timelineId, calendarMode: date.mode ?? 'lunar'});
      const document = await resolveDocument(typeof uuid === 'string' ? uuid : uuid.uuid);
      if (!document?.isOwner && !game.user.isGM) throw Error('Nota salva no calendário, mas sem permissão para vincular a localidade.');
      const location = {hexId: hex.id, sceneId: hex.sceneId, regionId: hex.regionId, name: label(hex), authorId: game.user.id,
        absoluteDay: day, timelineId, dateLabel: day === date.absoluteDay ? dateLabel(date) : `Dia ${day} · ${timelineId}`};
      await document.setFlag(ID, 'location', location);
      await mirrorLocation(document);
      emit(`${ID}:noteCreated`, {uuid: document.uuid, location});
      return {uuid: document.uuid, location};
    },
    async openNote(uuid) {const doc = await resolveDocument(uuid); if (!readable(doc, game)) throw Error('Anotação indisponível.'); return doc.documentName === 'JournalEntryPage' ? doc.parent.sheet.render(true, {pageId: doc.id}) : doc.sheet.render(true);}
  };
  return api;
}
