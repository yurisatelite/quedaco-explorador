# QUEDAÇO UI — padrão visual v1

Este é o padrão reutilizável da família de módulos. A referência implementada é o
criador de personagens. Outros módulos podem carregar `styles/quedaco-ui.css`
antes de seus estilos e adicionar a classe `qd-ui` somente às suas aplicações.
Isso não aplica estilos globais ao Foundry nem exige um módulo extra.

Componentes disponíveis: `qd-button`, `qd-button--primary`, `qd-panel`, `qd-fields`
e `qd-equal-cards`. Os cartões iguais usam três colunas por padrão, configuráveis
com `--qd-columns`. O criador usa o botão principal e os cartões de moeda como
referência; classes `sy-*` tratam apenas do contexto específico de personagens.

## Hierarquia e componentes

- Uma ação principal por tela, no rodapé fixo: continuar, gerar prévia, salvar ou criar.
- Voltar, editar, sortear novamente e ferramentas são ações secundárias.
- Informações equivalentes recebem cartões equivalentes. K$, P$ e T$ usam três
  colunas iguais; nenhuma moeda ocupa uma linha maior por sobra de espaço.
- Conteúdo da escolha atual recebe a maior área; resumo é apoio, não formulário.
- Títulos: 28px; abertura: 36px; corpo: 14px; campos: 13px; metadados: 10–12px.
- Corpo com peso 400, rótulos 500 e ações/títulos de destaque 600. A fonte dos
  ícones do Foundry não deve ser sobrescrita por `font: inherit` indiscriminadamente.
- Espaçamento: 4, 8, 12, 16, 24 e 32px. Controles comuns com 40px de altura;
  ferramentas compactas com 30–34px, ajuda com 24px e rótulo acessível.
- Fundo, painel e superfície elevada têm contraste progressivo; ciano identifica
  seleção/ação, âmbar identifica pendências e verde confirma conclusão. Cor nunca
  é a única indicação de estado: incluir texto, marca ou atributo acessível.

## Composição e adaptação

Use consultas ao container da aplicação: o usuário pode encolher uma janela num
monitor grande. Não use apenas consultas ao viewport para decidir as colunas.
No criador: acima de 1000px aparecem navegação, formulário e resumo; abaixo disso
o resumo abre sob demanda; abaixo de 650px a navegação vira um seletor de etapas.
Cabeçalho e rodapé permanecem acessíveis. O conteúdo central rola quando necessário.
Não forçar a janela para tela cheia via `width/height: ... !important`.

A marca no cabeçalho é tipográfica, sem fundo embutido em PNG. Fechar, minimizar
e ajustar à tela têm símbolos de texto, nome acessível e ações nativas do Foundry.
Minimização não pode herdar a altura mínima da aplicação aberta.

## Aplicação aos próximos módulos

Reutilizar tokens `--qd-*`, escala de espaçamento e pesos. Construir componentes
com escopo próprio do módulo. Validar tela ampla, janela de 800px, janela de 360px,
janela minimizada, foco por teclado e preferência por movimento reduzido.
O padrão não redefine as regras ou os dados de cada módulo.

## Integração neste módulo

Aplicado em Explorador (`quedaco-explorador`). A aparência é ativada por `src/quedaco-ui.mjs`, com escopo próprio, símbolos de janela, destaque da ação principal e cartões de moedas equivalentes. Os estilos específicos ficam em `styles/quedaco-family.css`, carregados após os estilos originais.

Esta alteração não lê nem grava Actors, Items, Scenes, permissões, saldos ou configurações. Os comportamentos e dados de jogo são preservados. A validação cobre os testes do projeto e layouts representativos; a conferência na mesa real continua recomendada.

