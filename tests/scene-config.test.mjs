import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import Handlebars from 'handlebars';
import {JSDOM} from 'jsdom';
import {installSceneConfig,validateSceneUpdate} from '../src/scene-config.mjs';
import {ID} from '../src/core.mjs';
import {mockScene} from '../tools/fixture.mjs';
const source = await readFile(new URL('../templates/scene-config.hbs',import.meta.url),'utf8');
function setProperty(object,path,value) {const fields = path.split('.'); let target = object; for (const field of fields.slice(0,-1)) target = target[field] ??= {}; target[fields.at(-1)] = value;}
function expand(input) {const output = {}; for (const [key,value] of Object.entries(input)) setProperty(output,key,value); return output;}
function cloneScene(scene,patch) {const copy = mockScene(scene.id); copy.flags = structuredClone(scene.flags); copy.grid = {...scene.grid,...patch.grid}; return copy;}
test('native SceneConfig gets its own tab and native submit fields, without duplicate injection', async () => {
  const dom = new JSDOM('<form><nav class="tabs" data-group="sheet"><a data-tab="basics">Básicos</a></nav><section class="tab"></section><footer class="form-footer"><button>Salvar</button></footer></form>');
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.document = dom.window.document; globalThis.game = {user:{isGM:true}};
  globalThis.foundry = {applications:{handlebars:{renderTemplate:async (path,context) => Handlebars.compile(source)(context)}}};
  const application = {document:mockScene(),element:document.querySelector('form'),tabGroups:{sheet:'basics'}}; let opened;
  const options = {open:id => {opened = id;},report:fn => fn()};
  await installSceneConfig(application,application.element,options); await installSceneConfig(application,application.element,options);
  assert.equal(document.querySelectorAll('[data-qe-scene-config]').length,1);
  assert.ok(document.querySelector(`a[data-tab="${ID}"][data-action="tab"]`));
  assert.ok(document.querySelector(`input[name="flags.${ID}.config.enabled"]`));
  document.querySelector('[data-qe-open-scene]').click(); assert.equal(opened,'sceneA');
  assert.ok(document.querySelector('.form-footer'));
});
test('native save normalizes config and numbers without discarding old records; changed grids are rejected', () => {
  const scene = mockScene(); scene.flags[ID] = {hexes:{'1_1':{name:'Ponte antiga',state:'explored'}}};
  const changes = {[`flags.${ID}.config.enabled`]:true,[`flags.${ID}.config.gmOpacity`]:0.4};
  validateSceneUpdate(scene,changes,{expand,setProperty,cloneScene});
  assert.equal(changes.flags[ID].schema,2); assert.equal(changes.flags[ID].config.labelMode,'selected');
  assert.ok(changes.flags[ID].hexes['1_1'].number);
  assert.equal(scene.flags[ID].hexes['1_1'].name,'Ponte antiga');
  scene.flags[ID].geometry = changes.flags[ID].geometry;
  assert.throws(() => validateSceneUpdate(scene,{grid:{size:100},flags:{[ID]:{config:{enabled:true}}}},{expand,setProperty,cloneScene}),/mudaram/);
  assert.throws(() => validateSceneUpdate(scene,{flags:{[ID]:{config:{color:'bad'}}}},{expand,setProperty,cloneScene}),/Cor/);
});
