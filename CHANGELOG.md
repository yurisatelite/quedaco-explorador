# Histórico

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
