export class Input {
  constructor(game, mouseCheckbox) {
    this.game = game;
    this.keys = { w: false, a: false, s: false, d: false, Space: false, c: false, f: false };
    this.mouseControl = false;
    this.mouse = { x: 0, y: 0 };
    this.joystick = { x: 0, y: 0, active: false };
    
    this.setupEvents(mouseCheckbox);
    this.setupTouchEvents();
  }

  setupEvents(mouseCheckbox) {
    mouseCheckbox.addEventListener('change', (e) => {
      this.mouseControl = e.target.checked;
    });

    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (key in this.keys) this.keys[key] = true;
      if (e.key === ' ') this.keys.Space = true;
      if (key === 'l') this.game.toggleHeadlight();
      if (key === 'u') this.game.toggleAutopilot();
      
      if (e.key === 'Escape') {
        if (this.game.state === 'PLAYING') {
          this.game.goToMainMenu();
        } else if (this.game.state === 'MENU') {
          this.game.resumeGame();
        }
      }

      // Handle speed gear hotkeys (0, 1, 2, 3)
      if (e.key === '0' || e.key === '1' || e.key === '2' || e.key === '3') {
        const gear = parseInt(e.key);
        this.game.setGear(gear);
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key in this.keys) this.keys[key] = false;
      if (e.key === ' ') this.keys.Space = false;
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }

  setupTouchEvents() {
    const base = document.getElementById('joystick-base');
    const knob = document.getElementById('joystick-knob');
    if (!base || !knob) return;

    let baseRect = null;
    let baseCenterX = 0;
    let baseCenterY = 0;
    let maxRadius = 0;

    const onTouchStart = (e) => {
      e.preventDefault();
      baseRect = base.getBoundingClientRect();
      
      // Center of the base circle
      baseCenterX = baseRect.left + baseRect.width / 2;
      baseCenterY = baseRect.top + baseRect.height / 2;
      
      // Max radius the knob can move from the center
      maxRadius = baseRect.width / 2;
      
      this.joystick.active = true;
      updateJoystickPosition(e.targetTouches[0]);
    };

    const onTouchMove = (e) => {
      if (!this.joystick.active) return;
      e.preventDefault();
      updateJoystickPosition(e.targetTouches[0]);
    };

    const onTouchEnd = (e) => {
      this.joystick.active = false;
      this.joystick.x = 0;
      this.joystick.y = 0;
      
      // Reset knob visual position by removing inline styles
      knob.style.left = '';
      knob.style.top = '';
    };

    const updateJoystickPosition = (touch) => {
      let dx = touch.clientX - baseCenterX;
      let dy = touch.clientY - baseCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      // Visual update centering
      const knobRadius = knob.offsetWidth / 2;
      const visualLeft = (baseRect.width / 2) + dx - knobRadius;
      const visualTop = (baseRect.height / 2) + dy - knobRadius;
      
      knob.style.left = `${visualLeft}px`;
      knob.style.top = `${visualTop}px`;

      // Set normalized values (Y inverted so UP is positive pitch change, RIGHT is positive yaw)
      this.joystick.x = dx / maxRadius;
      this.joystick.y = -dy / maxRadius; 
    };

    knob.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    // Setup action buttons
    const btnUp = document.getElementById('btn-touch-up');
    const btnDown = document.getElementById('btn-touch-down');
    const btnScan = document.getElementById('btn-touch-scan');

    if (btnUp) {
      btnUp.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys.Space = true; }, { passive: false });
      btnUp.addEventListener('touchend', () => { this.keys.Space = false; });
      btnUp.addEventListener('touchcancel', () => { this.keys.Space = false; });
    }
    if (btnDown) {
      btnDown.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys.c = true; }, { passive: false });
      btnDown.addEventListener('touchend', () => { this.keys.c = false; });
      btnDown.addEventListener('touchcancel', () => { this.keys.c = false; });
    }
    if (btnScan) {
      btnScan.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys.f = true; }, { passive: false });
      btnScan.addEventListener('touchend', () => { this.keys.f = false; });
      btnScan.addEventListener('touchcancel', () => { this.keys.f = false; });
    }
  }
}
