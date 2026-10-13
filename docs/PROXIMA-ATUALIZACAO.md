# Próxima atualização do Explorador

Requisito confirmado pelo Yuri em 13/10/2026: aplicar o [Protocolo de Integração Quedaço](PROTOCOLO-INTEGRACAO-QUEDACO.md). A versão publicada continua 0.2.0; esta fila não é uma release nem comprova conformidade atual.

## Trabalho obrigatório

- Manter o ID exclusivo `quedaco-explorador` e padronizar o título para `QUEDAÇO - Explorador` no manifesto e nas interfaces.
- Publicar depois de ready o descriptor congelado com `family: "quedaco"`, `contractVersion: 1`, id/title/version do módulo, capabilities booleanas, `open()` e `getStatus()` somente leitura.
- Preservar os métodos públicos existentes compatíveis ao compor o descriptor, antes de congelar. Não substituir a API por um objeto que descarte edição de áreas, seleção ou vínculos existentes.
- Emitir `quedaco:register` com o descriptor final. Manter os eventos específicos do Explorador para consumidores existentes.
- Declarar somente funcionalidades reais. Avaliar `mapAtlas`, `sceneLinks` e `localityDatabase` contra os métodos e testes existentes. Não copiar exemplos de capabilities de calendário, criador, jornal ou banco de NPCs como se fossem funções próprias deste módulo.
- Remover de `src/campaign.mjs` os fallbacks que importam `book-world.mjs`, `npcs.mjs` e `records.mjs` de outros módulos. Remover também a injeção dessas importações em `src/main.mjs`. Consultar apenas APIs públicas de módulos ativos, verificando family/contractVersion/capability/método necessário.
- Ajustar integrações opcionais conforme o protocolo e validar o campo de manifesto `relationships.modules` contra o schema da versão Foundry alvo antes de empacotar. Não criar dependências obrigatórias ou adicionar um campo ignorado pelo Foundry sem registrar essa incompatibilidade.
- Repassar atribuição/remoção de NPCs à API pública do Quedaço que é dona desses documentos. O Explorador não deve gravar diretamente nas flags dos Actors de outro módulo.
- Repassar criação de notas e persistência de localidade/espelhos à API pública do calendário que é dona dos diários. Remover as gravações diretas em páginas/espelhos externos, inclusive `mirrorLocation` e o hook correspondente. A API proprietária deve verificar permissões e devolver somente dados autorizados/identificadores.
- Enquanto a API opcional não existir ou não cumprir o contrato, manter exploração, nomes/números, bordas, seleção múltipla, terreno, regiões cadastradas, tags locais e persistência própria funcionando. Informar indisponibilidade apenas da função integrada solicitada; não falhar na inicialização.
- Preservar os IDs internos, nomes, números, conteúdo e vínculos já salvos nas cenas. Não renomear outros módulos ou migrar seus documentos por iniciativa deste módulo.
- Revisar os métodos de consulta e getStatus para não retornar documentos completos, segredos, notas privadas de terceiros ou dados de NPCs sem permissão.

## Testes de aceitação

- API registrada após ready; family/id/contractVersion corretos; descriptor congelado; `quedaco:register` emitido com esse mesmo objeto.
- Cada capability declarada ligada a uma função real, testada e descrita no changelog.
- getStatus não chama nenhum setter, criação, atualização ou exclusão de documentos.
- QUEDAÇO principal ausente, instalado/desativado e ativo com API incompatível: funcionalidade própria segue disponível.
- Calendário ausente ou incompatível: exploração segue disponível e a ação de nota apresenta indisponibilidade apropriada.
- Nenhuma importação de arquivos de outros módulos; nenhuma mutação direta de seus documentos. Usar doubles que falhem se esses imports ou writes forem tentados pelo Explorador.
- As integrações funcionam por chamadas aos provedores públicos, com permissões validadas dentro do módulo proprietário.
- Testes atuais de IDs e preservação de dados ao desativar/renumerar continuam passando.

## Entrega

No changelog da versão implementada, registrar id, contractVersion, capabilities finais, métodos expostos, integrações reconhecidas e funções disponíveis sem outros módulos. Preparar manifesto/pacote coerentes e informar separadamente o que foi testado no Foundry real.

As recomendações anteriores em INTEGRACAO-QUEDACO.md sobre imports diretos e escrita de documentos externos estão superadas por este protocolo. O objetivo de o Quedaço principal controlar a campanha permanece.
