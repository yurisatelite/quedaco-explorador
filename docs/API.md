# API pública · schema 1

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
| `listHexes(sceneId, {state?, search?}?)` | Hexes da área do mapa, incluindo os ainda não cadastrados. |
| `getConfig(sceneId)` | Configuração normalizada. |
| `getSummary(sceneId)` | `{total, hidden, partial, explored}`. |
| `selectHex(hexId)` | Seleciona localmente e emite `hexSelected`. |
| `focusHex(hexId)` | Abre a cena e centraliza o canvas. |
| `updateHex(hexId, changes)` | Promise. Mestra; campos validados e merge com o registro atual. |
| `setState(hexId, state)` | Promise. Mestra; `hidden`, `partial` ou `explored`. |
| `setStates(hexIds, state)` | Promise. Mestra; valida a lista e grava uma única atualização de cena. |
| `configureScene(sceneId, changes)` | Promise. Mestra; enabled, defaultState, showLabels, color, gmOpacity. |
| `exportScene(sceneId)` | Mestra; JSON serializável com schema, geometria, configuração e hexes. |
| `importWorldExplorer(sceneId)` | Promise. Mestra; `{imported, skipped}`. Preserva registros já cadastrados. |

Registro do hex: `id, sceneId, i, j, label, state, name, terrain, region, description, tags, sceneUuid, journalUuid`. Os campos UUID aceitam cenas e diários do mundo, não compêndios. `i/j` são coordenadas offset; consulte `scene.grid.getCube({i,j})` para obter coordenadas cúbicas quando necessário.

## Hooks

Todos têm o prefixo `quedaco-explorador:`. Eventos da API são locais ao cliente que executa a operação. Outros clientes recebem os dados pela atualização nativa da cena e podem acompanhar `updateScene` para processar mudanças remotas. Seleção é local e não grava flags.

| Evento | Payload |
| --- | --- |
| `ready` | API |
| `hexSelected` | `{sceneId, hex}` |
| `hexUpdated` | `{sceneId, hex, previous}` |
| `hexStateChanged` | `{sceneId, hex, previousState}` |
| `sceneConfigured` | `{sceneId, config}` |
| `legacyImported` | `{sceneId, count}` |

```js
Hooks.on('quedaco-explorador:hexSelected', ({hex}) => {
  console.log('Hex selecionado:', hex.id, hex.region, hex.tags);
  // Um módulo consumidor decide como abrir NPCs, tabelas ou registros associados.
});
```

Gravações são serializadas por cena no cliente que inicia a ação. Clientes Mestra concorrentes seguem a política normal de último escritor do Foundry; não existe trava distribuída. As operações nunca alteram Atores, tempo de mundo ou a configuração do World Explorer.

## Referências de implementação

- APIs nativas de coordenadas e polígonos: https://foundryvtt.com/api/v13/classes/foundry.grid.BaseGrid.html
- Controles de cena: https://foundryvtt.com/api/v13/functions/hookEvents.getSceneControlButtons.html
- Verificação adicional no código instalado do Foundry 13: `common/grid/hexagonal.mjs`, `client/canvas/layers/base/interaction-layer.mjs`, `client/documents/scene.mjs` e `client/applications/ui/scene-controls.mjs`.
- Formato legado observado na ponte local `modulo/src/world-explorer.mjs`: células com `offset: {i,j}` e `reveal: true|false|'partial'`. O importador não usa código executável do módulo original.
