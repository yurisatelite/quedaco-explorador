import {ID, STATES, enumerateHexes, readConfig, readHex, assertGeometry, hexId} from './core.mjs';

export function createExplorerLayer({getApi, getSelection, getSelections = () => [getSelection()], open, report}) {
  return class ExplorerLayer extends foundry.canvas.layers.InteractionLayer {
    static get layerOptions() { return {...super.layerOptions, name: ID, zIndex: 950}; }
    get hookName() { return 'QuedacoExplorerLayer'; }
    static prepareSceneControls() {
      const tool = (name, title, icon, order, visible = true) => ({name, title, icon, order, visible});
      return {name: ID, title: 'Quedaço - Explorador', icon: 'fa-solid fa-compass', layer: ID, order: 11, activeTool: 'select',
        onChange: (event, active) => {if (active) canvas[ID].activate();},
        tools: {
          select: tool('select', 'Selecionar áreas: clique, Ctrl/Shift ou arraste uma caixa', 'fa-solid fa-arrow-pointer', 0),
          explored: tool('explored', 'Explorar: clique ou arraste', 'fa-solid fa-eye', 1, game.user.isGM),
          partial: tool('partial', 'Revelar parcialmente: clique ou arraste', 'fa-solid fa-circle-half-stroke', 2, game.user.isGM),
          hidden: tool('hidden', 'Ocultar: clique ou arraste', 'fa-solid fa-eye-slash', 3, game.user.isGM),
          panel: {...tool('panel', 'Abrir menu lateral do Explorador', 'fa-solid fa-bars', 4), button: true, onChange: () => open()}
        }};
    }
    async _draw(options) {
      await super._draw(options);
      this.display = this.addChild(new PIXI.Container());
      this.display.eventMode = 'none';
      this.paint = new Set();
      this.refresh();
    }
    refresh() {
      if (!this.display) return;
      this.display.mask = null;
      for (const child of this.display.removeChildren()) child.destroy({children: true});
      const scene = canvas.scene;
      if (!scene || !readConfig(scene).enabled) return;
      try {
        assertGeometry(scene);
        const cells = enumerateHexes(scene), config = readConfig(scene), isGM = game.user.isGM;
        const graphics = this.display.addChild(new PIXI.Graphics());
        const color = parseInt(config.color.slice(1), 16);
        for (const cell of cells) {
          const hex = readHex(scene, cell, game.user), selected = getSelections().includes(cell.id);
          if (!hex.active) continue;
          const alpha = hex.state === 'explored' ? 0 : isGM ? config.gmOpacity : hex.state === 'partial' ? 0.6 : 1;
          const outline = selected ? 0x67e8f9 : hex.state === 'explored' ? 0x65d6a5 : hex.state === 'partial' ? 0xf2c879 : 0x64748b;
          graphics.lineStyle(selected ? 3 : 1, outline, selected ? 1 : 0.35);
          graphics.beginFill(color, alpha);
          graphics.drawPolygon(cell.vertices.flatMap(p => [p.x, p.y])); graphics.endFill();
          if (config.labelMode !== 'none' && (config.labelMode === 'all' || selected) && (isGM || hex.state === 'explored')) {
            const label = this.display.addChild(new PIXI.Text(config.labelMode === 'all' || getSelections().length > 1 ? hex.shortCode : (hex.name || hex.label).slice(0,60), {fontFamily: 'sans-serif', fontSize: Math.max(10, Math.min(20, scene.grid.size / 7)), fill: '#ffffff', stroke: '#111827', strokeThickness: 3, wordWrap: true, wordWrapWidth: scene.grid.size * 0.85, align: 'center'}));
            label.anchor.set(0.5); label.position.set(cell.center.x, cell.center.y); label.eventMode = 'none';
          }
        }
        const r = scene.dimensions.sceneRect;
        const mask = this.display.addChild(new PIXI.Graphics()); mask.beginFill(0xffffff).drawRect(r.x, r.y, r.width, r.height).endFill();
        this.display.mask = mask;
      } catch (error) {
        // Invalidated geometry must never silently reveal the map to players.
        if (!game.user.isGM) {
          const r = scene.dimensions.sceneRect;
          this.display.addChild(new PIXI.Graphics()).beginFill(0x111827).drawRect(r.x, r.y, r.width, r.height).endFill();
        }
        console.error(`${ID}: cobertura indisponível`, error);
      }
    }
    hexAt(point) {
      const scene = canvas.scene;
      if (!scene || !readConfig(scene).enabled) throw Error('Ative a exploração desta cena no menu lateral.');
      const offset = scene.grid.getOffset(point);
      const id = hexId(scene.id, offset);
      getApi().getHex(id);
      return id;
    }
    _onClickLeft(event) {
      report(async () => {
        const id = this.hexAt(event.getLocalPosition(canvas.stage));
        getApi().selectHex(id, {additive: game.user.isGM && !!(event.shiftKey || event.ctrlKey || event.metaKey || event.nativeEvent?.shiftKey || event.nativeEvent?.ctrlKey)}); open();
        const tool = ui.controls.tool.name;
        if (Object.hasOwn(STATES, tool) && game.user.isGM) await getApi().setState(id, tool);
      });
    }
    _onClickLeft2(event) { this._onClickLeft(event); }
    _canDragLeftStart() { return game.user.isGM && (ui.controls.tool.name === 'select' || Object.hasOwn(STATES, ui.controls.tool.name)); }
    _onDragLeftStart(event) {
      this.paint = new Set(); this.paintState = ui.controls.tool.name;
      this.dragOrigin = event.interactionData.origin;
      this.dragAdditive = !!(event.shiftKey || event.ctrlKey || event.nativeEvent?.shiftKey || event.nativeEvent?.ctrlKey);
      if (this.paintState !== 'select') this.addPaint(event.interactionData.origin);
    }
    addPaint(point) {
      try {const id = this.hexAt(point); if (getApi().getHex(id).active) this.paint.add(id);} catch { /* Ignore padding or disabled borders. */ }
    }
    _onDragLeftMove(event) {if (this.paintState !== 'select') this.addPaint(event.interactionData.destination);}
    _onDragLeftDrop(event) {
      if (this.paintState === 'select') {
        const start = this.dragOrigin, end = event.interactionData.destination;
        const cells = enumerateHexes(canvas.scene).filter(c => c.active && c.center.x >= Math.min(start.x,end.x) && c.center.x <= Math.max(start.x,end.x) && c.center.y >= Math.min(start.y,end.y) && c.center.y <= Math.max(start.y,end.y));
        getApi().selectHexes(cells.map(c => c.id),{additive:this.dragAdditive});
        this.paint.clear(); open(); return;
      }
      this.addPaint(event.interactionData.destination);
      const ids = [...this.paint], state = this.paintState; this.paint.clear();
      report(() => getApi().setStates(ids, state));
    }
    _onDragLeftCancel() {this.paint?.clear();}
  };
}
