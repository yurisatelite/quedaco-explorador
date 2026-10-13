# Quedaço - Explorador

Módulo independente de Yuri para Foundry VTT 13. Versão 0.2.0, com identificação simples, seleção múltipla, áreas desativáveis e vínculos de região, NPCs e notas com o calendário. Implementação própria; a importação do World Explorer lê somente os dados salvos na cena.

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

Escolha uma cena com uma das quatro grades hexagonais nativas do Foundry. Clique **Ativar exploração**, ou abra a configuração da cena pelo diretório à direita e use a nova aba **Explorador**. O menu contém Exploração, Áreas, Configuração, Tags e Integrações. Jogadores têm acesso à consulta de cenas permitidas, sem botões de edição.

## Explorar

- Clique em um hex no painel ou use Selecionar na barra de ferramentas do canvas.
- Na barra do canvas, use Explorar, Parcial ou Ocultar. Clique para alterar um hex ou arraste para pintar vários de uma vez.
- No painel, dê um nome fantasia e edite terreno, região, tags e descrição. Sem nome personalizado, a área aparece como **Área 001**, com número curto **A001**. Códigos técnicos ficam internos.
- **Ctrl/Shift + clique** seleciona várias áreas. No canvas, use Selecionar e arraste uma caixa. Escolha terreno e região para a seleção; tags são adicionadas sem apagar as existentes.
- Use **Desativar** para retirar hexes de borda da exploração e da contagem. O conteúdo é guardado. **Mostrar desativadas** permite selecioná-las e **Reativar** restaura seu uso.
- Depois de definir as bordas, use **Configuração → Renumerar áreas ativas** se quiser números consecutivos. Isso muda apenas os números; nomes, NPCs, notas e demais dados permanecem no mesmo lugar. Reativar uma área cujo número foi reutilizado atribui outro número disponível.
- Use **Centralizar no canvas** para encontrar o hex no mapa completo. O zoom e a navegação são os nativos do Foundry.
- Na aba Áreas, busque por número, nome, região, terreno ou tag; filtre por estado, sem região ou desativadas.
- O mapa mostra nome/número só na seleção por padrão. Configuração permite ocultar todos ou mostrar todos os números curtos.
- Regiões, localidades e papéis de NPCs vêm do Quedaço quando está ativo. Crie tags próprias pelo menu **Tags**.
- Atribua um NPC pelo campo **Quem está aqui**. NPCs apenas pertencentes à região aparecem como sugestões para a Mestra; isso não afirma presença no hex.
- **Definir como local do grupo** determina a localização usada nas notas dos jogadores. **Nova nota pública** salva no diário pessoal do calendário com data, linha do tempo e vínculo à área, preservado ao renumerar. O calendário precisa estar ativo e compatível; o compartilhamento usa suas permissões normais.
- Na aba Integrações, importe os estados do World Explorer ou exporte os dados para JSON.

## Dados e limites

ID interno: `sceneId:linha:coluna`. As coordenadas são os offsets nativos `i/j`; nomes e números visíveis não alteram o ID. A persistência fica em `flags.quedaco-explorador`, schema 2, com configuração, assinatura da geometria e registros dos hexes. A migração de 0.1.0 mantém conteúdo e IDs existentes. Atualizações da cena sincronizam a interface dos clientes pelo próprio Foundry.

Hex oculto tem cobertura opaca para jogadores. Parcial tem cobertura translúcida; explorado tem cobertura transparente. Para a Mestra, a opacidade é configurável. A cobertura é desenhada sobre a interface do canvas e não substitui a névoa, iluminação ou visão nativas, nem é um mecanismo de proteção do arquivo da imagem.

**Descrições e metadados são dados compartilhados da cena.** A interface e a API de consulta omitem metadados de hexes não explorados para jogadores, mas isso não torna as flags secretas. Guarde segredos em diários privados e mantenha suas permissões. Vínculos só abrem documentos com permissão OBSERVER. A cobertura também não oculta automaticamente fichas, chat ou outros documentos do mundo.

A versão 0.2.0 limita cada mapa a 5.000 hexes. Listas mostram até 200 resultados por busca. Grades quadradas e cenas sem grade devem ser convertidas nas configurações do Foundry. Mudar o tamanho, orientação, limites ou posição da grade invalida a assinatura: restaure a configuração original para preservar os vínculos. Nesse caso, jogadores recebem cobertura integral no canvas até a correção; a Mestra pode desativar a exploração. Desativar áreas de borda não altera a geometria.

A importação mantém os dados originais de `flags.world-explorer.gridData` e preenche apenas hexes sem registro no Explorador. Hexes fora dos limites, dados inválidos e registros já editados são ignorados. A importação é manual, não uma integração contínua. Evite habilitar as duas coberturas simultaneamente na mesma cena.

Ainda não há viagem automática de tokens, custo/tempo de jornada, pincel contínuo com interpolação, revelação por movimento, importação de JSON exportado ou undo. As telas do Quedaço principal e do Jornal da Queda ainda precisam consumir a API; notas criadas diretamente pela tela do calendário ainda precisam da adaptação de localização. O contrato e a instrução pronta para essas atualizações estão em [docs/INTEGRACAO-QUEDACO.md](docs/INTEGRACAO-QUEDACO.md).

## Desenvolvimento e verificação

```powershell
npm install
npm test
npm run package
node tools/preview-server.mjs
```

Prévia local: `http://127.0.0.1:3187`. Usa dados fictícios e não acessa o mundo da campanha. A suíte verifica dados, permissões, filas de persistência, pintura em lote, migração e interface com substitutos das APIs do Foundry. A integração gráfica final precisa ser conferida no Foundry 13 real; testes locais não substituem esse passo.
