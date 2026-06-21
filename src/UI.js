import { audio } from '../audio.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.soundMuted = false;
    
    // Setup Dom references
    this.dom = {
      startScreen: document.getElementById('start-screen'),
      hud: document.getElementById('hud'),
      gameOverScreen: document.getElementById('game-over-screen'),
      surfaceBanner: document.getElementById('surface-banner'),
      damageFlash: document.getElementById('damage-flash'),
      btnStart: document.getElementById('btn-start'),
      btnRestart: document.getElementById('btn-restart'),
      btnSoundToggle: document.getElementById('btn-sound-toggle'),
      btnGraphicsLow: document.getElementById('btn-graphics-low'),
      btnGraphicsHigh: document.getElementById('btn-graphics-high'),
      mouseCheckbox: document.getElementById('mouse-control-checkbox'),
      o2Bar: document.getElementById('bar-oxygen'),
      o2Text: document.getElementById('text-oxygen'),
      statDepth: document.getElementById('stat-depth'),
      statScore: document.getElementById('stat-score'),
      statVessel: document.getElementById('stat-vessel'),
      hudStatVessel: document.getElementById('hud-stat-vessel'),
      finalScore: document.getElementById('final-score'),
      finalDepth: document.getElementById('final-depth'),
      gearSelector: document.getElementById('gear-selector'),
      btnDatabaseToggle: document.getElementById('btn-database-toggle'),
      btnLightsToggle: document.getElementById('btn-lights-toggle'),
      btnDatabaseClose: document.getElementById('btn-database-close'),
      databaseModal: document.getElementById('database-modal'),
      scannerHud: document.getElementById('scanner-hud'),
      scannerTargetName: document.getElementById('scanner-target-name'),
      scannerTargetDist: document.getElementById('scanner-target-dist'),
      scannerProgressContainer: document.getElementById('scanner-progress-container'),
      scannerProgressBar: document.getElementById('scanner-progress-bar'),
      scannerPrompt: document.getElementById('scanner-prompt'),
      scannerTargetInfo: document.getElementById('scanner-target-info'),
      scannerTag: document.getElementById('scanner-tag'),
      sonarCanvas: document.getElementById('sonar-canvas'),
    };
    
    this.sonarSweepAngle = 0;
    this.sonarCtx = this.dom.sonarCanvas ? this.dom.sonarCanvas.getContext('2d') : null;
    
    this.setupEvents();
  }

  // Bind HUD buttons, keyboard inputs, mouse controls, resize handlers
  setupEvents() {
    // Game start controls
    this.dom.btnStart.addEventListener('click', () => this.game.startGame());
    this.dom.btnRestart.addEventListener('click', () => this.game.startGame());
    
    // Graphics setting buttons
    this.dom.btnGraphicsLow.addEventListener('click', () => this.game.setGraphics(false));
    this.dom.btnGraphicsHigh.addEventListener('click', () => this.game.setGraphics(true));
    
    // Sound toggle
    this.dom.btnSoundToggle.addEventListener('click', () => this.toggleSound());

    // Gear selection buttons
    const gearBtns = this.dom.gearSelector.querySelectorAll('.gear-btn');
    gearBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const gear = parseInt(e.currentTarget.getAttribute('data-gear'));
        this.game.setGear(gear);
      });
    });

    this.dom.btnDatabaseToggle.addEventListener('click', () => {
      this.game.toggleDatabaseModal(true);
    });
    this.dom.btnLightsToggle.addEventListener('click', () => {
      this.game.toggleHeadlight();
    });
    this.dom.btnDatabaseClose.addEventListener('click', () => {
      this.game.toggleDatabaseModal(false);
    });
  }

  updateGearUI(gear) {
    const gearBtns = this.dom.gearSelector.querySelectorAll('.gear-btn');
    gearBtns.forEach(btn => {
      const bGear = parseInt(btn.getAttribute('data-gear'));
      btn.classList.toggle('active', bGear === gear);
    });
  }

  updateHeadlightUI(on) {
    const svgOn = this.dom.btnLightsToggle.querySelector('.lights-on');
    const svgOff = this.dom.btnLightsToggle.querySelector('.lights-off');
    if (svgOn && svgOff) {
      svgOn.classList.toggle('hidden', !on);
      svgOff.classList.toggle('hidden', on);
    }
  }

  setGraphicsUI(high) {
    this.dom.btnGraphicsLow.classList.toggle('active', !high);
    this.dom.btnGraphicsHigh.classList.toggle('active', high);
  }

  toggleSound() {
    this.soundMuted = !this.soundMuted;
    audio.toggleSound(!this.soundMuted);
    
    const svgOn = this.dom.btnSoundToggle.querySelector('.sound-on');
    const svgOff = this.dom.btnSoundToggle.querySelector('.sound-off');
    
    svgOn.classList.toggle('hidden', this.soundMuted);
    svgOff.classList.toggle('hidden', !this.soundMuted);
  }

  showHUD() {
    this.dom.startScreen.classList.add('hidden');
    this.dom.gameOverScreen.classList.add('hidden');
    this.dom.hud.classList.remove('hidden');
  }

  showGameOver(score, maxDepth) {
    // Display end card
    this.dom.hud.classList.add('hidden');
    this.dom.gameOverScreen.classList.remove('hidden');
    this.dom.scannerHud.classList.add('hidden');
    
    this.dom.finalScore.innerText = score;
    this.dom.finalDepth.innerText = Math.round(maxDepth) + "m";
  }

  // Update HUD progress meters and values
  updateHUD(oxygen, depth, score) {
    // 1. Update meters
    this.dom.o2Bar.style.width = oxygen + "%";
    this.dom.o2Text.innerText = Math.round(oxygen) + "%";
    
    // Oxygen low warning pulse in CSS (red bar glow)
    this.dom.o2Bar.parentElement.classList.toggle('low-warning', oxygen < 25);
    
    // 2. Update scores text
    this.dom.statDepth.innerHTML = Math.round(depth) + `<span class="unit">m</span>`;
    this.dom.statScore.innerText = score;
  }

  showScannerHUD(targetName, distance, scanProgress, isScanned, targetType) {
    this.dom.scannerTargetName.innerText = "Target: " + targetName;
    this.dom.scannerTargetDist.innerText = "Range: " + distance.toFixed(1) + "m";
    
    const infoMap = {
      pearl: "Yields 18% Oxygen on capture.",
      jellyfish: "Warning: Stings deplete 18% oxygen & push sub back.",
      kelp: "Procedural sea flora. Sways in deep-sea currents.",
      rock: "Heavy volcanic basalt supporting geothermal coral polyps.",
      fish: "Agile, schooling fish. Harmless and peaceful."
    };

    if (isScanned) {
      this.dom.scannerTag.innerText = "DATA ACQUIRED";
      this.dom.scannerTag.style.textShadow = "var(--shadow-neon-secondary)";
      this.dom.scannerTag.style.color = "var(--color-secondary)";
      this.dom.scannerProgressContainer.classList.add('hidden');
      this.dom.scannerPrompt.classList.add('hidden');
      
      this.dom.scannerTargetInfo.innerText = infoMap[targetType] || "";
      this.dom.scannerTargetInfo.classList.remove('hidden');
    } else {
      this.dom.scannerTag.innerText = "SCANNER LOCK";
      this.dom.scannerTag.style.textShadow = "var(--shadow-neon)";
      this.dom.scannerTag.style.color = "var(--color-primary)";
      this.dom.scannerTargetInfo.classList.add('hidden');
      this.dom.scannerPrompt.classList.remove('hidden');
      
      if (scanProgress > 0) {
        this.dom.scannerProgressContainer.classList.remove('hidden');
        this.dom.scannerProgressBar.style.width = scanProgress + "%";
        this.dom.scannerPrompt.innerText = "Scanning: " + Math.round(scanProgress) + "%";
      } else {
        this.dom.scannerProgressContainer.classList.add('hidden');
        this.dom.scannerPrompt.innerText = "Hold [F] to scan";
      }
    }
    
    this.dom.scannerHud.classList.remove('hidden');
  }

  hideScannerHUD() {
    this.dom.scannerHud.classList.add('hidden');
  }

  renderDatabase(database) {
    const specs = {
      pearl: {
        title: "Bioluminescent Pearl",
        desc: "A dense mineral orb formed in deep ocean trenches under extreme pressure. Emits a strong high-frequency signature. Retrieving these orbs supplies life support subsystems with raw oxygen via electrolysis."
      },
      jellyfish: {
        title: "Abyssal Jellyfish",
        desc: "A venomous translucent cnidarian containing bio-electric stinging nematocysts. Collisions with their tentacles trigger severe electrical interference in life support controls and cause automatic pushback thrusts."
      },
      kelp: {
        title: "Abyssal Kelp Forest",
        desc: "Gigantic procedural marine flora growing from the ocean bedrock. Their multiple jointed segments sway rhythmically, responding to low-frequency underwater sound waves."
      },
      rock: {
        title: "Volcanic Coral Rock",
        desc: "Heavy basalt formations decorated with glowing geothermal coral polyps. These rocky clusters thrive around deep-sea thermal vents, creating dense structural obstacles on the ocean bed."
      },
      fish: {
        title: "Abyssal Schooling Fish",
        desc: "Small, agile schooling teleost fish. They navigate the dark depths in tight synchronised schools to evade larger predators. Peaceful and harmless."
      }
    };

    for (const key in database) {
      const itemEl = document.getElementById("db-item-" + key);
      if (!itemEl) continue;
      
      const statusEl = itemEl.querySelector(".db-status");
      const descEl = itemEl.querySelector(".db-desc");
      
      if (database[key]) {
        itemEl.classList.add("unlocked");
        statusEl.innerText = "UNLOCKED";
        statusEl.className = "db-status status-unlocked";
        descEl.innerText = specs[key].desc;
      } else {
        itemEl.classList.remove("unlocked");
        statusEl.innerText = "LOCKED";
        statusEl.className = "db-status status-locked";
        descEl.innerText = "Scan target in the ocean depths to unlock scientific readouts.";
      }
    }
  }

  triggerDamageFlash() {
    this.dom.damageFlash.classList.add('active');
    setTimeout(() => {
      this.dom.damageFlash.classList.remove('active');
    }, 180);
  }

  triggerSurfaceBanner(text = "AIR REFILLED") {
    const banner = this.dom.surfaceBanner;
    banner.querySelector('span').innerText = text;
    banner.classList.remove('hidden');
    
    // Re-create the pop animation
    banner.style.animation = 'none';
    banner.offsetHeight; /* trigger reflow */
    banner.style.animation = null;
    
    // Hide after animation finishes (2s)
    setTimeout(() => {
      banner.classList.add('hidden');
    }, 2000);
  }

  updateSonar(playerPos, playerYaw, entities, delta) {
    const ctx = this.sonarCtx;
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, 130, 130);
    
    const cx = 65;
    const cy = 65;
    const radarRadius = 60;
    const sonarRange = 90; // max range mapped is 90 meters
    const scale = radarRadius / sonarRange;
    
    // Update sweep angle
    this.sonarSweepAngle = (this.sonarSweepAngle + delta * 2.5) % (Math.PI * 2);
    const sweep = this.sonarSweepAngle;
    
    // 1. Draw concentric background rings and lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx, cy - radarRadius);
    ctx.lineTo(cx, cy + radarRadius);
    ctx.moveTo(cx - radarRadius, cy);
    ctx.lineTo(cx + radarRadius, cy);
    ctx.stroke();
    
    // 2. Draw CRT Sweep line and fading trail (15 sectors)
    for (let i = 0; i < 15; i++) {
      const angle = sweep - i * 0.04;
      const alpha = 0.28 * (1.0 - i / 15);
      ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
      ctx.lineWidth = i === 0 ? 1.5 : 1.0;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * radarRadius, cy + Math.sin(angle) * radarRadius);
      ctx.stroke();
    }
    
    // 3. Helper to draw fading color-coded blips (Head-Up mapping)
    const drawBlip = (worldX, worldZ, colorStr, size, isSoftCircle = false, softRadius = 0, isVessel = false) => {
      const dx = worldX - playerPos.x;
      const dz = worldZ - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > sonarRange) return;
      
      // Rotate coordinates by negative playerYaw to implement Head-Up mode
      const relX = dx * Math.cos(-playerYaw) - dz * Math.sin(-playerYaw);
      const relZ = dx * Math.sin(-playerYaw) + dz * Math.cos(-playerYaw);
      
      // Map Z to -Y on canvas and X to +X on canvas
      const bx = cx + relX * scale;
      const by = cy - relZ * scale;
      
      // Calculate angle relative to radar sweep center
      const blipAngle = Math.atan2(-relZ, relX);
      let angleDiff = (sweep - blipAngle) % (Math.PI * 2);
      if (angleDiff < 0) angleDiff += Math.PI * 2;
      
      // Linear decay: sweep creates a bright ping, fading to a 10% baseline glow
      const intensity = Math.max(0.1, 1.0 - angleDiff / (Math.PI * 1.5));
      
      ctx.beginPath();
      if (isVessel) {
        // Draw concentric double circle target in cyan/light blue
        ctx.strokeStyle = `rgba(0, 240, 255, ${(intensity * 0.9).toFixed(2)})`;
        ctx.lineWidth = 1.5;
        ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 240, 255, ${(intensity * 0.9).toFixed(2)})`;
        ctx.fillStyle = `rgba(0, 240, 255, ${(intensity * 0.95).toFixed(2)})`;
        ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (isSoftCircle) {
        // Draw soft mountain area
        ctx.strokeStyle = `rgba(242, 179, 20, ${0.16 * intensity})`;
        ctx.fillStyle = `rgba(242, 179, 20, ${0.05 * intensity})`;
        ctx.arc(bx, by, softRadius * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Draw blip dot
        ctx.fillStyle = colorStr.replace('ALPHA', (intensity * 0.95).toFixed(2));
        ctx.arc(bx, by, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Solid white core at full intensity for metallic radar highlight
        ctx.fillStyle = `rgba(255, 255, 255, ${intensity.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(bx, by, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    
    // 4. Draw Mountains (constant Peak locations)
    const mountains = [
      { x: 70, z: 80, radius: 24 },
      { x: -90, z: -70, radius: 20 },
      { x: -80, z: 90, radius: 26 },
      { x: 100, z: -100, radius: 22 }
    ];
    mountains.forEach(m => {
      drawBlip(m.x, m.z, '', 0, true, m.radius);
    });
    
    // 4.5. Draw Research Vessel at (0, 0)
    drawBlip(0, 0, '', 0, false, 0, true);
    
    // 5. Draw entities
    if (entities) {
      if (entities.pearls) {
        entities.pearls.forEach(p => {
          drawBlip(p.mesh.position.x, p.mesh.position.z, 'rgba(255, 215, 0, ALPHA)', 2.5);
        });
      }
      if (entities.jellyfish) {
        entities.jellyfish.forEach(j => {
          drawBlip(j.mesh.position.x, j.mesh.position.z, 'rgba(255, 51, 102, ALPHA)', 3.0);
        });
      }
      if (entities.fish) {
        entities.fish.forEach(f => {
          drawBlip(f.mesh.position.x, f.mesh.position.z, 'rgba(0, 255, 200, ALPHA)', 1.5);
        });
      }
    }
    
    // 6. Draw Player center pointer (Head-Up static orange triangle)
    ctx.fillStyle = '#ff8c00';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5);      // Nose pointing UP
    ctx.lineTo(cx - 4, cy + 5);  // Left tail
    ctx.lineTo(cx, cy + 3);      // Tail center indent
    ctx.lineTo(cx + 4, cy + 5);  // Right tail
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  updateVesselHUD(dist, isDocked) {
    if (!this.dom.statVessel) return;
    if (isDocked) {
      this.dom.statVessel.innerHTML = `<span style="color: var(--color-secondary); font-weight: 700; text-shadow: var(--shadow-neon-secondary);">DOCKED</span>`;
    } else {
      this.dom.statVessel.innerHTML = Math.round(dist) + `<span class="unit">m</span>`;
    }
  }
}
