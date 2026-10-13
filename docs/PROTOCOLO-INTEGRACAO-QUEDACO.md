# PROTOCOLO DE INTEGRAÇÃO QUEDAÇO

Instrução do Yuri para a próxima atualização de cada módulo, recebida em 13/10/2026. Este documento registra o requisito; não declara sua implementação na versão publicada 0.2.0.

Este módulo pertence à família de módulos QUEDAÇO.

## Objetivo

O QUEDAÇO principal deve conseguir reconhecer este módulo automaticamente, identificar suas funções e abrir sua interface quando necessário. O módulo deve continuar funcionando sozinho quando os outros módulos QUEDAÇO não estiverem instalados ou ativos.

## Identidade

Use um identificador exclusivo iniciado por "quedaco-". Não reutilize o id de outro módulo. O título deve começar com "QUEDAÇO - ".

No module.json, mantenha o id, title e version corretos. Se houver uma integração opcional com outro módulo, declare-a em relationships.modules, mas não transforme o outro módulo em dependência obrigatória.

## API pública obrigatória

No Hook ready, registre em game.modules.get(MODULE_ID).api um objeto com este formato:

```js
const MODULE_ID = "id-do-modulo";

Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);

  const descriptor = Object.freeze({
    family: "quedaco",
    contractVersion: 1,
    id: MODULE_ID,
    title: module.title,
    version: module.version,

    capabilities: {
      // Coloque aqui somente funções que este módulo realmente oferece.
      // Exemplos:
      // characterCreator: true,
      // newspaper: true,
      // calendar: true,
      // currentDate: true,
      // currentTime: true,
      // mapAtlas: true,
      // sceneLinks: true,
      // npcDatabase: true
    },

    open() {
      // Abra a tela principal deste módulo.
      // Exemplo: return openCharacterCreator();
    },

    getStatus() {
      return {
        ready: true
      };
    }
  });

  module.api = descriptor;
  Hooks.callAll("quedaco:register", descriptor);
});
```

## Regras da API

1. O campo family deve ser exatamente "quedaco".
2. O campo contractVersion deve ser exatamente 1 nesta primeira versão.
3. O id deve ser o id real do module.json.
4. capabilities deve conter somente chaves booleanas que indiquem funções disponíveis.
5. open() deve abrir a interface principal do próprio módulo.
6. getStatus() deve ser somente leitura e nunca alterar dados do mundo.
7. Não exponha senhas, chaves de API, dados privados, documentos inteiros ou informações que jogadores não poderiam consultar.
8. Não importe arquivos diretamente de outro módulo QUEDAÇO. Use a API pública quando uma integração for necessária.
9. O módulo deve funcionar mesmo se game.modules.get("quedaco") não existir.
10. Métodos que gravam dados devem verificar a permissão do usuário dentro do próprio módulo.

## Integrações opcionais

Quando este módulo precisar consultar outro, localize-o pela API:

```js
const outro = game.modules.get("id-do-outro-modulo")?.api;

if (outro?.family === "quedaco" && outro.capabilities?.algumaFuncao) {
  // Use somente o método público oferecido pela API.
}
```

Nunca presuma que outro módulo está ativo. Sempre trate a API ausente como uma situação normal e mantenha a funcionalidade básica disponível.

## Exemplos de capabilities

Criador de personagens:

```js
capabilities: {
  characterCreator: true,
  createActor: true,
  editCharacter: true,
  listLegacies: true
}
```

Jornal da Queda:

```js
capabilities: {
  newspaper: true,
  createEdition: true,
  purchaseEdition: true,
  playerJournalDelivery: true
}
```

Calendário Skyfall:

```js
capabilities: {
  calendar: true,
  currentDate: true,
  currentTime: true,
  advanceTime: true,
  daylightControl: true
}
```

Mapa Imersivo:

```js
capabilities: {
  mapAtlas: true,
  sceneLinks: true,
  localityDatabase: true,
  combatMaps: true
}
```

## Entrega obrigatória da atualização

Ao terminar, informe no diário ou changelog:

- o id do módulo;
- a versão do contractVersion usado;
- todas as capabilities publicadas;
- quais métodos públicos foram expostos;
- quais integrações opcionais foram reconhecidas;
- quais funções continuam disponíveis sem outros módulos.

## Teste mínimo

Verifique que:

1. game.modules.get(MODULE_ID).api existe depois do ready;
2. api.family === "quedaco";
3. api.contractVersion === 1;
4. cada capability declarada corresponde a uma função real;
5. Hooks.callAll("quedaco:register", descriptor) é emitido;
6. o módulo não quebra quando o QUEDAÇO principal está desativado;
7. o módulo não cria, altera ou exclui documentos pertencentes a outro módulo.

Não publique chaves privadas, macros privadas, texto protegido de livros ou imagens protegidas no repositório.
