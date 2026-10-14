import {ID} from './core.mjs';

// Integração com a família QUEDAÇO (Protocolo v1). Este módulo NUNCA importa arquivo de outro
// módulo nem grava em documento dele: tudo passa pela API pública do módulo dono do dado.
const MAIN = 'quedaco', CALENDAR = 'quedaco-calendario';
const label = hex => hex.name || hex.label;
const dateLabel = date => `${date.day} · ${date.cycleName ?? `Ciclo ${date.cycle}`} · ${Math.abs(date.year)} ${date.year < 0 ? 'A.F.' : 'D.F.'}`;

/** API pública de um módulo da família, ou null (ausente, desativado, contrato diferente ou sem a capability). */
export function familyApi(game, id, capability) {
  try {
    const module = game?.modules?.get?.(id), api = module?.api;
    return module?.active && api?.family === 'quedaco' && api.contractVersion === 1 && api.id === id && api.capabilities?.[capability] === true ? api : null;
  } catch {return null;}
}

export function createCampaignBridge(game, explorer, {emit = () => {}} = {}) {
  let catalog = {regions: [], places: [], tags: []};
  const gm = () => {if (!game.user.isGM) throw Error('Somente a Mestra pode controlar a campanha.');};
  const main = capability => familyApi(game, MAIN, capability);
  const calendar = () => familyApi(game, CALENDAR, 'calendar');
  const npcs = () => {const api = main('npcDatabase'); try {return api?.listNpcs?.() ?? [];} catch {return [];}};
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
    const simple = n => ({uuid: n.uuid, name: n.name, role: n.role ?? 'extra', img: n.img}), all = npcs();
    return {
      present: all.filter(n => n.explorerLocation?.hexId === hex.id).map(simple),
      regional: game.user.isGM ? all.filter(n => !n.explorerLocation?.hexId && hex.regionId && n.regionId === hex.regionId).map(simple) : []
    };
  }
  function listNotes(hexId) {
    const hex = explorer.getHex(hexId);
    if (!game.user.isGM && (!hex.active || hex.state !== 'explored')) return [];
    const provider = calendar();
    const local = Array.from(game.journal ?? []).filter(doc => doc.flags?.[ID]?.note?.locationId === hexId && doc.testUserPermission(game.user, 'OBSERVER'))
      .map(doc => ({...doc.flags[ID].note, uuid:doc.uuid, title:doc.name, author:game.users?.get(doc.flags[ID].note.authorId)?.name ?? 'Jogador'}));
    if (typeof provider?.listPlaceNotes !== 'function') return local;
    let rows; try {rows = provider.listPlaceNotes(hexId);} catch {return [];}
    return [...local, ...(Array.isArray(rows) ? rows : []).filter(r => r && typeof r.uuid === 'string')
      .map(r => ({uuid: r.uuid, title: String(r.title ?? ''), author: game.users?.get(r.authorId)?.name ?? 'Diário de campanha', dateLabel: String(r.dateLabel ?? ''), absoluteDay: r.absoluteDay, timelineId: r.timelineId, locationId: hexId, visibility: r.visibility}))
    ].sort((a, b) => b.absoluteDay - a.absoluteDay);
  }
  const api = {
    registerCatalog, getCatalog, getNPCs, listNotes, getCurrentLocation,
    async initialize() {
      const provider = main('explorerCatalog');
      if (typeof provider?.getExplorerCatalog === 'function') {
        try {registerCatalog(await provider.getExplorerCatalog());} catch {console.warn(`${ID}: catálogo do QUEDAÇO indisponível; os dados salvos foram preservados.`);}
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
      const provider = main('npcLocation');
      if (typeof provider?.setNpcExplorerLocation !== 'function') throw Error('Ative uma versão do QUEDAÇO que permita atribuir NPCs a áreas.');
      await provider.setNpcExplorerLocation(actorUuid, {hexId: hex.id, sceneId: hex.sceneId, regionId: hex.regionId, placeId: hex.placeId});
      emit(`${ID}:npcLocationChanged`, {actorUuid, hexId: hex.id}); return getNPCs(hex.id);
    },
    async removeNPC(actorUuid, hexId) {
      gm(); explorer.getHex(hexId);
      const provider = main('npcLocation');
      if (typeof provider?.setNpcExplorerLocation !== 'function') throw Error('Ative uma versão do QUEDAÇO que permita atribuir NPCs a áreas.');
      if (!npcs().some(n => n.uuid === actorUuid && n.explorerLocation?.hexId === hexId)) throw Error('Este NPC não está atribuído a esta área.');
      await provider.setNpcExplorerLocation(actorUuid, null); emit(`${ID}:npcLocationChanged`, {actorUuid, hexId: null});
    },
    getNPCCandidates: () => game.user.isGM ? npcs().map(n => ({uuid: n.uuid, name: n.name})) : [],
    async setCurrentLocation(hexId) {
      gm(); const hex = explorer.getHex(hexId);
      if (!hex.active || hex.state !== 'explored') throw Error('A localização do grupo precisa ser uma área ativa e explorada.');
      await game.settings.set(ID, 'currentLocation', {hexId: hex.id, sceneId: hex.sceneId});
      emit(`${ID}:locationChanged`, {hex}); return hex;
    },
    getCampaignContext() {
      const clock = calendar(), timelines = clock?.getTimelines?.();
      return {location: getCurrentLocation(), date: clock?.getCurrentDate?.() ?? null, timelineId: timelines?.activeId ?? 'main', canCreateNote: !!(clock && typeof clock.saveLocationRecord === 'function')};
    },
    /** A nota é criada e guardada pelo Calendário (dono dos diários, que valida a permissão). Aqui só se informa o local. */
    async createNote({title, description, hexId, absoluteDay, skyfallDate, visibility = 'public'} = {}) {
      const clock = calendar();
      const current = getCurrentLocation();
      const hex = game.user.isGM && hexId ? explorer.getHex(hexId) : current;
      if ((!clock || typeof clock.saveLocationRecord !== 'function') && !skyfallDate) throw Error('Calendário indisponível: informe uma data Skyfall para registrar a nota.');
      if (!hex?.active || hex.state !== 'explored') throw Error('Defina uma localização ativa e explorada antes de criar a anotação.');
      if (!game.user.isGM && hexId && hexId !== current?.id) throw Error('A nota deve usar a localização definida pela Mestra.');
      if (!clock || typeof clock.saveLocationRecord !== 'function') {
        const date = skyfallDate ?? {};
        const year = Number(date.year), cycle = Number(date.cycle), day = Number(date.day);
        if (![year, cycle, day].every(Number.isInteger) || cycle < 1 || cycle > 16 || day < 1 || day > 15) throw Error('Sem Calendário: informe uma data Skyfall válida (anel, ciclo e dia).');
        const absolute = year * 240 + (cycle - 1) * 15 + day - 1;
        const note = {uuid:`${ID}.note.${Date.now()}`, title:String(title ?? '').trim() || `Anotação HEX ${hex.shortCode} · Anotação do grupo`, authorId:game.user.id, dateLabel:`Dia ${day} · Ciclo ${cycle} · Anel ${Math.abs(year)} ${year < 0 ? 'A.F.' : 'D.F.'}`, absoluteDay:absolute, timelineId:'main', locationId:hex.id, visibility:visibility === 'public' ? 'public' : 'private'};
        if (!Number.isSafeInteger(absolute)) throw Error('Data Skyfall fora dos limites.');
        if (!game.user.isGM && !game.user.can?.('JOURNAL_CREATE')) throw Error('A Mestra precisa permitir a criação de diários para salvar notas sem Calendário.');
        const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
        const doc = await JournalEntry.create({name:note.title, ownership:{default:note.visibility === 'public' ? 2 : 0, [game.user.id]:3}, flags:{[ID]:{note}},
          pages:[{name:note.title, type:'text', text:{format:1, content:`<p>${escape(note.dateLabel)} · Clima: não informado</p><p>${escape(description ?? '').replace(/\n/g, '<br>')}</p>`}}]});
        emit(`${ID}:noteCreated`, {uuid:doc.uuid, location:{hexId:hex.id, absoluteDay:absolute, dateLabel:note.dateLabel}});
        return {uuid:doc.uuid, location:{hexId:hex.id, absoluteDay:absolute, dateLabel:note.dateLabel}};
      }
      const date = clock.getCurrentDate();
      const day = game.user.isGM && absoluteDay !== undefined ? Number(absoluteDay) : date.absoluteDay;
      if (!Number.isSafeInteger(day)) throw Error('Data inválida.');
      const timelineId = clock.getTimelines?.()?.activeId ?? 'main';
      const place = {ref: hex.id, name: label(hex), regionId: hex.regionId ?? '', source: ID};
      const uuid = await clock.saveLocationRecord({title: String(title ?? '').trim() || `Anotação HEX ${hex.shortCode} · Anotação do grupo`, description: String(description ?? '').trim(),
        location: [label(hex), hex.region].filter(Boolean).join(' · ').slice(0,200), visibility: visibility === 'public' ? 'public' : 'private', absoluteDay: day, timelineId, calendarMode: date.mode ?? 'lunar', place,
        dateTags: [`anel:${date.year}`, `ciclo:${date.cycle}`, `dia:${date.day}`]});
      const location = {hexId: hex.id, sceneId: hex.sceneId, regionId: hex.regionId, name: label(hex), authorId: game.user.id,
        absoluteDay: day, timelineId, dateLabel: day === date.absoluteDay ? dateLabel(date) : `Dia ${day} · ${timelineId}`};
      emit(`${ID}:noteCreated`, {uuid, location});
      return {uuid, location};
    },
    async openNote(uuid) {
      const local = Array.from(game.journal ?? []).find(doc => doc.uuid === uuid && doc.flags?.[ID]?.note);
      if (local) { const hex = explorer.getHex(local.flags[ID].note.locationId); if (!local.testUserPermission(game.user,'OBSERVER') || (!game.user.isGM && (!hex.active || hex.state !== 'explored'))) throw Error('Anotação indisponível.'); return local.sheet.render(true); }
      const clock = calendar();
      if (typeof clock?.openRecord !== 'function') throw Error('Anotação indisponível.');
      return clock.openRecord(uuid);
    }
  };
  return api;
}
