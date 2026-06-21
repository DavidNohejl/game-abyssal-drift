// ABYSSAL DRIFT - 3D Ocean Game Logic
import * as THREE from 'three';
import { audio } from './audio.js';
import { Input } from './src/Input.js';
import { Environment } from './src/Environment.js';
import { Player } from './src/Player.js';
import { EntityManager } from './src/EntityManager.js';
import { UI } from './src/UI.js';

// GAME STATE CONSTANTS
const STATE_MENU = 'MENU';
const STATE_PLAYING = 'PLAYING';
const STATE_GAMEOVER = 'GAMEOVER';
const STATE_PAUSED = 'PAUSED'; // Used when database modal is open

class Game {
  constructor() {
    this.state = STATE_MENU;
    this.graphicsHigh = true;
    this.time = 0;
    
    // Scientific Database persistent state
    this.database = { pearl: false, jellyfish: false, kelp: false, rock: false, fish: false };
    this.loadDatabase();
    this.scanProgress = 0;
    this.lastScanToneTime = 0;
    this.headlightOn = true;
    
    // Init graphics context
    this.initThree();
    
    // Scanner 3D visual highlights
    this.scanRing = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.3, 16),
      new THREE.MeshBasicMaterial({ color: 0x00ffc8, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    this.scanRing.visible = false;
    this.scene.add(this.scanRing);

    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3()
    ]);
    const laserMat = new THREE.LineBasicMaterial({ color: 0x00ffc8 });
    this.scanLaser = new THREE.Line(laserGeo, laserMat);
    this.scanLaser.visible = false;
    this.scene.add(this.scanLaser);
    
    // Init modules
    this.ui = new UI(this);
    this.input = new Input(this, this.ui.dom.mouseCheckbox);
    this.environment = new Environment(this.scene);
    this.player = new Player(this.scene);
    this.entityManager = new EntityManager(this.scene, this.graphicsHigh);
    
    // Initial spawn layout
    this.entityManager.spawnEntities((x, z) => this.environment.getTerrainHeight(x, z));
    this.entityManager.spawnVessel();
    
