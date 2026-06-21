export class Input {
  constructor(game, mouseCheckbox) {
    this.game = game;
    this.keys = { w: false, a: false, s: false, d: false, Space: false, c: false, f: false };
    this.mouseControl = false;
    this.mouse = { x: 0, y: 0 };
    this.setupEvents(mouseCheckbox);
  }

  setupEvents(mouseCheckbox) {
    mouseCheckbox.addEventListener('change', (e) => {
      this.mouseControl = e.target.checked;
    });

    window.addEventListener('keydown', (e) => {
      if (e.key in this.keys) this.keys[e.key] = true;
      if (e.key === ' ') this.keys.Space = true;
      if (e.key === 'c' || e.key === 'C') this.keys.c = true;
      if (e.key === 'f' || e.key === 'F') this.keys.f = true;
      if (e.key === 'l' || e.key === 'L') this.game.toggleHeadlight();

      // Handle speed gear hotkeys (0, 1, 2, 3)
      if (e.key === '0' || e.key === '1' || e.key === '2' || e.key === '3') {
        const gear = parseInt(e.key);
        this.game.setGear(gear);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key in this.keys) this.keys[e.key] = false;
      if (e.key === ' ') this.keys.Space = false;
      if (e.key === 'c' || e.key === 'C') this.keys.c = false;
      if (e.key === 'f' || e.key === 'F') this.keys.f = false;
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }
}
