# Verificação · 13/10/2026

Fonte: repositório `yurisatelite/quedaco-explorador`. O módulo foi implementado separadamente dos outros módulos da campanha. Nenhum mundo, Ator ou documento remoto foi alterado.

- 33 testes Node aprovados: inclui desativação/renumeração sem perda de conteúdo, edição em lote, catálogo do Quedaço, NPCs exatos versus sugestões regionais, notas com data/localidade, permissões, espelhos sem duplicação e configuração nativa da cena.
- Todos os arquivos de runtime `src/*.mjs` passaram por `node --check`.
- Conferência em Chrome headless: seleção múltipla, terreno/região em lote, desativação de borda, contagem, renumeração, nota datada, criação de tags, filtros, configuração e consulta de jogador.
- Revisão visual das capturas da prévia. Dados são fictícios e o ambiente usa substitutos do Foundry.
- Pacote de instalação manual com `module.json` na raiz; não contém ferramentas de desenvolvimento, testes ou dependências Node.

## Conferência que falta no Foundry real

1. Instalar o ZIP em um mundo de teste Foundry 13 e habilitar o módulo.
2. Conferir o encaixe dos polígonos nas quatro orientações/paridades de grade hexagonal, incluindo padding e deslocamento do fundo.
3. Ativar a bússola; selecionar e pintar por clique/arraste; trocar de ferramenta e de cena.
4. Recarregar e conferir a persistência; conectar um cliente jogador e conferir sincronização, cobertura e permissões de documentos vinculados.
5. Importar uma cena de teste com estados salvos pelo World Explorer e verificar a preservação do dado original.

O Explorador já consulta o catálogo do Quedaço, persiste atribuições de NPCs e cria notas pelo diário do calendário. As telas dos módulos externos não foram alteradas. A instrução para o Quedaço assumir o controle central está em INTEGRACAO-QUEDACO.md; é necessária adaptação adicional para capturar localização em notas criadas fora do Explorador. Integração real de calendários, espelhos públicos e múltiplos clientes ainda precisa de conferência em mundo de teste.
