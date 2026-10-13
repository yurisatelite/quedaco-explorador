# Quedaço - Explorador

Módulo independente de Yuri para Foundry VTT 13. Versão inicial 0.1.0, com menu lateral, mapa clicável, identificação estável dos hexes, cobertura de exploração, editor e API pública. Implementação própria; a importação do World Explorer lê somente os dados salvos na cena.

## Instalar

No Foundry, abra **Add-on Modules → Install Module**, cole o endereço abaixo no campo **Manifest URL** e clique **Install**:

```text
https://github.com/yurisatelite/quedaco-explorador/releases/latest/download/module.json
```

Depois ative **Quedaço - Explorador** em Gerenciar Módulos no mundo. Para instalação manual, extraia `quedaco-explorador.zip` em `Data/modules/quedaco-explorador`, mantendo `module.json` na raiz dessa pasta, e reinicie o Foundry.

Abra pelo botão no diretório de Cenas, pela bússola nas ferramentas do canvas ou por macro:

```js
game.modules.get('quedaco-explorador').api.open();
```

Escolha uma cena com uma das quatro grades hexagonais nativas do Foundry. Clique **Ativar exploração**. O menu contém Exploração, Hexes, Configuração e Integrações. Jogadores têm acesso à consulta de cenas permitidas, sem botões de edição.

## Explorar

- Clique em um hex no painel ou use Selecionar na barra de ferramentas do canvas.
- Na barra do canvas, use Explorar, Parcial ou Ocultar. Clique para alterar um hex ou arraste para pintar vários de uma vez.
- No painel, edite nome, terreno, região, tags, descrição e UUIDs de uma cena/diário do mundo. Clique **Salvar hex**.
- Use **Centralizar no canvas** para encontrar o hex no mapa completo. O zoom e a navegação são os nativos do Foundry.
- Na aba Hexes, busque por ID, nome, região, terreno ou tag; filtre por estado.
- Na aba Integrações, importe os estados do World Explorer ou exporte os dados para JSON.

## Dados e limites

ID: `sceneId:linha:coluna`. As coordenadas são os offsets nativos `i/j`; nomes e metadados não alteram o ID. A persistência fica em `flags.quedaco-explorador`, com schema, configuração, assinatura da geometria e registros esparsos dos hexes. Atualizações da cena sincronizam a interface dos clientes pelo próprio Foundry.

Hex oculto tem cobertura opaca para jogadores. Parcial tem cobertura translúcida; explorado tem cobertura transparente. Para a Mestra, a opacidade é configurável. A cobertura é desenhada sobre a interface do canvas e não substitui a névoa, iluminação ou visão nativas, nem é um mecanismo de proteção do arquivo da imagem.

**Descrições e metadados são dados compartilhados da cena.** A interface e a API de consulta omitem metadados de hexes não explorados para jogadores, mas isso não torna as flags secretas. Guarde segredos em diários privados e mantenha suas permissões. Vínculos só abrem documentos com permissão OBSERVER. A cobertura também não oculta automaticamente fichas, chat ou outros documentos do mundo.

A versão 0.1.0 limita cada mapa a 5.000 hexes. Listas mostram até 200 resultados por busca. Grades quadradas e cenas sem grade devem ser convertidas nas configurações do Foundry. Mudar o tamanho, orientação, limites ou posição da grade invalida a assinatura: restaure a configuração original para preservar os vínculos. Nesse caso, jogadores recebem cobertura integral no canvas até a correção; a Mestra pode desativar a exploração.

A importação mantém os dados originais de `flags.world-explorer.gridData` e preenche apenas hexes sem registro no Explorador. Hexes fora dos limites, dados inválidos e registros já editados são ignorados. A importação é manual, não uma integração contínua. Evite habilitar as duas coberturas simultaneamente na mesma cena.

Ainda não há viagem automática de tokens, custo/tempo de jornada, pincel contínuo com interpolação, revelação por movimento, importação de JSON exportado, undo ou conexão automática com as telas dos outros módulos. Os contratos para essas integrações estão em [docs/API.md](docs/API.md).

## Desenvolvimento e verificação

```powershell
npm install
npm test
npm run package
node tools/preview-server.mjs
```

Prévia local: `http://127.0.0.1:3187`. Usa dados fictícios e não acessa o mundo da campanha. A suíte verifica dados, permissões, filas de persistência, pintura em lote, migração e interface com substitutos das APIs do Foundry. A integração gráfica final precisa ser conferida no Foundry 13 real; testes locais não substituem esse passo.
