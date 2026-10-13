import {ID, SCHEMA, STATES, validateConfig, readConfig, assertGeometry, enumerateHexes, geometrySignature} from './core.mjs';

export async function installSceneConfig(application, html, {open, report}) {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0] ?? application.element;
  const scene = application.document;
  if (!root || !scene || root.querySelector('[data-qe-scene-config]')) return;
  const nav = root.querySelector('.tabs[data-group="sheet"]') ?? root.querySelector('.tabs');
  if (!nav) return;
  const config = readConfig(scene);
  const render = foundry.applications.handlebars.renderTemplate;
  const content = await render(`modules/${ID}/templates/scene-config.hbs`, {sceneId: scene.id, config,
    states: Object.entries(STATES).map(([value, label]) => ({value, label, selected: value === config.defaultState})),
    labels: [{value: 'selected', label: 'Só a área selecionada'}, {value: 'none', label: 'Nenhum'}, {value: 'all', label: 'Todos os números curtos'}].map(v => ({...v, selected: v.value === config.labelMode}))});
  const button = document.createElement('a'); button.dataset.tab = ID; button.dataset.group = 'sheet'; button.dataset.action = 'tab';
  button.innerHTML = '<i class="fa-solid fa-compass"></i> Explorador'; button.setAttribute('role', 'tab');
  nav.append(button);
  const container = document.createElement('div'); container.innerHTML = content;
  const panel = container.firstElementChild;
  (root.querySelector('.form-footer') ?? root.querySelector('footer'))?.before(panel);
  if (!panel.isConnected) root.append(panel);
  panel.querySelector('[data-qe-open-scene]').addEventListener('click', () => report(() => open(scene.id)));
  if (application.tabGroups?.sheet === ID) {
    button.classList.add('active'); panel.classList.add('active');
  }
}

/** Runs before native scene submission, validating the prospective scene, including simultaneous grid edits. */
export function validateSceneUpdate(scene, changes, {expand, setProperty, cloneScene}) {
  const expanded = expand(changes), patch = expanded.flags?.[ID]?.config;
  if (!patch) return;
  const config = validateConfig({...readConfig(scene), ...patch});
  const prospective = cloneScene(scene, expanded);
  let cells = [];
  if (config.enabled) {assertGeometry(prospective); cells = enumerateHexes(prospective);}
  // Convert config to one normalized nested object, avoiding conflicting dotted form keys.
  for (const key of Object.keys(changes)) if (key === `flags.${ID}.config` || key.startsWith(`flags.${ID}.config.`)) delete changes[key];
  setProperty(changes, `flags.${ID}.config`, config);
  setProperty(changes, `flags.${ID}.schema`, SCHEMA);
  if (config.enabled) {
    setProperty(changes, `flags.${ID}.geometry`, geometrySignature(prospective));
    for (const cell of cells) if (!prospective.flags?.[ID]?.hexes?.[cell.key]?.number) setProperty(changes, `flags.${ID}.hexes.${cell.key}.number`, cell.number);
  }
}
