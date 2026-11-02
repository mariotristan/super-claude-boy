// Unified input: multi-touch zones, keyboard, and gamepads.
// Gameplay reads sample(); menus receive discrete nav actions via onNav.

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', KeyK: 'jump',
};
const NAVKEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
  Enter: 'confirm', Space: 'confirm', Escape: 'pause', KeyP: 'pause', KeyR: 'restart',
};

export class Input {
  constructor(layer, buttons) {
    this.keys = { left: false, right: false, jump: false };
    this.touches = new Map(); // pointerId -> zone
    this.pad = { left: false, right: false, jump: false };
    this.prevPad = {};
    this.jumpQueued = false;
    this.lastSource = matchMedia('(pointer: coarse)').matches ? 'touch' : 'keys';
    this.onNav = () => {};
    this.onSource = () => {};
    this.layer = layer;
    this.buttons = buttons; // { left, right, jump } elements for visuals and zone split

    addEventListener('keydown', e => {
      const k = KEYMAP[e.code], n = NAVKEYS[e.code];
      if (k || n) e.preventDefault();
      this.setSource('keys');
      if (k) {
        if (k === 'jump' && !this.keys.jump) this.jumpQueued = true;
        this.keys[k] = true;
      }
      if (n && !e.repeat) this.onNav(n);
    });
    addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) this.keys[k] = false; });
    addEventListener('blur', () => { this.keys = { left: false, right: false, jump: false }; this.touches.clear(); this.paint(); });

    const down = e => {
      e.preventDefault();
      this.setSource('touch');
      layer.setPointerCapture?.(e.pointerId);
      const z = this.zoneOf(e);
      if (z === 'jump') this.jumpQueued = true;
      this.touches.set(e.pointerId, z);
      this.paint();
    };
    const move = e => {
      if (!this.touches.has(e.pointerId)) return;
      e.preventDefault();
      const z = this.zoneOf(e), old = this.touches.get(e.pointerId);
      if (z === old) return;
      if (z === 'jump') this.jumpQueued = true;
      this.touches.set(e.pointerId, z);
      this.paint();
    };
    const up = e => { this.touches.delete(e.pointerId); this.paint(); };
    layer.addEventListener('pointerdown', down);
    layer.addEventListener('pointermove', move);
    layer.addEventListener('pointerup', up);
    layer.addEventListener('pointercancel', up);
    layer.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    layer.addEventListener('contextmenu', e => e.preventDefault());
  }

  setSource(s) {
    if (this.lastSource !== s) { this.lastSource = s; this.onSource(s); }
  }

  zoneOf(e) {
    if (e.clientX >= innerWidth / 2) return 'jump';
    const l = this.buttons.left.getBoundingClientRect(), r = this.buttons.right.getBoundingClientRect();
    const mid = (l.left + l.right + r.left + r.right) / 4;
    return e.clientX < mid ? 'left' : 'right';
  }

  paint() {
    const active = new Set(this.touches.values());
    for (const k of ['left', 'right', 'jump']) this.buttons[k].classList.toggle('on', active.has(k));
  }

  pollPads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const now = { left: false, right: false, up: false, down: false, jump: false, back: false, pause: false, restart: false };
    for (const gp of pads) {
      if (!gp) continue;
      const b = i => !!gp.buttons[i]?.pressed;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      now.left ||= ax < -0.4 || b(14);
      now.right ||= ax > 0.4 || b(15);
      now.up ||= ay < -0.5 || b(12);
      now.down ||= ay > 0.5 || b(13);
      now.jump ||= b(0);
      now.back ||= b(1);
      now.pause ||= b(9);
      now.restart ||= b(3) || b(2);
    }
    const prev = this.prevPad;
    const edge = k => now[k] && !prev[k];
    if (Object.values(now).some(Boolean)) this.setSource('pad');
    if (edge('jump')) { this.jumpQueued = true; this.onNav('confirm'); }
    for (const k of ['left', 'right', 'up', 'down', 'pause', 'restart']) if (edge(k)) this.onNav(k);
    if (edge('back')) this.onNav('back');
    this.pad = now;
    this.prevPad = now;
  }

  clearJump() { this.jumpQueued = false; }

  sample() {
    const t = new Set(this.touches.values());
    const s = {
      left: this.keys.left || this.pad.left || t.has('left'),
      right: this.keys.right || this.pad.right || t.has('right'),
      jump: this.keys.jump || this.pad.jump || t.has('jump'),
      jumpPressed: this.jumpQueued,
    };
    this.jumpQueued = false;
    return s;
  }
}
