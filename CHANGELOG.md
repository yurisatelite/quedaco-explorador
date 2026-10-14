# Histórico

## 0.3.3 · 13/10/2026

- Vermelho a 50% somente na prévia administrativa do Explorador.
- No canvas, hexes desativados recebem cobertura escura, opaca para jogadores, mesmo se anteriormente explorados.
- Painel administrativo e botão de abertura exclusivos da Mestra; APIs de notas continuam disponíveis para integrações.

## 0.3.2 · 13/10/2026

- Ferramenta Explorar alterna revelação por clique; clique direito oculta sem desativar a área.
- Desativação de bordas permanece no painel; áreas desativadas aparecem em vermelho a 50% para a Mestra.
- Anotações exigem área ativa e explorada. Formulário oferece nota pessoal ou pública, com título padrão pelo HEX.
- Data atual via API do Calendário; sem ele, data manual Skyfall e diário próprio do Explorador, com permissões nativas. Jogadores precisam da permissão de criar diários nesse modo.
- Integrações opcionais e contrato QUEDAÇO v1 preservados. Clima aguarda módulo próprio.

## 0.3.0 · 13/10/2026 · Protocolo de Integração QUEDAÇO

- Título `QUEDAÇO - Explorador`; id `quedaco-explorador` preservado. Dados salvos nas cenas intactos.
- `contractVersion`: 1. Capabilities: `mapExplorer`, `areaDatabase`, `currentLocation`, `npcPlacement`, `areaNotes`.
- Métodos públicos: `open`, `getStatus` e a API de áreas já existente (getHex, listHexes, updateHex, setActive, renumberAreas, selectHex…) mais controle de campanha (getCatalog, createTag, getNPCs, assignNPC, removeNPC, setCurrentLocation, getCampaignContext, listNotes, createNote, openNote).
- Integrações opcionais (só por API pública, verificando family/contractVersion/capability): QUEDAÇO principal (`npcDatabase`, `explorerCatalog`, `npcLocation`) e QUEDAÇO - Calendário (`calendar`, `saveLocationRecord`, `listPlaceNotes`, `openRecord`).
- Removidos os imports de arquivos de outros módulos, as gravações em flags de Actors e o espelhamento de diários: NPCs são atribuídos pelo QUEDAÇO e as notas ficam com o Calendário (o Explorador só informa o local).
- Sem os outros módulos: exploração, nomes/números, bordas, seleção múltipla, terreno, regiões, tags locais e localização do grupo continuam funcionando; as funções integradas avisam que estão indisponíveis.
- Evento `quedaco:register` emitido com o descritor congelado; `quedaco-explorador:ready` mantido.
- Requer QUEDAÇO ≥ 0.15.0 e Calendário ≥ 0.3.1 para as funções integradas.

## 0.2.0 · 13/10/2026

- Aba Explorador na configuração nativa da cena, com os campos salvos pelo botão normal do Foundry.
- Identificação visual simples: Área 001/A001 ou nome fantasia; nomes no mapa aparecem só na seleção por padrão.
- Bordas desativáveis sem alterar a grade, excluir cadastros ou mover vínculos. Desativadas saem da contagem e podem ser reativadas.
- Numeração visível persistente, com renumeração opcional das áreas ativas independente do ID interno.
- Seleção múltipla por Ctrl/Shift + clique ou caixa no canvas; aplicação em lote de terreno, região e tags.
- Catálogo de regiões/localidades/papéis do Quedaço e criação de tags próprias.
- Atribuição exata de NPCs por área, distinguindo presença de NPCs apenas cadastrados na região.
- Localização do grupo definida pela Mestra; notas públicas no diário pessoal do calendário com data, linha do tempo e vínculo estável à área.
- API de controle da campanha e instrução para atualização do módulo principal em docs/INTEGRACAO-QUEDACO.md.
- Migração preserva dados 0.1.0. Testes locais e de navegador aprovados; conferência do fluxo completo no Foundry real segue pendente.

## 0.1.0 · 13/10/2026

- Módulo independente Quedaço - Explorador, autoria Yuri.
- Menu lateral com Exploração, Hexes, Configuração e Integrações.
- Prévia hexagonal clicável e camada de interação no canvas do Foundry 13.
- Identificação por cena/linha/coluna; edição de nome, terreno, região, tags, descrição e documentos vinculados.
- Estados oculto, parcial e explorado, com pintura em lote por arraste.
- Consulta para jogadores e ações de edição restritas à Mestra.
- API pública, hooks, exportação JSON e importação não destrutiva de estados salvos no World Explorer.
- Testes locais e prévia com dados fictícios. Conferência em mundo real ainda pendente.
