import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {chromium} = require(process.argv[2] ?? 'playwright');
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 960}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const output = fileURLToPath(new URL('../artifacts/', import.meta.url));
await mkdir(output, {recursive: true});
try {
  await page.goto('http://127.0.0.1:3187');
  await page.waitForSelector('[data-hex-form]');
  async function checkLayout(label) {
    const problems = await page.evaluate(() => {
      const visible = el => el.getClientRects().length && getComputedStyle(el).display !== 'none';
      return [...document.querySelectorAll('.qe-shell,.qe-sidebar,.qe-main,.qe-workspace,.qe-card,.qe-inspector,form,fieldset,button,input,select,textarea')]
        .filter(visible).flatMap(el => {
          // Single-line fields scroll their value internally; check their outer bounds below.
          if (!el.matches('input,textarea') && el.scrollWidth > el.clientWidth + 2 && !['auto','scroll'].includes(getComputedStyle(el).overflowX)) return [`${el.className || el.tagName}: horizontal overflow`];
          const parent = el.parentElement;
          if (!parent || el.closest('svg')) return [];
          const a = el.getBoundingClientRect(), b = parent.getBoundingClientRect();
          return a.right > b.right + 2 || a.left < b.left - 2 ? [`${el.className || el.tagName}: outside parent`] : [];
        });
    });
    assert.deepEqual(problems, [], label);
  }
  await checkLayout('desktop');
  await page.screenshot({path: output + 'explorador-desktop.png', fullPage: true});
  await page.locator('g[data-hex="sceneA:1:1"]').click();
  await page.waitForFunction(() => document.querySelector('[data-selected-area]')?.dataset.selectedArea === 'sceneA:1:1');
  await page.locator('[data-hex-form] [name="name"]').fill('Torre de integração');
  await page.locator('[data-hex-form] [name="regionId"]').selectOption('mirmir');
  await page.locator('[data-hex-form] [type="submit"]').click();
  await page.waitForFunction(() => window.previewFixture.api.getHex('sceneA:1:1').name === 'Torre de integração');
  await page.locator('[data-state="explored"]').click();
  await page.waitForFunction(() => window.previewFixture.api.getHex('sceneA:1:1').state === 'explored');
  await page.locator('g[data-hex="sceneA:1:2"]').click({modifiers:['Control']});
  await page.waitForSelector('[data-batch-form]');
  await page.locator('[data-batch-form] [name="regionId"]').selectOption('forah');
  await page.locator('[data-batch-form] [name="terrain"]').selectOption({label:'Floresta'});
  await page.locator('[data-batch-form] [type="submit"]').click();
  await page.waitForFunction(() => window.previewFixture.api.getHex('sceneA:1:2').regionId === 'forah');
  assert.equal(await page.evaluate(() => window.previewFixture.api.getHex('sceneA:1:1').name),'Torre de integração');
  await page.screenshot({path: output + 'explorador-selecao-multipla.png',fullPage:true});
  await page.locator('[data-command="clear"]').click();
  await page.locator('g[data-hex="sceneA:0:0"]').click();
  await page.locator('[data-command="disable"]').click();
  await page.waitForFunction(() => window.previewFixture.api.getSummary('sceneA').total === 71);
  assert.equal(await page.locator('g[data-hex="sceneA:0:0"]').count(),0);
  await page.locator('g[data-hex="sceneA:1:1"]').click();
  await page.locator('[data-command="current"]').click();
  await page.locator('.qe-notes details summary').click();
  await page.locator('[data-note-form] [name="title"]').fill('Chegada à torre');
  await page.locator('[data-note-form] [name="description"]').fill('Encontramos um caminho seguro.');
  await page.locator('[data-note-form] [type="submit"]').click();
  await page.waitForSelector('.qe-note-card');
  await page.locator('[data-tab="hexes"]').click();
  await page.locator('[data-filter-form] [name="search"]').fill('Torre');
  await page.locator('[data-filter-form] [type="submit"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.qe-hex-row').length === 1);
  await page.locator('[data-tab="settings"]').click();
  await page.locator('[data-command="renumber"]').click();
  await page.waitForFunction(() => window.previewFixture.api.getHex('sceneA:1:1').number === 10);
  await page.locator('[name="labelMode"]').selectOption('none');
  await page.locator('[data-config-form] [type="submit"]').click();
  await page.waitForFunction(() => !window.previewFixture.api.getConfig('sceneA').showLabels);
  await page.locator('[data-tab="tags"]').click();
  await page.locator('[name="tagName"]').fill('Ruínas');
  await page.locator('[data-tag-form] [type="submit"]').click();
  await page.waitForFunction(() => window.previewFixture.api.getCatalog().tags.some(t => t.label === 'Ruínas'));
  await page.locator('[data-tab="integration"]').click();
  await page.waitForSelector('.qe-integrations');
  await page.screenshot({path: output + 'explorador-integracoes.png', fullPage: true});
  // Keep the browser wide while resizing only the app, as Foundry does.
  await page.evaluate(async () => {
    window.previewFixture.scene.name = 'Mapa de campanha com um nome muito longo '.repeat(8);
    await window.previewFixture.api.updateHex('sceneA:1:1',{name:'LocalidadeComNomeSemEspacos'.repeat(8)});
  });
  for (const size of [{width:1000,height:700},{width:760,height:480},{width:520,height:600},{width:360,height:480}]) {
    await page.locator('.qe-app').evaluate((el,size) => {el.style.width = `${size.width}px`; el.style.height = `${size.height}px`;},size);
    for (const tab of ['exploration','hexes','settings','tags','integration']) {
      await page.locator(`[data-tab="${tab}"]`).click();
      if (tab === 'exploration') {
        await page.locator('.qe-inspector details').evaluateAll(nodes => nodes.forEach(node => node.open = true));
      }
      await checkLayout(`${size.width}x${size.height} ${tab}`);
    }
    await page.locator('.qe-main').scrollIntoViewIfNeeded();
    await page.screenshot({path:output + `explorador-layout-${size.width}.png`,fullPage:true});
  }
  await page.evaluate(async () => {window.previewFixture.game.user.isGM = false; window.previewFixture.app.tab = 'exploration'; await window.previewFixture.app.render();});
  assert.equal(await page.locator('[data-hex-form]').count(), 0);
  assert.equal(await page.locator('[data-tab]').count(), 2);
  await page.screenshot({path: output + 'explorador-jogador.png', fullPage: true});
  await page.setViewportSize({width: 900, height: 800});
  assert.ok(await page.evaluate(() => document.querySelector('.qe-shell').scrollWidth <= 900));
  await page.screenshot({path: output + 'explorador-compacto.png', fullPage: true});
  assert.deepEqual(errors, []);
  assert.deepEqual(await page.evaluate(() => window.previewFixture.errors), []);
  console.log('Browser checks passed: friendly labels, multiselect, batch region/terrain, disabled border, renumber, dated note, tags, filters and player controls.');
} finally {await browser.close();}
