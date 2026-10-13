import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import Handlebars from 'handlebars';
import {JSDOM} from 'jsdom';
import {uiFixture} from '../tools/fixture.mjs';
import {safeBackground} from '../src/app.mjs';
Handlebars.registerHelper('eq', (a, b) => a === b);
const source = await readFile(new URL('../templates/explorer.hbs', import.meta.url), 'utf8');
const template = Handlebars.compile(source);

test('all sidebar tabs and inspector render, escape user content and handle real click/form events', async () => {
  const f = await uiFixture();
  await f.api.updateHex('sceneA:2:2', {name: '<script>alert(1)</script>'});
  let context = await f.app._prepareContext(), html = template(context);
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>'));
  const dom = new JSDOM(html);
  globalThis.FormData = dom.window.FormData;
  globalThis.MouseEvent = dom.window.MouseEvent;
  f.app.element = dom.window.document.body;
  f.app._onRender(context, {});
  assert.equal(f.app.element.querySelectorAll('[data-tab]').length, 5);
  assert.equal(f.app.element.querySelectorAll('g[data-hex]').length, 72);
  assert.ok(f.app.element.querySelector('[data-hex-form]'));
  f.app.element.querySelector('[data-tab="hexes"]').click(); assert.equal(f.app.tab, 'hexes');
  f.app.tab = 'exploration';
  f.app.element.querySelector('[data-hex="sceneA:1:1"]').dispatchEvent(new dom.window.KeyboardEvent('keydown', {key: 'Enter'}));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await f.app._prepareContext()).selected.id, 'sceneA:1:1');
  for (const tab of ['hexes', 'settings', 'integration', 'tags']) {
    f.app.tab = tab; html = template(await f.app._prepareContext());
    assert.ok(html.includes('qe-sidebar')); assert.ok(!html.includes('undefined'));
  }
  assert.deepEqual(f.errors, []);
});

test('map defaults to one friendly label and multiple selection opens batch controls', async () => {
  const f = await uiFixture();
  let html = template(await f.app._prepareContext());
  let doc = new JSDOM(html).window.document;
  assert.equal(doc.querySelectorAll('g[data-hex] text').length, 1);
  assert.equal(doc.querySelector('g[data-hex] text').textContent.trim(), 'Travessia da Aurora');
  assert.equal(doc.querySelector('.qe-inspector code'), null);
  f.api.selectHex('sceneA:2:3', {additive:true});
  html = template(await f.app._prepareContext()); doc = new JSDOM(html).window.document;
  assert.ok(doc.querySelector('[data-batch-form]'));
  assert.equal(doc.querySelector('[data-hex-form]'),null);
  assert.ok(doc.querySelector('option[value="mirmir"]'));
  assert.ok(html.includes('2 áreas selecionadas'));
});
test('player interface has consultation only and no hidden names in SVG or list', async () => {
  const f = await uiFixture(); f.game.user.isGM = false; f.api.selectHex('sceneA:3:2');
  const html = template(await f.app._prepareContext());
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.querySelectorAll('[data-tab]').length, 2);
  assert.equal(doc.querySelectorAll('[data-state]').length, 0);
  assert.equal(doc.querySelector('[data-hex-form]'), null);
  assert.ok(!html.includes('Nome ainda não revelado'));
  assert.equal(doc.querySelector('[data-hex="sceneA:3:2"] text'), null);
});
test('empty world and square grid return actionable UI and manifest ships only real assets', async () => {
  const f = await uiFixture(); f.scene.grid.isHexagonal = false;
  assert.match(template(await f.app._prepareContext()), /grade hexagonal/);
  f.game.scenes.clear(); assert.match(template(await f.app._prepareContext()), /Nenhuma cena disponível/);
  const manifest = JSON.parse(await readFile(new URL('../module.json', import.meta.url)));
  assert.equal(manifest.title, 'QUEDAÇO - Explorador');
  assert.equal(manifest.manifest, 'https://github.com/yurisatelite/quedaco-explorador/releases/latest/download/module.json');
  assert.equal(manifest.download, `https://github.com/yurisatelite/quedaco-explorador/releases/download/v${manifest.version}/quedaco-explorador.zip`);
  for (const path of [...manifest.esmodules, ...manifest.styles, 'templates/explorer.hbs']) await access(new URL(`../${path}`, import.meta.url));
  assert.equal(safeBackground('javascript:alert(1)'), ''); assert.equal(safeBackground('maps/opath.webp'), 'maps/opath.webp');
});
