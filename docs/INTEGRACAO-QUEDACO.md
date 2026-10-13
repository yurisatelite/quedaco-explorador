# Instrução para atualizar o Quedaço principal

> Atualização de requisitos em 13/10/2026: o [Protocolo de Integração Quedaço](PROTOCOLO-INTEGRACAO-QUEDACO.md) prevalece sobre as recomendações anteriores abaixo. Imports diretos de outros módulos e gravações diretas de seus documentos devem ser substituídos por APIs públicas opcionais. Este documento descreve a integração 0.2.0; o trabalho necessário para adequá-la está em [PROXIMA-ATUALIZACAO.md](PROXIMA-ATUALIZACAO.md).

Implemente o Quedaço como painel central da campanha usando a API do **quedaco-explorador 0.2.0**. Preserve as alterações locais existentes e os módulos independentes. Esta entrega modificou o Explorador; ainda não modificou as telas do Quedaço, calendário ou Jornal da Queda.

## Responsabilidades

| Módulo | Responsabilidade |
| --- | --- |
| Quedaço (`quedaco`) | Painel central, catálogo canônico de regiões/localidades/papéis, cadastro de NPCs e decisões da Mestra. |
| Explorador (`quedaco-explorador`) | Áreas da grade, nomes/números visíveis, terreno/região/tags, seleção, áreas desativadas e localização do grupo. |
| Calendário (`opath-calendar`) | Data e linha do tempo, diário pessoal, autoria, visibilidade, compartilhamento e espelhos públicos das notas. |
| Jornal da Queda (`quedaco-jornal-da-queda`) | Edições de notícias e sua compra. Não confundir o jornal de notícias com o diário pessoal do calendário. |

## 1. Expor o catálogo do Quedaço

Hoje o Explorador consegue consultar os exports instalados de `src/book-world.mjs` (REGIONS/PLACES) e `src/npcs.mjs` (NPC_ROLES). Substitua esse fallback por um contrato explícito no `module.api`, preservando `open/openCampaign`:

```js
const getExplorerCatalog = () => ({
  regions: REGIONS.map(({id,name,color}) => ({id,name,color})),
  places: PLACES.map(({id,name,regionId}) => ({id,name,regionId})),
  tags: Object.entries(NPC_ROLES).map(([id,label]) => ({id:`role:${id}`,label}))
});
Object.assign(game.modules.get('quedaco').api, {getExplorerCatalog});

function bindExplorer(api) {api.registerCatalog(getExplorerCatalog());}
Hooks.on('quedaco-explorador:ready',bindExplorer);
const available = game.modules.get('quedaco-explorador')?.api;
if (available) bindExplorer(available);
```

Se o Quedaço tiver um catálogo adicional de tags, incorpore-o sem alterar os IDs já usados. Não copiar resumos do livro para esta integração: apenas IDs, nomes e metadados necessários à seleção.

## 2. Abrir/controlar o Explorador pelo painel principal

Adicione no Mapa/Cena Atual: abrir Explorador da cena, consultar contagem, filtrar áreas sem região e definir localização do grupo. Mostre `hex.name || hex.label` e `hex.shortCode`. O ID longo fica apenas nos dados internos.

```js
const explorer = game.modules.get('quedaco-explorador')?.api;
explorer.open(sceneId);
const areas = explorer.listHexes(sceneId,{unassigned:true});
await explorer.setCurrentLocation(hexId); // Mestra
const contexto = explorer.getCampaignContext(); // location, date, timelineId
```

`hex.id` é o identificador permanente (`cena:linha:coluna`). `number/shortCode/label` são apresentação: podem mudar ao renumerar. Nunca vincular NPCs ou notas ao número ou nome. Não mudar a grade para cortar bordas: `setActive(ids,false)` desativa sem excluir conteúdo, e `renumberAreas(sceneId)` reorganiza somente a numeração visível.

## 3. NPCs: atribuição exata

No editor/cartão de NPC, inclua um seletor de mapa e de área com nomes legíveis. Para atribuir, chame:

```js
await explorer.assignNPC(actor.uuid,hex.id);
// Persistência no Actor: flags.quedaco.npc.explorerLocation = {sceneId,hexId}
const {present,regional} = explorer.getNPCs(hex.id);
await explorer.removeNPC(actor.uuid,hex.id); // retira apenas o vínculo exato
```

Preserve `explorerLocation` ao salvar outros campos do NPC. Preserve o formato de `regionId/placeId` atual. `assignNPC` também atualiza esses IDs quando a área os possui, sem mexer na ficha de regras.

