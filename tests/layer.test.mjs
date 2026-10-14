import test from 'node:test';
import assert from 'node:assert/strict';
import {ID} from '../src/core.mjs';
import {createApi} from '../src/api.mjs';
import {createExplorerLayer} from '../src/layer.mjs';
import {mockGame} from '../tools/fixture.mjs';

class Container {
  children = [];
  addChild(child) {this.children.push(child); return child;}
  removeChildren() {const children = this.children; this.children = []; return children;}
  destroy() {this.destroyed = true;}
}
class Graphics extends Container {
  commands = [];
  lineStyle(...args) {this.commands.push(['line', ...args]); return this;}
  beginFill(...args) {this.commands.push(['fill', ...args]); return this;}
  drawPolygon(...args) {this.commands.push(['polygon', ...args]); return this;}
  drawRect(...args) {this.commands.push(['rect', ...args]); return this;}
  endFill() {return this;}
}
class Text extends Container {
  anchor = {set() {}}; position = {set() {}};
  constructor(text, style) {super(); this.text = text; this.style = style;}
}
class InteractionLayer extends Container {
  static get layerOptions() {return {baseClass: InteractionLayer};}
  async _draw() {}
}
async function setup() {
  globalThis.PIXI = {Container, Graphics, Text};
  globalThis.foundry = {canvas: {layers: {InteractionLayer}}};
  const game = globalThis.game = mockGame(), scene = game.scenes.get('sceneA');
  const points = () => Array.from({length: 8}, (_, i) => Array.from({length: 9}, (_, j) => ({i, j, center: scene.grid.getCenterPoint({i, j})}))).flat();
  scene.grid.getOffset = point => points().sort((a,b) => Math.hypot(a.center.x-point.x,a.center.y-point.y)-Math.hypot(b.center.x-point.x,b.center.y-point.y))[0];
  globalThis.canvas = {scene, stage: {}, dimensions: {rect: scene.dimensions.sceneRect}};
  globalThis.ui = {controls: {tool: {name: 'select'}}};
  const jobs = [], errors = []; let selected;
  const api = createApi(game, {select: hex => {selected = hex.id;}});
  await api.configureScene(scene.id, {enabled: true});
  const Layer = createExplorerLayer({getApi: () => api, getSelection: () => selected, open() {}, report: fn => jobs.push(Promise.resolve().then(fn).catch(e => errors.push(e.message)))});
  const layer = new Layer(); await layer._draw({});
  return {game, scene, api, Layer, layer, jobs, errors};
}
test('layer paints coverage and labels, selects on click, and exposes V13 controls', async () => {
  const f = await setup(), controls = f.Layer.prepareSceneControls();
  assert.equal(controls.layer, ID); assert.equal(controls.activeTool, 'select');
  assert.equal(controls.tools.panel.button, true);
  assert.equal(f.layer.display.children.filter(c => c instanceof Text).length, 0);
  f.layer._onClickLeft({getLocalPosition: () => f.scene.grid.getCenterPoint({i: 1, j: 1})});
  await Promise.all(f.jobs); assert.deepEqual(f.errors, []);
  assert.equal(f.api.getHex('sceneA:1:1').state, 'hidden');
  f.layer.refresh();
  assert.equal(f.layer.display.children.filter(c => c instanceof Text).length, 1);
  ui.controls.tool.name = 'explored';
  f.layer._onClickLeft({getLocalPosition: () => f.scene.grid.getCenterPoint({i: 1, j: 1})});
  await Promise.all(f.jobs); assert.equal(f.api.getHex('sceneA:1:1').state, 'explored');
});

test('disabled border cells appear in red for the GM and do not participate in painting', async () => {
  const f = await setup();
  await f.api.setActive(['sceneA:0:0','sceneA:0:1'],false); f.layer.refresh();
  const graphics = f.layer.display.children[0];
  assert.equal(graphics.commands.filter(c => c[0] === 'polygon').length,72);
  ui.controls.tool.name = 'partial';
  f.layer._onDragLeftStart({interactionData:{origin:f.scene.grid.getCenterPoint({i:0,j:0})}});
  assert.equal(f.layer.paint.size,0);
});
test('drag records one batch and cancellation never persists it', async () => {
  const f = await setup(); ui.controls.tool.name = 'partial';
  assert.equal(f.layer._canDragLeftStart(), true);
  f.layer._onDragLeftStart({interactionData: {origin: f.scene.grid.getCenterPoint({i: 1, j: 1})}});
  f.layer._onDragLeftDrop({interactionData: {destination: f.scene.grid.getCenterPoint({i: 1, j: 2})}});
  await Promise.all(f.jobs);
  assert.equal(f.api.getHex('sceneA:1:1').state, 'partial');
  assert.equal(f.api.getHex('sceneA:1:2').state, 'partial');
  f.layer._onDragLeftStart({interactionData: {origin: f.scene.grid.getCenterPoint({i: 1, j: 3})}});
  f.layer._onDragLeftCancel(); assert.equal(f.layer.paint.size, 0);
  assert.equal(f.api.getHex('sceneA:1:3').state, 'hidden');
});
test('player coverage has no hidden labels, no paint controls, and closes on invalid geometry', async () => {
  const f = await setup(); f.game.user.isGM = false; f.layer.refresh();
  assert.equal(f.layer.display.children.filter(c => c instanceof Text).length, 0);
  assert.equal(f.Layer.prepareSceneControls().tools.explored.visible, false);
  assert.equal(f.layer._canDragLeftStart(), false);
  const log = console.error; console.error = () => {};
  try {f.scene.grid.size++; f.layer.refresh();} finally {console.error = log;}
  assert.equal(f.layer.display.children.length, 1);
  assert.deepEqual(f.layer.display.children[0].commands[0], ['fill', 0x111827]);
  assert.equal(f.layer.display.children[0].commands[1][0], 'rect');
});
