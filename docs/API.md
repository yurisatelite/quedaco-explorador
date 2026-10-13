# API pública · schema 2

Disponível após `ready` em `game.modules.get('quedaco-explorador').api`.

```js
const explorer = game.modules.get('quedaco-explorador').api;
explorer.open();
const hexes = explorer.listHexes(canvas.scene.id, {state: 'explored', search: 'ruína'});
const id = hexes[0]?.id;
if (id) {
  explorer.selectHex(id);
  await explorer.focusHex(id);
  if (game.user.isGM) await explorer.updateHex(id, {region: 'Norte', tags: ['rota']});
}
```

| Método | Retorno e comportamento |
| --- | --- |
| `open(sceneId?)` | Abre o menu lateral na janela do Explorador. |
| `getHex(hexId)` | Registro normalizado, com ID e coordenadas. Verifica cena, geometria e limites. |
| `listHexes(sceneId, {state?, search?, includeInactive?, unassigned?}?)` | Áreas ativas por padrão; desativadas são opcionais para Mestra. |
| `getConfig(sceneId)` | Configuração normalizada. |
| `getSummary(sceneId)` | `{total, hidden, partial, explored}`. |
| `selectHex(hexId)` | Seleciona localmente e emite `hexSelected`. |
| `selectHexes(hexIds, {additive?}?)` | Seleção em lote com uma única atualização do controlador. |
| `focusHex(hexId)` | Abre a cena e centraliza o canvas. |
| `updateHex(hexId, changes)` | Promise. Mestra; campos validados e merge com o registro atual. |
| `updateHexes(hexIds, changes, {tagMode?}?)` | Promise. Mestra; aplica só os campos enviados. tagMode: replace ou add. |
| `setActive(hexIds, active)` | Desativa/reativa sem excluir dados. |
| `renumberAreas(sceneId)` | Numera consecutivamente as áreas ativas; IDs e conteúdo não mudam. |
| `setState(hexId, state)` | Promise. Mestra; `hidden`, `partial` ou `explored`. |
| `setStates(hexIds, state)` | Promise. Mestra; valida a lista e grava uma única atualização de cena. |
| `configureScene(sceneId, changes)` | Promise. Mestra; enabled, defaultState, labelMode (none/selected/all), color, gmOpacity. showLabels é aceito por compatibilidade. |
| `exportScene(sceneId)` | Mestra; JSON serializável com schema, geometria, configuração e hexes. |
| `importWorldExplorer(sceneId)` | Promise. Mestra; `{imported, skipped}`. Preserva registros já cadastrados. |

Registro: `id, sceneId, i, j, number, shortCode, label, active, state, name, terrain, region, regionId, placeId, description, tags, sceneUuid, journalUuid`. `id` é permanente; number/shortCode/label são apresentação. Use `name || label` na interface. Os campos UUID aceitam cenas e diários do mundo. `i/j` são offsets nativos. A migração mantém os IDs 0.1.0 e aloca números visíveis sem mover conteúdo.

API da campanha: `registerCatalog`, `getCatalog`, `createTag`, `getNPCs`, `getNPCCandidates`, `assignNPC`, `removeNPC`, `getCurrentLocation`, `setCurrentLocation`, `getCampaignContext`, `registerNotesProvider`, `createNote`, `listNotes`, `openNote`. Contratos e exemplos completos em [INTEGRACAO-QUEDACO.md](INTEGRACAO-QUEDACO.md).

## Hooks

Todos têm o prefixo `quedaco-explorador:`. Eventos da API são locais ao cliente que executa a operação. Outros clientes recebem os dados pela atualização nativa da cena e podem acompanhar `updateScene` para processar mudanças remotas. Seleção é local e não grava flags.

| Evento | Payload |
| --- | --- |
| `ready` | API |
| `hexSelected` | `{sceneId, hex}` |
| `selectionChanged` | `{sceneId, hexes}` |
| `hexUpdated` | `{sceneId, hex, previous}` |
| `hexStateChanged` | `{sceneId, hex, previousState}` |
| `sceneConfigured` | `{sceneId, config}` |
| `legacyImported` | `{sceneId, count}` |
| `hexActiveChanged` | `{sceneId, hex}` |
| `areasRenumbered` | `{sceneId, count}` |
| `catalogChanged` | Catálogo normalizado |
| `npcLocationChanged` | `{actorUuid, hexId}` |
| `locationChanged` | `{hex}` |
| `noteCreated` | `{uuid, location}` |

```js
Hooks.on('quedaco-explorador:hexSelected', ({hex}) => {
  console.log('Hex selecionado:', hex.id, hex.region, hex.tags);
  // Um módulo consumidor decide como abrir NPCs, tabelas ou registros associados.
});
```

Gravações de áreas são serializadas por cena no cliente que inicia a ação. Clientes Mestra concorrentes seguem a política normal de último escritor do Foundry. A atribuição de NPCs altera apenas seus vínculos geográficos nas flags do Quedaço. Notas são salvas pelo diário do calendário, respeitando a autoria e as permissões. Não altera tempo de mundo nem a configuração do World Explorer.

## Referências de implementação

- APIs nativas de coordenadas e polígonos: https://foundryvtt.com/api/v13/classes/foundry.grid.BaseGrid.html
- Controles de cena: https://foundryvtt.com/api/v13/functions/hookEvents.getSceneControlButtons.html
- Verificação adicional no código instalado do Foundry 13: `common/grid/hexagonal.mjs`, `client/canvas/layers/base/interaction-layer.mjs`, `client/documents/scene.mjs` e `client/applications/ui/scene-controls.mjs`.
- Formato legado observado na ponte local `modulo/src/world-explorer.mjs`: células com `offset: {i,j}` e `reveal: true|false|'partial'`. O importador não usa código executável do módulo original.
