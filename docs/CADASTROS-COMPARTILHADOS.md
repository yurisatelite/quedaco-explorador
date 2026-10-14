# QUEDAÇO — Cadastros compartilhados

Implementado em 14/10/2026, versão 0.18.0. O QUEDAÇO é proprietário da identidade geográfica e das classificações compartilhadas. Cada satélite continua funcionando sozinho e guarda seus próprios documentos.

## Uso pela Mestra

Abra QUEDAÇO → Módulos → **Cadastros compartilhados**. Escolha Regiões, Localidades, Tags ou Climas. Selecione uma entrada para editar ou deixe a seleção vazia para criar. O botão Salvar é o único ponto de gravação; Fechar descarta o formulário. O ID é imutável durante edição. Use Inativo para retirar uma entrada das listas conservando suas referências.

Novas entradas começam como “Só Mestra”. A API omite essas entradas para jogadores, incluindo filhos de localidades restritas. Esta é filtragem da API; settings de mundo do Foundry não são um armazenamento confidencial. Nunca coloque segredos de aventura ou textos privados neste cadastro.

Aliases ajudam a localizar grafias alternativas. Resultados ambíguos retornam null, sem adivinhar. Localidade-pai deve pertencer à mesma região e a hierarquia não aceita ciclos. Capital deve ser uma localidade da própria região. Tags e clima precisam existir antes de serem vinculados.

Perfis iniciais: Temperado, Frio, Árido, Úmido e Mágico / variável. São categorias configuráveis da campanha. Não há atribuição presumida de clima às regiões, tabela meteorológica oficial nem aplicação automática de modificadores. O clima de uma localidade pode herdar do local-pai ou da região por getEnvironment.

## Contrato público para copiar nos outros chats

Ao integrar seu módulo ao QUEDAÇO, consulte exclusivamente a API pública de um módulo ativo. Não importe arquivos do principal, não copie seus settings e não escreva em flags de outro proprietário.

```js
const module = game.modules.get('quedaco');
const api = module?.active && module.api?.family === 'quedaco'
  && module.api?.capabilities?.worldCatalog === true ? module.api : null;
const catalog = api?.getWorldCatalog();
```

Se o principal estiver ausente, use seu catálogo local ou permita configuração manual. A instalação não exige outro módulo da família.

API disponível:

| Método | Resultado |
|---|---|
| getWorldCatalog({includeInactive:false}) | schemaVersion, revision, regions, places, tags, climates, beyond |
| listRegions() | Regiões ativas com IDs, nomes, capitalId, cor, aliases, tags, climateId e imageKey |
| listPlaces({regionId}) | Localidades ativas com regionId, parentId, kind e metadados |
| getPlace(id) | Localidade ou null |
| listTags({category}) | Tags com id, name, label e categoria |
| listClimates() | Perfis configurados, sem regras mecânicas |
| resolveLocality(idOuAlias) | Região/localidade única ou null |
| getEnvironment(placeId) | Clima local/herdado e ID da origem, ou null |
| getImageKey('region' ou 'place', id) | Chave canônica; não presume caminho de arquivo |
| getMapLinks(placeId) | Cenas diretamente vinculadas e acessíveis; não revela cenas ocultas |
| upsertCatalogRecord(grupo, registro, {expectedRevision}) | Cria/edita pelo proprietário; somente Mestra |
| getExplorerCatalog() | Adaptador de compatibilidade: regions, places, tags |
| familyRegistry.list/open/withCapability | Registro da família |

`family` é a string `quedaco`. O objeto de registro agora se chama `familyRegistry`, corrigindo a colisão de nomes do contrato anterior. Versão do contrato de descoberta continua 1; versão do esquema de dados é 1, independente da versão do módulo.

Grupos aceitos por upsertCatalogRecord: regions, places, tags, climates. Registros públicos devem informar visibility:'public'; os novos registros privados recebem visibility:'gm'. Todos os retornos são dados destacados, sem objetos Foundry ou referências mutáveis ao armazenamento. O serviço serializa gravações do mesmo cliente. expectedRevision rejeita formulários desatualizados; a fila não é uma transação distribuída entre múltiplos GMs.

Exemplo de nova tag:

```js
await api.upsertCatalogRecord('tags', {
  id:'content:rumor', name:'Rumor', category:'content', visibility:'public'
}, {expectedRevision:api.getWorldCatalog().revision});
```

Após salvar, o setting de mundo dispara `quedaco:catalog-updated` em cada cliente, com schemaVersion e revision. Quem consome deve consultar novamente a API. Não substitua uma edição em andamento: atualize apenas listas ou a próxima abertura. Preserve IDs antigos nos documentos; renomear não altera a identidade.

## Integrações entregues

- Principal: NPCs, seletores de região/localidade e Mapa Imersivo usam o catálogo agregado; dados narrativos existentes são preservados.
- World Explorer 0.3.4: consulta a base ao vivo, acompanha o evento e delega novas tags ao principal. Sem ele, mantém o cadastro local. Tags locais antigas permanecem para preservar hexes já salvos.
- Jornal 0.3.6: prioriza a geografia central e mantém fallback. Novas gravações preservam regionId/placeId junto aos nomes usados na edição. Edições antigas não são regravadas em massa.
- Tabelas 0.4.2: ponte pública fornece regiões, localidades, tags e climas. O evento atualiza a interface quando aberta. A geração meteorológica existente continua própria do módulo; perfil de clima não é uma tabela de resultados.
- Calendário: permanece proprietário de data, hora e diário. O Explorador aceita APIs válidas nos IDs quedaco-calendario e quedaco-calendar. Não migra calendários nem seus dados.

## Próximas extensões

Missões, criador de monstros e módulos novos podem consumir o contrato acima sem editar o núcleo. Estoque, edição de jornal, missão, tempo atual, descoberta de hexes e ficha são dados dos respectivos proprietários. APIs especializadas de guildas, habitats, tabelas meteorológicas, licença de assets e estado de iluminação podem ser adicionadas depois com capabilities próprias. Não tratar esses recursos como já implementados no worldCatalog.

## Validação

Testes com dados falsos: integridade do catálogo, clones, aliases, referências inválidas, ciclos, fontes, inativação, permissão de escrita, revisão desatualizada, fila de gravações, eventos e cenas acessíveis. Testes das pontes confirmam fallback e consulta ao vivo. npm test e empacotamento executados em cada repositório; Stylelint no principal.

Conferência pendente no Foundry 13: abrir o editor, criar localidade de teste, editar/inativar, verificar o catálogo em dois clientes, observar atualização no Explorador/Jornal/Tabelas e confirmar que um rascunho aberto não perde texto. Nenhum documento do mundo oficial foi criado ou modificado para desenvolver esta entrega.