    // Start loop
    this.animate();
  }

  // Initializing Three.js context, scene, camera, lights, fog
  initThree() {
    this.container = document.getElementById('canvas-container');
    
    // 1. Scene & Deep Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x041126);
    this.scene.fog = new THREE.FogExp2(0x041126, 0.015);
    
    // 2. Camera Setup
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 350);
    this.camera.position.set(0, 5, -15);
    
    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
    
    // 4. Lighting System
    this.ambientLight = new THREE.AmbientLight(0x0d2b45, 1.5);
    this.scene.add(this.ambientLight);
    
    // Sunlight filtering through ocean surface
    this.sunLight = new THREE.DirectionalLight(0xdcf4ff, 2.5);
    this.sunLight.position.set(0, 50, 20);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 150;
    const d = 40;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);
    
    // Dynamic soft light that follows the camera
    this.camLight = new THREE.PointLight(0x00f0ff, 0.8, 50);
    this.scene.add(this.camLight);

    // Window resize handler
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  loadDatabase() {
    const saved = localStorage.getItem('abyssal_drift_db');
    if (saved) {
      try {
        this.database = JSON.parse(saved);
      } catch (e) {
        this.database = { pearl: false, jellyfish: false, kelp: false, rock: false, fish: false };
      }
    } else {
      this.database = { pearl: false, jellyfish: false, kelp: false, rock: false, fish: false };
    }
  }

  saveDatabase() {
    localStorage.setItem('abyssal_drift_db', JSON.stringify(this.database));
  }

  setGraphics(high) {
    this.graphicsHigh = high;
    this.ui.setGraphicsUI(high);
    this.renderer.shadowMap.enabled = high;
    
    // Enable/disable shadows dynamically
    this.sunLight.castShadow = high;
    
    this.player.setGraphics(high);
    this.entityManager.setGraphics(high);
  }

  setGear(gear) {
    if (this.state !== STATE_PLAYING) return;
    this.player.setGear(gear);
    this.ui.updateGearUI(gear);
  }

  toggleDatabaseModal(show) {
    if (show) {
      if (this.state !== STATE_PLAYING) return;
      this.state = STATE_PAUSED;
      this.ui.renderDatabase(this.database);
      this.ui.dom.databaseModal.classList.remove('hidden');
      
      // Hide scanning visual ring & lasers
      this.scanRing.visible = false;
      this.scanLaser.visible = false;
      this.ui.hideScannerHUD();
    } else {
      if (this.state !== STATE_PAUSED) return;
      this.state = STATE_PLAYING;
      this.ui.dom.databaseModal.classList.add('hidden');
    }
  }

  toggleHeadlight() {
    if (this.state !== STATE_PLAYING) return;
    this.headlightOn = !this.headlightOn;
    this.player.setHeadlight(this.headlightOn);
    this.ui.updateHeadlightUI(this.headlightOn);
    audio.playBubble(); // small feedback sound
  }

  startGame() {
    audio.init();
    
    this.state = STATE_PLAYING;
    this.player.reset();
    this.headlightOn = true;
    this.player.setHeadlight(true);
    this.ui.updateHeadlightUI(true);
    this.ui.updateGearUI(2); // visual sync on startup
    
    // Reset scanner visuals
    this.scanRing.visible = false;
    this.scanLaser.visible = false;
    this.scanProgress = 0;
    this.ui.hideScannerHUD();
    
    // Respawn entities
    this.entityManager.spawnEntities((x, z) => this.environment.getTerrainHeight(x, z));
    this.entityManager.spawnVessel();
    
    // Play start chime
    audio.playStart();
    
    // UI transition
    this.ui.showHUD();
  }

  gameOver() {
    this.state = STATE_GAMEOVER;
    audio.playGameOver();
    this.ui.showGameOver(this.player.score, this.player.maxDepth);
    
    this.scanRing.visible = false;
    this.scanLaser.visible = false;
    this.scanProgress = 0;
  }

  // The Game Loop
  animate() {
    requestAnimationFrame(() => this.animate());
    
    const delta = 0.016; // Fix tick duration ~60fps
    this.time += delta;
    
    // 1. Update backdrop
    this.environment.update(this.time, delta);
    
    // 2. Handle gameplay if active
    if (this.state === STATE_PLAYING) {
      this.player.update(
        delta,
        this.time,
        this.input,
        this.environment,
        this.camera,
        this.camLight,
        this.sunLight,
        () => this.ui.triggerSurfaceBanner()
      );
      
      this.entityManager.update(this.time, delta);
      this.checkCollisions();
      this.ui.updateHUD(
        this.player.oxygen,
        this.player.depth,
        this.player.score
      );
      
      this.ui.updateSonar(
        this.player.mesh.position,
        this.player.mesh.rotation.y,
        this.entityManager,
        delta
      );
      
      // Research Vessel distance and docking checks
      const vesselDockPos = new THREE.Vector3(0, -1.2, 0);
      const distToVessel = this.player.mesh.position.distanceTo(vesselDockPos);
      if (distToVessel < 4.5 && !this.player.isDocked && this.time > this.player.dockCooldown) {
        this.player.isDocked = true;
        this.ui.triggerSurfaceBanner("SUBMERSIBLE DOCKED");
      }
      this.ui.updateVesselHUD(distToVessel, this.player.isDocked);
      
      // Pass real-time depth metric to filter ambient frequency pitch
      audio.updateDepthEffects(this.player.depth);
      
      // 3. Scan checks
      this.updateScanner(delta);

      if (this.player.oxygen <= 0) {
        this.gameOver();
      }
    } else if (this.state === STATE_PAUSED) {
      // Just render frame, hide dynamic laser/ring
      this.scanRing.visible = false;
      this.scanLaser.visible = false;
    } else {
      // In menu/game over: Slowly rotate/float player in center background
      this.player.updateMenuAnimation(this.time, delta, this.camera);
    }
    
    // Render Frame
    this.renderer.render(this.scene, this.camera);
  }

  updateScanner(delta) {
    const subPos = this.player.mesh.position;
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.mesh.quaternion);
    
    let bestTarget = null;
    let minAngle = Math.PI;
    
    // Gather all scanable targets in the scene
    const scanables = [
      ...this.entityManager.pearls.map(p => ({ mesh: p.mesh, type: 'pearl', name: 'Bioluminescent Pearl' })),
      ...this.entityManager.jellyfish.map(j => ({ mesh: j.mesh, type: 'jellyfish', name: 'Abyssal Jellyfish' })),
      ...this.entityManager.kelps.map(k => ({ mesh: k, type: 'kelp', name: 'Abyssal Kelp Forest' })),
      ...this.entityManager.rocks.map(r => ({ mesh: r, type: 'rock', name: 'Volcanic Coral Rock' })),
      ...this.entityManager.fish.map(f => ({ mesh: f.mesh, type: 'fish', name: 'Abyssal Schooling Fish' }))
    ];
    
    scanables.forEach(obj => {
      const toObj = obj.mesh.position.clone().sub(subPos);
      const dist = toObj.length();
      if (dist < 28.0) { // Range limit
        toObj.normalize();
        const angle = forward.angleTo(toObj);
        if (angle < 0.28) { // Target cone (~16 degrees)
          if (angle < minAngle) {
            minAngle = angle;
            bestTarget = { ...obj, dist };
          }
        }
      }
    });
    
    if (bestTarget) {
      this.scanRing.position.copy(bestTarget.mesh.position);
      this.scanRing.lookAt(this.camera.position);
      
      // Scale dynamic ring pulse
      let ringScale = 1.2;
      if (bestTarget.type === 'kelp') ringScale = 2.0;
      if (bestTarget.type === 'rock') ringScale = 3.0;
      if (bestTarget.type === 'fish') ringScale = 0.8;
      this.scanRing.scale.setScalar(ringScale + Math.sin(this.time * 5.0) * 0.1);
      this.scanRing.visible = true;
      
      const isScanned = !!this.database[bestTarget.type];
      
      if (this.input.keys.f && !isScanned) {
        // Play scan ping sound
        if (!this.lastScanToneTime || this.time - this.lastScanToneTime > 0.18) {
          audio.playScanTones(this.scanProgress);
          this.lastScanToneTime = this.time;
        }
        
        this.scanProgress = Math.min(100, this.scanProgress + delta * 35.0); // Complete in ~2.8s
        
        // Laser bridge
        const nosePos = new THREE.Vector3(0, 0, 2.15).applyMatrix4(this.player.mesh.matrixWorld);
        const targetPos = bestTarget.mesh.position;
        
        const posAttr = this.scanLaser.geometry.attributes.position;
        posAttr.setXYZ(0, nosePos.x, nosePos.y, nosePos.z);
        posAttr.setXYZ(1, targetPos.x, targetPos.y, targetPos.z);
        posAttr.needsUpdate = true;
        this.scanLaser.visible = true;
        
        if (this.scanProgress >= 100) {
          if (!this.database[bestTarget.type]) {
            this.database[bestTarget.type] = true;
            this.saveDatabase();
            audio.playScanSuccess();
            this.ui.triggerSurfaceBanner("ARCHIVES UNLOCKED: " + bestTarget.name);
          }
          this.scanProgress = 0;
        }
      } else {
        this.scanProgress = 0;
        this.scanLaser.visible = false;
      }
      
      this.ui.showScannerHUD(bestTarget.name, bestTarget.dist, this.scanProgress, isScanned, bestTarget.type);
    } else {
      this.scanRing.visible = false;
      this.scanLaser.visible = false;
      this.scanProgress = 0;
      this.ui.hideScannerHUD();
    }
  }

  // Bounding-sphere checks for pearl collecting and jellyfish stings
  checkCollisions() {
    const turtlePos = this.player.mesh.position;
    
    // 1. Pearl Collisions (Pearl radius 3.2m check)
    this.entityManager.pearls.forEach(p => {
      const dist = turtlePos.distanceTo(p.mesh.position);
      if (dist < 3.2) {
        this.player.collectPearl();
        audio.playBubble();
        this.entityManager.respawnPearl(p, turtlePos);
      }
    });
    
    // 2. Jellyfish Collisions (Jellyfish radius 2.5m check)
    this.entityManager.jellyfish.forEach(j => {
      const dist = turtlePos.distanceTo(j.mesh.position);
      if (dist < 2.5) {
        if (this.player.applySting(j, this.time)) {
          this.ui.triggerDamageFlash();
        }
      }
    });
  }
}

// Initial launch on page load
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
