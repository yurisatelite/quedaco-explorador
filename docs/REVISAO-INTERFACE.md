# Revisão da interface · 15/10/2026

Compatibilidade mantida: Foundry VTT 13. A skill foundry-vtt-module-dev orientou a revisão de ApplicationV2, isolamento de estilos e acessibilidade; recursos exclusivos da versão 14 não foram introduzidos.

## Causas corrigidas

- Altura mínima de 560px no conteúdo, combinada com overflow oculto na janela, impedia alcançar áreas em janelas baixas.
- Breakpoint de viewport não acompanhava o redimensionamento da ApplicationV2 dentro do navegador.
- Dimensões mínimas intrínsecas de campos, nomes e itens de flex/grid alargavam as colunas.
- Botões comuns podiam herdar largura/altura e flex do núcleo do Foundry; agora têm dimensões pelo conteúdo. Navegação, linhas de áreas e cartões de notas conservam largura completa por intenção.
- Espaçamentos duplicados de checkboxes e margens de campos dentro de details foram consolidados.
- Formulários, listas, grupos de botões e tags passam a quebrar linha; caixas de data têm limites e espaçamento próprios.

## Verificação

`npm test` verifica os fluxos existentes. `tools/check-preview.mjs` usa Chrome headless, percorre ações de seleção, edição, revelação, notas e filtros e verifica limites horizontais em todas as abas nas larguras 1000, 760, 520 e 360px, incluindo janelas de 480px de altura, textos longos e detalhes abertos. Capturas ficam em `artifacts/` (fora do pacote).

A prévia não executa o núcleo do Foundry. Confirmar na sessão real: estilos herdados do sistema e de outros módulos, moldura e redimensionamento nativos, a aba da configuração de cena e escala de interface. Nenhuma regra de exploração, permissão ou persistência foi alterada nesta revisão.

## Ajuste adicional (especificidade)

A regra base de botões usava `.qe-app .qe-shell button`, mais específica que `.qe-primary` e que o item ativo do menu, apagando esses destaques. Como o CSS do núcleo do Foundry 13 fica em `@layer`, o CSS do módulo (sem camada) já prevalece; os seletores voltaram a ser simples (`.qe-app button`). O título do topo é limitado a 3 linhas para nomes de cena muito longos.