`present` contém somente NPCs explicitamente atribuídos ao hex e legíveis para o usuário. `regional` é sugestão para a Mestra: NPCs da região sem atribuição exata. **Não afirmar que um NPC está no hex somente por pertencer à região.** A desativação de uma área preserva o vínculo para posterior reativação.

## 4. Regiões e edição em grupo

Para dividir o mapa, mantenha o catálogo do Quedaço como fonte dos IDs. A Mestra escolhe quais áreas pertencem a cada região; não deduzir a divisão pela imagem.

```js
await explorer.updateHexes(hexIds, {
  regionId:'mirmir', region:'Deserto de Mirmir', terrain:'Deserto'
});
await explorer.updateHexes(hexIds,{regionId:'',region:'',placeId:''}); // sem região
await explorer.updateHexes(hexIds,{tags:['rota']},{tagMode:'add'});
```

O Explorador já fornece essa edição em seu painel. O Quedaço pode consumir a API sem criar outra base de áreas ou outra grade.

## 5. Diário, calendário e localização

A Mestra define o local do grupo por `setCurrentLocation`. A nota criada pelo Explorador usa a data/linha do tempo do calendário e é salva no diário pessoal do autor com visibilidade pública. O compartilhamento segue as permissões e a sincronização já existentes no calendário, exigindo a Mestra conectada conforme suas regras atuais.

```js
const resultado = await explorer.createNote({
  title:'Chegada às ruínas', description:'Nossa primeira visita.'
});
const notas = explorer.listNotes(hex.id);
await explorer.openNote(notas[0].uuid);
```

Mestra pode fornecer `hexId` e `absoluteDay` para registrar outro lugar/data. Jogadores usam obrigatoriamente a localização do grupo e a data atual. A nota guarda `flags.quedaco-explorador.location` na página do diário e no espelho público, com `hexId, sceneId, regionId, name, authorId, absoluteDay, timelineId, dateLabel`. O nome é uma fotografia do momento; o vínculo permanente usa `hexId` e sobrevive à renumeração.

Para criar notas pelo **painel do Quedaço**, chame `createNote`, preservando o fluxo autoral do calendário. Para criar notas pela **tela própria do calendário**, ainda é preciso adaptar seu formulário para obter `getCampaignContext` e salvar o mesmo vínculo. Não afirmar que notas antigas ou criadas fora dessa API já possuem vínculo exato; texto livre de localidade não é equivalente ao ID.

Recomendação para atualizar o calendário: expor `saveLocationRecord(input)` como wrapper de `records.save(input)` e registrar o provedor via `explorer.registerNotesProvider({save: records.save})`. Hoje o Explorador tem fallback para o `createRecords` da versão inspecionada, sem registrar outra query ou provisionar outros diários. A fonte canônica das notas continua no calendário.

O Jornal da Queda permanece separado. Sua API atual só abre o aplicativo. Se uma edição de notícias precisar ser relacionada a uma área, defina esse contrato explicitamente na atualização do Jornal; não duplicar o diário pessoal nem publicar notas como edições compráveis.

## 6. Eventos e sincronização

Ouça `quedaco-explorador:locationChanged`, `hexSelected`, `hexUpdated`, `hexActiveChanged`, `areasRenumbered`, `npcLocationChanged`, `noteCreated` e `catalogChanged` para atualizações locais. Escute também `updateScene`, `updateActor`, `updateSetting` e eventos de Journal para refletir mudanças feitas por outros clientes.

As mutações exigem Mestra, exceto criação de notas no diário próprio pelas regras do calendário. Nunca abrir Actor/Journal sem checar permissões. Não ler diretamente flags ocultas para mostrá-las a jogadores.

## Critérios de aceitação da atualização do Quedaço

1. Mestra abre a área pelo painel principal e seleciona NPC/localização por nomes legíveis.
2. NPC atribuído aparece no Explorador e continua vinculado depois de desativar/reativar e renumerar.
3. Região sozinha não faz NPC aparecer como presença exata.
4. Alterar terreno/região de várias áreas preserva nomes, descrições e documentos vinculados.
5. Nota do jogador é salva no próprio diário, aparece para a mesa conforme permissões e tem data, linha do tempo e área estáveis.
6. Módulos ausentes produzem mensagem útil, sem impedir o restante do painel.
7. Conferir o fluxo em mundo de teste Foundry 13 antes de usar na campanha oficial.
