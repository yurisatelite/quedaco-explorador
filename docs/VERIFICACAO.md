# Verificação · 13/10/2026

Fonte: repositório `yurisatelite/quedaco-explorador`. O módulo foi implementado separadamente dos outros módulos da campanha. Nenhum mundo, Ator ou documento remoto foi alterado.

- 19 testes Node aprovados: IDs, dados, limites, leitura dos estados legados, permissões, fila de edição, pintura em lote, preservação de cadastros na importação, controles de canvas, cobertura conservadora em caso de geometria inválida, templates e eventos de interface.
- Todos os arquivos de runtime `src/*.mjs` passaram por `node --check`.
- Conferência em Chrome headless da prévia: selecionar hex, cadastrar nome/região, explorar, buscar na lista, salvar configuração, abrir integrações e alternar para consulta de jogador.
- Revisão visual das capturas da prévia. Dados são fictícios e o ambiente usa substitutos do Foundry.
- Pacote de instalação manual com `module.json` na raiz; não contém ferramentas de desenvolvimento, testes ou dependências Node.

## Conferência que falta no Foundry real

1. Instalar o ZIP em um mundo de teste Foundry 13 e habilitar o módulo.
2. Conferir o encaixe dos polígonos nas quatro orientações/paridades de grade hexagonal, incluindo padding e deslocamento do fundo.
3. Ativar a bússola; selecionar e pintar por clique/arraste; trocar de ferramenta e de cena.
4. Recarregar e conferir a persistência; conectar um cliente jogador e conferir sincronização, cobertura e permissões de documentos vinculados.
5. Importar uma cena de teste com estados salvos pelo World Explorer e verificar a preservação do dado original.

As integrações automáticas com as telas de NPCs, tabelas, calendário ou painel de campanha não foram alteradas nesta entrega. O ponto de conexão está na API e nos hooks documentados.
