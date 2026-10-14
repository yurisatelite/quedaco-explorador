import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignBridge} from '../src/campaign.mjs';

test('Explorador consulta cadastro central ao vivo e delega criação de tag ao dono',async()=>{
  let label='Primeira';const writes=[];
  const provider={family:'quedaco',contractVersion:1,id:'quedaco',capabilities:{worldCatalog:true},getWorldCatalog:()=>({regions:[],places:[],tags:[{id:'central',label}],climates:[]}),upsertCatalogRecord:async(...args)=>{writes.push(args);return {id:args[1].id,label:args[1].name};}};
  const game={user:{isGM:true},modules:new Map([['quedaco',{active:true,api:provider}]]),settings:{get:()=>[],set:()=>{throw Error('Não deve escrever cópia local');}}};
  const bridge=createCampaignBridge(game,{});assert.equal(bridge.getCatalog().tags[0].label,'Primeira');
  label='Atualizada';assert.equal(bridge.getCatalog().tags[0].label,'Atualizada');
  assert.equal((await bridge.createTag('Caverna')).id,'content:caverna');assert.equal(writes[0][0],'tags');
});
