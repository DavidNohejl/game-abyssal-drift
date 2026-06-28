import * as THREE from 'three';
import { audio } from '../audio.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group(); // Represents the main submarine container

    // Submarine parameters
    this.score = 0;
    this.oxygen = 100; // Represents life support systems
    this.depth = 0;
    this.maxDepth = 0;

    this.selectedGear = 2; // Default starting gear is 2 (Cruise)
    this.swimTime = 0;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3(0, 0, 1);
    this.headlightOn = true;
    this.graphicsHigh = true;
    this.graphicsLevel = 'HIGH';
    this.isDocked = false;
    this.dockCooldown = 0;

    // Upgrades and autopilot navigation state
    this.upgrades = {
      speed: 0,
      oxygen: 0,
      autopilot: false // unlocked or not
    };
    this.autopilotActive = false;
    this.cameraMode = 0; // 0: Chase, 1: First-Person, 2: Top-Down, 3: Side Cinematic
    this.autopilotStatus = "OFFLINE";
    this.freeLookYaw = 0;
    this.freeLookPitch = 0;

    // Bubble Pool for exhaust bubbles
    this.bubblePool = [];
    this.bubblePoolIndex = 0;

    this.createModel();
    this.createBubblePool();

    this.scene.add(this.mesh);
  }

  createModel() {
    // 1. Sleek metallic hull material (dark steel/carbon grey - made less shiny and more matte)
    this.hullMat = new THREE.MeshStandardMaterial({
      color: 0x2d3a4b,
      roughness: 0.55,
      metalness: 0.35
    });

    // Accent safety orange/yellow trim material
    this.accentMat = new THREE.MeshStandardMaterial({
      color: 0xff8c00,
      roughness: 0.6,
      metalness: 0.25
    });

    // Glowing cyan neon/light material
    this.neonMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff
    });

    // Procedural Carbon Fiber weave texture & Plate Seams generator for Ultra settings
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // 1. Base height map fill (neutral gray)
    ctx.fillStyle = '#888888';
    ctx.fillRect(0, 0, 128, 128);
    
    // 2. Draw extremely fine carbon fiber micro-weave structure (2x2 checkerboard pixels)
    for (let y = 0; y < 128; y += 4) {
      for (let x = 0; x < 128; x += 4) {
        const offset = ((x + y) / 4) % 2 === 0;
        ctx.fillStyle = offset ? '#929292' : '#7e7e7e';
        ctx.fillRect(x, y, 4, 4);
      }
    }
    
    // 3. Draw recessed plate seams (dark grooves for bump caving)
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = '#1b1b1b'; // dark lines create indented seams
    
    // Horizontal seams
    ctx.beginPath();
    ctx.moveTo(0, 32);
    ctx.lineTo(128, 32);
    ctx.moveTo(0, 96);
    ctx.lineTo(128, 96);
    ctx.stroke();
    
    // Vertical seams (staggered brick/plate layout)
    ctx.beginPath();
    // Top row
    ctx.moveTo(32, 0); ctx.lineTo(32, 32);
    ctx.moveTo(96, 0); ctx.lineTo(96, 32);
    // Mid row
    ctx.moveTo(0, 32); ctx.lineTo(0, 96);
    ctx.moveTo(64, 32); ctx.lineTo(64, 96);
    // Bottom row
    ctx.moveTo(32, 96); ctx.lineTo(32, 128);
    ctx.moveTo(96, 96); ctx.lineTo(96, 128);
    ctx.stroke();

    // 4. Draw metal rivets along seams for industrial plating look
    ctx.fillStyle = '#a0a0a0'; // raised dots
    const drawRivet = (rx, ry) => {
      ctx.beginPath();
      ctx.arc(rx, ry, 1.2, 0, Math.PI * 2);
      ctx.fill();
    };
    // Place rivets periodically along horizontal seams
    for (let rx = 8; rx < 128; rx += 16) {
      drawRivet(rx, 35);
      drawRivet(rx, 29);
      drawRivet(rx, 99);
      drawRivet(rx, 93);
    }
    
    this.carbonBumpTex = new THREE.CanvasTexture(canvas);
    this.carbonBumpTex.wrapS = THREE.RepeatWrapping;
    this.carbonBumpTex.wrapT = THREE.RepeatWrapping;
    this.carbonBumpTex.repeat.set(10, 5); // Tiled larger to make panels visible and fiber structure tiny!

    // Deck safety pipes/cables (orange tubes running on the top flanks of the hull capsule)
    const pipeGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.3, 6);
    pipeGeo.rotateX(Math.PI / 2);
    
    // Left safety deck pipe
    this.leftPipe = new THREE.Mesh(pipeGeo, this.accentMat);
    this.leftPipe.position.set(0.28, 0.45, 0.9);
    this.leftPipe.rotation.x = 0.08; // slightly slanted forward-down
    this.mesh.add(this.leftPipe);
    
    // Right safety deck pipe
    this.rightPipe = new THREE.Mesh(pipeGeo, this.accentMat);
    this.rightPipe.position.set(-0.28, 0.45, 0.9);
    this.rightPipe.rotation.x = 0.08;
    this.mesh.add(this.rightPipe);

    this.windowGlasses = [];

    // 2. Main Hull (Cut-open capsule shape with hollow cockpit section)
    this.hull = new THREE.Group();
    this.mesh.add(this.hull);

    // Rear Endcap Dome (Z = -1.0 to -1.85)
    const rearCapGeo = new THREE.SphereGeometry(0.85, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    rearCapGeo.rotateX(-Math.PI / 2); // point backward
    const rearCap = new THREE.Mesh(rearCapGeo, this.hullMat);
    rearCap.position.set(0, 0, -1.0);
    rearCap.castShadow = true;
    rearCap.receiveShadow = true;
    this.hull.add(rearCap);

    // Main Mid Body Cylinder (Z = -1.0 to 1.0)
    const bodyCylGeo = new THREE.CylinderGeometry(0.85, 0.85, 2.0, 16);
    bodyCylGeo.rotateX(Math.PI / 2);
    const bodyCyl = new THREE.Mesh(bodyCylGeo, this.hullMat);
    bodyCyl.position.set(0, 0, 0);
    bodyCyl.castShadow = true;
    bodyCyl.receiveShadow = true;
    this.hull.add(bodyCyl);

    // Front Nose Taper Cone (Z = 1.0 to 1.7 - open-ended to fit the cockpit)
    const frontTaperGeo = new THREE.CylinderGeometry(0.52, 0.85, 0.7, 16, 1, true);
    frontTaperGeo.rotateX(Math.PI / 2);
    const frontTaper = new THREE.Mesh(frontTaperGeo, this.hullMat);
    frontTaper.position.set(0, 0, 1.35);
    frontTaper.castShadow = true;
    frontTaper.receiveShadow = true;
    this.hull.add(frontTaper);

    // Raised safety orange metallic structural ribs/bands
    this.hullRibs = [];
    const ribPositions = [0.85, -0.85];
    ribPositions.forEach(zOffset => {
      const zRatio = zOffset / 2.2;
      const r = 0.85 * Math.sqrt(Math.max(0.1, 1.0 - zRatio * zRatio));
      
      const ribGeo = new THREE.CylinderGeometry(r + 0.015, r + 0.015, 0.06, 16, 1, true);
      ribGeo.rotateX(Math.PI / 2);
      const rib = new THREE.Mesh(ribGeo, this.accentMat);
      rib.position.set(0, 0, zOffset);
      rib.castShadow = true;
      rib.receiveShadow = true;
      this.mesh.add(rib);
      this.hullRibs.push(rib);
    });

    // Glowing Neon Side Decals/Stripes along flanks
    this.neonStripes = [];
    const stripeGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.2, 6);
    stripeGeo.rotateX(Math.PI / 2);
    
    const leftStripe = new THREE.Mesh(stripeGeo, this.neonMat);
    leftStripe.position.set(0.85 + 0.01, -0.15, 0.0);
    this.mesh.add(leftStripe);
    this.neonStripes.push(leftStripe);
    
    const rightStripe = new THREE.Mesh(stripeGeo, this.neonMat);
    rightStripe.position.set(-0.85 - 0.01, -0.15, 0.0);
    this.mesh.add(rightStripe);
    this.neonStripes.push(rightStripe);

    // 3. Conning Tower / Sail (safety orange accent)
    const towerGeo = new THREE.BoxGeometry(0.35, 0.6, 0.8);
    const tower = new THREE.Mesh(towerGeo, this.accentMat);
    tower.position.set(0, 0.7, 0.2);
    tower.castShadow = true;
    this.mesh.add(tower);

    // High-tech Instrument Mast & Dual Antennae Masts
    const mastGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8);
    const antennaLeft = new THREE.Mesh(mastGeo, this.hullMat);
    antennaLeft.position.set(0.08, 1.25, 0.35);
    this.mesh.add(antennaLeft);

    const antennaRight = new THREE.Mesh(mastGeo, this.hullMat);
    antennaRight.position.set(-0.08, 1.25, 0.35);
    this.mesh.add(antennaRight);

    // Blinking strobe tip lights (warning lights on masts)
    const strobeGeo = new THREE.SphereGeometry(0.035, 8, 8);
    this.blueStrobe = new THREE.Mesh(strobeGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
    this.blueStrobe.position.set(0.08, 1.5, 0.35);
    this.mesh.add(this.blueStrobe);

    this.redStrobe = new THREE.Mesh(strobeGeo, new THREE.MeshBasicMaterial({ color: 0xff3333 }));
    this.redStrobe.position.set(-0.08, 1.5, 0.35);
    this.mesh.add(this.redStrobe);

    // 4. Glowing Portholes / Windows with metallic outer frames (3 along each side)
    const frameGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.03, 12);
    frameGeo.rotateX(Math.PI / 2);
    const glassGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.035, 12);
    glassGeo.rotateX(Math.PI / 2);

    for (let i = 0; i < 3; i++) {
      const zOffset = 0.6 - i * 0.6;
      
      // Since the windows sit on the straight cylindrical body (Z = -1.0 to 1.0), their hull radius is exactly 0.85
      const r = 0.85;

      // Left side porthole (grouped frame + neon glass)
      const leftPorthole = new THREE.Group();
      leftPorthole.position.set(r, 0.1, zOffset);
      leftPorthole.rotation.y = Math.PI / 2;
      
      const leftFrame = new THREE.Mesh(frameGeo, this.hullMat);
      const leftGlass = new THREE.Mesh(glassGeo, this.neonMat);
      leftPorthole.add(leftFrame);
      leftPorthole.add(leftGlass);
      this.mesh.add(leftPorthole);
      this.windowGlasses.push(leftGlass);

      // Right side porthole (grouped frame + neon glass)
      const rightPorthole = new THREE.Group();
      rightPorthole.position.set(-r, 0.1, zOffset);
      rightPorthole.rotation.y = -Math.PI / 2;
      
      const rightFrame = new THREE.Mesh(frameGeo, this.hullMat);
      const rightGlass = new THREE.Mesh(glassGeo, this.neonMat);
      rightPorthole.add(rightFrame);
      rightPorthole.add(rightGlass);
      this.mesh.add(rightPorthole);
      this.windowGlasses.push(rightGlass);
    }

    // 5. Panoramic Cockpit Nose Dome Viewport & Interior Cockpit Group
    this.cockpitGroup = new THREE.Group();
    this.mesh.add(this.cockpitGroup);

    // Large glass cupola dome (matches the sleek capsule frontend at Z=1.7)
    const noseDomeGeo = new THREE.SphereGeometry(0.52, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    noseDomeGeo.rotateX(Math.PI / 2); // point forward
    this.noseDome = new THREE.Mesh(noseDomeGeo, this.neonMat);
    this.noseDome.position.set(0, 0, 1.7); // starts exactly at Z = 1.7 nose ring opening
    this.cockpitGroup.add(this.noseDome);
    this.windowGlasses.push(this.noseDome);

    // Materials for interior pilot, chair, and dashboard
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.1, roughness: 0.8 });
    const suitMat = new THREE.MeshStandardMaterial({ color: 0xdd5500, metalness: 0.1, roughness: 0.6 }); // safety orange spacesuit
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.2, roughness: 0.4 });
    const dashboardMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5, roughness: 0.5 });

    // Seat base
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.16), chairMat);
    seatBase.position.set(0, -0.22, 1.55);
    this.cockpitGroup.add(seatBase);

    // Seat back
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.04), chairMat);
    seatBack.position.set(0, -0.08, 1.48);
    seatBack.rotation.x = -0.15; // tilted back
    this.cockpitGroup.add(seatBack);

    // Pilot Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 6), suitMat);
    torso.position.set(0, -0.08, 1.55);
    torso.rotation.x = 0.1;
    this.cockpitGroup.add(torso);

    // Pilot Helmet/Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), helmetMat);
    head.position.set(0, 0.04, 1.55);
    this.cockpitGroup.add(head);

    // Helmet glowing visor stripe (futuristic spacesuit look)
    const visorGeo = new THREE.SphereGeometry(0.053, 8, 8, 0, Math.PI, 0.3, 0.5);
    visorGeo.rotateX(Math.PI / 2);
    const visor = new THREE.Mesh(visorGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
    visor.position.set(0, 0.045, 1.55);
    this.cockpitGroup.add(visor);

    // Pilot Arms
    const armLeft = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.12), suitMat);
    armLeft.position.set(0.08, -0.08, 1.60);
    armLeft.rotation.y = 0.2;
    this.cockpitGroup.add(armLeft);

    const armRight = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.12), suitMat);
    armRight.position.set(-0.08, -0.08, 1.60);
    armRight.rotation.y = -0.2;
    this.cockpitGroup.add(armRight);

    // Dashboard Console
    const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.12), dashboardMat);
    consoleBox.position.set(0, -0.22, 1.73);
    this.cockpitGroup.add(consoleBox);

    // Console screen plane (glowing neon green dashboard)
    const screenGeo = new THREE.PlaneGeometry(0.13, 0.07);
    screenGeo.rotateX(-Math.PI / 4); // angled towards pilot
    const consoleScreen = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ color: 0x00ffaa }));
    consoleScreen.position.set(0, -0.165, 1.69);
    this.cockpitGroup.add(consoleScreen);

    // Spotlight pointing forward and tilted downwards (stronger, longer range, highly focused)
    this.searchlight = new THREE.SpotLight(0x00ffff, 45.0, 85, Math.PI / 12, 0.8, 1.0);
    this.searchlight.position.set(0, 0, 2.15);
    this.searchlight.castShadow = true;
    this.searchlight.shadow.mapSize.width = 512;
    this.searchlight.shadow.mapSize.height = 512;

    this.searchlightTarget = new THREE.Object3D();
    this.searchlightTarget.position.set(0, -2.1, 10.0); // Tilted down by 15 degrees
    this.mesh.add(this.searchlightTarget);
    this.searchlight.target = this.searchlightTarget;
    this.mesh.add(this.searchlight);

    // Volumetric spotlight light beam cutting through fog (soft volumetric shader god-ray)
    const beamGeo = new THREE.ConeGeometry(2.4, 18.0, 16, 1, true); // base radius 2.4 matches 15-degree spotlight
    beamGeo.rotateX(-Math.PI / 2); // rotate so apex is at negative Z, base at positive Z
    beamGeo.translate(0, 0, 9.0);  // shift so apex is at Z = 0, base at Z = 18.0
    const beamMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying float vDepthZ;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewDir = -normalize(mvPosition.xyz);
          vDepthZ = position.z; // local Z coordinate (0 at apex, 18 at base)
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying float vDepthZ;
        
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewDir);
          
          // Soft silhouette edge falloff to remove hard plastic cylinder edges
          float edgeFalloff = dot(normal, viewDir);
          edgeFalloff = abs(edgeFalloff);
          edgeFalloff = pow(edgeFalloff, 1.5);
          
          // Distance falloff from headlight source (0 at nose, 18 at tip)
          float distFalloff = 1.0 - (vDepthZ / 18.0);
          distFalloff = clamp(distFalloff, 0.0, 1.0);
          distFalloff = pow(distFalloff, 1.2);
          
          // Shimmering micro-dust noise along the beam
          float shimmer = 0.8 + 0.2 * sin(vDepthZ * 2.5);
          
          float finalOpacity = 0.38 * edgeFalloff * distFalloff * shimmer;
          
          gl_FragColor = vec4(vec3(0.0, 0.95, 1.0), finalOpacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.searchlightBeam = new THREE.Mesh(beamGeo, beamMat);
    this.searchlightBeam.position.set(0, 0, 2.15); // Place apex exactly at the nose tip
    this.searchlightBeam.rotation.x = 0.26; // Tilt beam down by 15 degrees (0.26 radians) to match target
    this.mesh.add(this.searchlightBeam);

    // 6. Thruster Nozzle & Propeller screw
    const nozzleGeo = new THREE.CylinderGeometry(0.4, 0.3, 0.4, 12);
    nozzleGeo.rotateX(Math.PI / 2);
    const nozzle = new THREE.Mesh(nozzleGeo, this.hullMat);
    nozzle.position.set(0, 0, -2.1);
    this.mesh.add(nozzle);

    // Glowing exhaust core
    const exhaustGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12);
    exhaustGeo.rotateX(Math.PI / 2);
    const exhaustMat = new THREE.MeshBasicMaterial({ color: 0xff7700 });
    const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust.position.set(0, 0, -2.25);
    this.mesh.add(exhaust);

    // Propeller Group
    this.propellerGroup = new THREE.Group();
    this.propellerGroup.position.set(0, 0, -2.35); // right behind nozzle

    const hubGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
    hubGeo.rotateX(Math.PI / 2);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5, roughness: 0.5 });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    this.propellerGroup.add(hub);

    // 4 Propeller Blades (safety yellow/gold accent)
    const bladeGeo = new THREE.BoxGeometry(0.08, 0.65, 0.02);
    bladeGeo.translate(0, 0.32, 0); // pivot at base
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      metalness: 0.4,
      roughness: 0.5
    });
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.z = (i * Math.PI) / 2;
      this.propellerGroup.add(blade);
    }
    this.mesh.add(this.propellerGroup);

    // Ducted Shroud around propeller screw (ducted fan propulsion)
    const ductGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.35, 12, 1, true);
    ductGeo.rotateX(Math.PI / 2);
    this.ductMat = this.hullMat.clone();
    this.ductMat.side = THREE.DoubleSide; // prevent back-face culling/disappearing
    const duct = new THREE.Mesh(ductGeo, this.ductMat);
    duct.position.set(0, 0, -2.35);
    duct.castShadow = true;
    duct.receiveShadow = true;
    this.mesh.add(duct);

    // 7. Stabilizing Control Surfaces (Fins, rudders, elevators)
    // Calculate tapered hull width at Z = 1.25 for front diving planes (in front of windows)
    const planeZ = 1.25;
    const planeR = 0.85 * Math.sqrt(Math.max(0.1, 1.0 - (planeZ / 2.2) * (planeZ / 2.2)));

    // Left front diving plane
    this.leftFin = new THREE.Group();
    this.leftFin.position.set(planeR, 0, planeZ);
    const finGeo = new THREE.BoxGeometry(0.4, 0.03, 0.22);
    finGeo.translate(0.2, 0, 0); // pivot
    const leftFinMesh = new THREE.Mesh(finGeo, this.accentMat);
    this.leftFin.add(leftFinMesh);
    this.mesh.add(this.leftFin);

    // Right front diving plane
    this.rightFin = new THREE.Group();
    this.rightFin.position.set(-planeR, 0, planeZ);
    const finGeoRight = new THREE.BoxGeometry(0.4, 0.03, 0.22);
    finGeoRight.translate(-0.2, 0, 0);
    const rightFinMesh = new THREE.Mesh(finGeoRight, this.accentMat);
    this.rightFin.add(rightFinMesh);
    this.mesh.add(this.rightFin);

    // Rear vertical rudder (steer yaw)
    this.rudder = new THREE.Group();
    this.rudder.position.set(0, 0, -1.8);
    const rudderGeo = new THREE.BoxGeometry(0.03, 0.7, 0.25);
    rudderGeo.translate(0, 0.35, -0.125); // pivot at bottom-front
    const rudderMesh = new THREE.Mesh(rudderGeo, this.accentMat);
    this.rudder.add(rudderMesh);
    this.mesh.add(this.rudder);

    // Rear horizontal elevator (steer pitch)
    this.elevator = new THREE.Group();
    this.elevator.position.set(0, 0, -1.8);
    const elevatorGeo = new THREE.BoxGeometry(0.7, 0.03, 0.25);
    elevatorGeo.translate(0, 0, -0.125);
    const elevatorMesh = new THREE.Mesh(elevatorGeo, this.accentMat);
    this.elevator.add(elevatorMesh);
    this.mesh.add(this.elevator);
  }

  createBubblePool() {
    const bubbleGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const bubbleMat = new THREE.MeshBasicMaterial({
      color: 0x88f0ff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < 60; i++) {
      const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
      bubble.visible = false;
      this.scene.add(bubble);
      this.bubblePool.push({
        mesh: bubble,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0
      });
    }
  }

  spawnBubble(pos, vel) {
    const bubble = this.bubblePool[this.bubblePoolIndex];
    bubble.mesh.position.copy(pos);
    bubble.mesh.visible = true;

    bubble.velocity.copy(vel).add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      0.3 + Math.random() * 0.5, // float up
      (Math.random() - 0.5) * 0.5
    ));

    bubble.life = 0;
    bubble.maxLife = 0.8 + Math.random() * 0.8;

    this.bubblePoolIndex = (this.bubblePoolIndex + 1) % this.bubblePool.length;
  }

  reset() {
    this.score = 0;
    this.oxygen = 100;
    this.depth = 0;
    this.maxDepth = 0;
    this.velocity.set(0, 0, 0);
    this.direction.set(0, 0, 1);
    this.selectedGear = 2; // start back at cruise
    this.isDocked = false;
    this.dockCooldown = 0;
    this.autopilotActive = false;
    this.cameraMode = 0; // reset to default Chase view
    this.updateHeadlightVisibility();

    this.mesh.position.set(0, -15, 0);
    this.mesh.rotation.set(0, 0, 0);

    // Hide active bubbles
    this.bubblePool.forEach(b => {
      b.mesh.visible = false;
    });
  }

  setGraphics(high) {
    this.setGraphicsLevel(high ? 'HIGH' : 'LOW');
  }

  setGraphicsLevel(level) {
    this.graphicsLevel = level;
    this.graphicsHigh = (level !== 'LOW');
    const hasShadows = (level === 'HIGH' || level === 'ULTRA');
    
    this.mesh.traverse(child => {
      if (child.isMesh) {
        child.castShadow = hasShadows;
        child.receiveShadow = hasShadows;
      }
    });

    if (this.searchlight) {
      this.searchlight.castShadow = hasShadows;
      if (hasShadows) {
        if (level === 'ULTRA') {
          this.searchlight.shadow.mapSize.width = 2048;
          this.searchlight.shadow.mapSize.height = 2048;
          this.searchlight.shadow.bias = -0.003;
        } else {
          this.searchlight.shadow.mapSize.width = 512;
          this.searchlight.shadow.mapSize.height = 512;
          this.searchlight.shadow.bias = -0.001;
        }
        if (this.searchlight.shadow.map) {
          this.searchlight.shadow.map.dispose();
          this.searchlight.shadow.map = null;
        }
      }
    }

    // Phase 3: Physical Materials Clearcoat & Refractive Glass
    if (this.hullMat && this.accentMat) {
      if (level === 'ULTRA') {
        // Ultra: Matte paint with clearcoat specular highlights and carbon fiber texture bumpmap
        this.hullMat.roughness = 0.55;
        this.hullMat.metalness = 0.35;
        this.hullMat.clearcoat = 0.4;
        this.hullMat.clearcoatRoughness = 0.15;
        this.hullMat.bumpMap = this.carbonBumpTex;
        this.hullMat.bumpScale = 0.012;
        
        this.accentMat.roughness = 0.6;
        this.accentMat.metalness = 0.25;
        this.accentMat.clearcoat = 0.45;
        this.accentMat.clearcoatRoughness = 0.20;

        if (this.ductMat) {
          this.ductMat.roughness = 0.55;
          this.ductMat.metalness = 0.35;
          this.ductMat.clearcoat = 0.4;
          this.ductMat.clearcoatRoughness = 0.15;
          this.ductMat.bumpMap = this.carbonBumpTex;
          this.ductMat.bumpScale = 0.012;
        }
        
        // Use physical refractive glass for windows
        if (!this.physicalGlassMat) {
          this.physicalGlassMat = new THREE.MeshPhysicalMaterial({
            color: 0x00f0ff,
            emissive: 0x0080a0,
            emissiveIntensity: 0.7,
            roughness: 0.1,
            metalness: 0.1,
            transmission: 0.95, // refract background
            thickness: 0.4,
            ior: 1.5,
            transparent: true
          });
        }
        
        if (this.windowGlasses) {
          this.windowGlasses.forEach(g => {
            g.material = this.physicalGlassMat;
          });
        }
      } else {
        // Standard (High/Low): standard non-clearcoat paint, no bumpmap
        this.hullMat.clearcoat = 0.0;
        this.hullMat.bumpMap = null;
        this.accentMat.clearcoat = 0.0;

        if (this.ductMat) {
          this.ductMat.clearcoat = 0.0;
          this.ductMat.bumpMap = null;
        }
        
        // Restore standard glowing neon
        if (this.windowGlasses && this.neonMat) {
          this.windowGlasses.forEach(g => {
            g.material = this.neonMat;
          });
        }
      }
      this.hullMat.needsUpdate = true;
      this.accentMat.needsUpdate = true;
    }

    if (this.neonStripes) {
      this.neonStripes.forEach(s => {
        s.visible = this.graphicsHigh;
      });
    }

    this.updateHeadlightVisibility();
  }

  setHeadlight(on) {
    this.headlightOn = on;
    this.updateHeadlightVisibility();
  }

  updateHeadlightVisibility() {
    const visible = this.headlightOn && (this.graphicsHigh !== undefined ? this.graphicsHigh : true);

    if (this.searchlight && this.searchlightBeam) {
      if (this.cameraMode === 1) {
        // First-Person cockpit: mount under-chin and forward to prevent camera obstruction
        this.searchlight.position.set(0, -0.7, 3.2);
        this.searchlightBeam.position.set(0, -0.7, 3.2);
      } else {
        // Third-person views: mount at nose tip
        this.searchlight.position.set(0, 0, 2.15);
        this.searchlightBeam.position.set(0, 0, 2.15);
      }

      this.searchlight.visible = visible;
      this.searchlightBeam.visible = visible;
    }
  }

  setGear(gear) {
    if (gear >= 0 && gear <= 3) {
      this.selectedGear = gear;
    }
  }

  collectPearl() {
    this.score++;
    this.oxygen = Math.min(100, this.oxygen + 18.0);
  }

  applySting(jellyfish, currentTime) {
    if (jellyfish.stingCooldown && currentTime < jellyfish.stingCooldown) return false;

    jellyfish.stingCooldown = currentTime + 1.5;

    this.oxygen = Math.max(0, this.oxygen - 18.0);
    audio.playSting();

    // Pushback physics (Push submarine opposite to sting)
    const pushDir = this.mesh.position.clone().sub(jellyfish.mesh.position).normalize();
    pushDir.y = 0.2;
    this.mesh.position.addScaledVector(pushDir, 5.0);

    return true;
  }

  update(delta, time, input, environment, camera, camLight, sunLight, triggerSurfaceBanner) {
    // 1. Update bubble particles physics (exhaust bubble simulation)
    this.bubblePool.forEach(b => {
      if (!b.mesh.visible) return;
      b.life += delta;
      if (b.life >= b.maxLife) {
        b.mesh.visible = false;
      } else {
        b.mesh.position.addScaledVector(b.velocity, delta);
        b.mesh.scale.setScalar(1 + (b.life / b.maxLife) * 1.5);
      }
    });

    const sub = this.mesh;

    if (this.isDocked) {
      sub.position.set(0, -2.2, 0);
      sub.rotation.set(0, 0, 0);
      this.velocity.set(0, 0, 0);
      this.oxygen = 100;

      // Propeller spins slowly at dock
      this.propellerGroup.rotation.z += 0.25 * delta;
      this.rudder.rotation.y = 0;
      this.elevator.rotation.x = 0;
      this.leftFin.rotation.x = 0;
      this.rightFin.rotation.x = 0;

      // Above-water cinematic overlook camera looking down at the research vessel and docked sub
      const targetCamPos = new THREE.Vector3(14, 12, -20);
      camera.position.lerp(targetCamPos, 0.08);
      camera.lookAt(new THREE.Vector3(0, -0.5, 0));

      camLight.position.copy(camera.position);
      sunLight.position.set(sub.position.x, sub.position.y + 45, sub.position.z + 15);
      sunLight.target = sub;

      this.depth = -sub.position.y;

      // Press X or S to undock (ballast down / steer back)
      if (input.keys.x || input.keys.s) {
        this.isDocked = false;
        sub.position.y = -6.5; // push down out of docking port range (port is at Y = -1.2, Y = -6.5 is 5.3m away, which is > 4.5m radius)
        this.dockCooldown = time + 2.0; // 2 seconds cooldown before it can dock again
      }
      return;
    }

    // Forward direction vector of the submarine
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(sub.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(sub.quaternion);

    let pitchInput = 0;
    let yawInput = 0;
    let heaveInput = 0;

    // Check for manual steering to override autopilot
    const hasSteeringInput =
      input.keys.w || input.keys.s || input.keys.a || input.keys.d ||
      input.keys.Space || input.keys.c ||
      (input.mouseControl && (Math.abs(input.mouse.x) > 0.1 || Math.abs(input.mouse.y) > 0.1)) ||
      input.joystick.active;

    if (this.autopilotActive && hasSteeringInput) {
      this.autopilotActive = false;
      if (typeof triggerSurfaceBanner === 'function') {
        triggerSurfaceBanner("AUTOPILOT OVERRIDDEN");
      }
    }

    if (this.autopilotActive) {
      const vesselDockPos = new THREE.Vector3(0, -1.2, 0);
      const horizontalDist = Math.sqrt(sub.position.x * sub.position.x + sub.position.z * sub.position.z);
      const transitY = -5.0; // safe depth clearing all peaks

      let targetPos = new THREE.Vector3();
      let desiredPitch = null;

      // 1. Determine base phase target
      if (sub.position.y < -6.5 && horizontalDist > 8.0) {
        this.autopilotStatus = "ASCENDING TO SAFE TRANSIT DEPTH (-5M)";
        targetPos.set(sub.position.x * 0.9, transitY, sub.position.z * 0.9);
      } else if (horizontalDist > 5.5) {
        this.autopilotStatus = "CRUISING TO MOTHER SHIP COORDINATES";
        targetPos.set(0, transitY, 0);
      } else {
        this.autopilotStatus = "DESCENDING TO DOCKING PORT";
        targetPos.copy(vesselDockPos);
        desiredPitch = 0; // Force level pitch during docking alignment to prevent loops/spinning
      }

      // 2. Predictive terrain height lookahead for collision avoidance
      let maxTerrainAhead = -999;
      const toTargetH = new THREE.Vector3(targetPos.x - sub.position.x, 0, targetPos.z - sub.position.z);
      const distH = toTargetH.length();
      if (distH > 0.1) {
        const dirH = toTargetH.clone().normalize();
        const checkDistances = [4, 8, 12, 16];
        for (const d of checkDistances) {
          if (d < distH) {
            const px = sub.position.x + dirH.x * d;
            const pz = sub.position.z + dirH.z * d;
            const tHeight = environment.getTerrainHeight(px, pz);
            if (tHeight > maxTerrainAhead) {
              maxTerrainAhead = tHeight;
            }
          }
        }
      }

      // If upcoming terrain is too close to our height, engage obstacle avoidance mode
      if (maxTerrainAhead > -900 && sub.position.y < maxTerrainAhead + 7.5) {
        targetPos.y = maxTerrainAhead + 8.5;
        this.autopilotStatus = "COLLISION WARNING: AVOIDING OBSTACLE";
      }
      // 3. Proportional yaw steering using local horizontal target
      if (distH < 0.1) {
        yawInput = 0;
      } else {
        const localTargetH = toTargetH.clone().applyQuaternion(sub.quaternion.clone().invert()).normalize();
        if (localTargetH.z < -0.99) {
          // If target is directly behind (near 180 deg), kick it to start turning left
          yawInput = 1.6;
        } else {
          // Smooth proportional steering
          yawInput = localTargetH.x * 4.0;
          yawInput = Math.max(-1.6, Math.min(1.6, yawInput));
        }
      }

      // 4. Proportional pitch steering (stabilize to level if close to target depth)
      const currentPitch = Math.asin(forward.y);
      if (desiredPitch === null) {
        const yDiff = targetPos.y - sub.position.y;
        if (Math.abs(yDiff) > 2.0) {
          desiredPitch = Math.max(-0.44, Math.min(0.44, yDiff * 0.05)); // Cap pitch up/down to 25 degrees
        } else {
          desiredPitch = 0; // Maintain level pitch close to depth target
        }
      }

      pitchInput = -(desiredPitch - currentPitch) * 4.0;
      pitchInput = Math.max(-1.8, Math.min(1.8, pitchInput));

      // 5. Deceleration based on distance from mothership
      if (horizontalDist > 40.0) {
        this.selectedGear = 3; // Fast transit
      } else if (horizontalDist > 15.0) {
        this.selectedGear = 2; // Cruise
      } else {
        this.selectedGear = 1; // Slow docking approach
      }

      // 6. Active vertical heave thrust
      if (Math.random() < 0.02) {
        console.log("Autopilot Log:", {
          status: this.autopilotStatus,
          pos: [sub.position.x.toFixed(1), sub.position.y.toFixed(1), sub.position.z.toFixed(1)],
          target: [targetPos.x.toFixed(1), targetPos.y.toFixed(1), targetPos.z.toFixed(1)],
          distH: distH.toFixed(1),
          yawInput: yawInput.toFixed(2),
          selectedGear: this.selectedGear
        });
      }
      const speedMult = 1.0 + (this.upgrades.speed || 0) * 0.15;
      const heaveSpeedMap = { 0: 2.0, 1: 3.0, 2: 5.0, 3: 7.0 };
      const heaveSpeed = heaveSpeedMap[this.selectedGear] * speedMult;

      if (this.autopilotStatus === "COLLISION WARNING: AVOIDING OBSTACLE" || this.autopilotStatus.startsWith("ASCENDING") || targetPos.y > sub.position.y + 1.0) {
        heaveInput = heaveSpeed * 1.5; // Climb steep & fast
      } else if (this.autopilotStatus === "DESCENDING TO DOCKING PORT" || targetPos.y < sub.position.y - 1.0) {
        const yDiff = targetPos.y - sub.position.y;
        heaveInput = Math.max(-heaveSpeed * 0.8, Math.min(heaveSpeed * 0.8, yDiff * 1.5));
      }
    } else {
      // Normal Input Steer handling
      if (input.joystick.active) {
        const deadzone = 0.05; // 5% deadzone to prevent accidental drift
        const rawX = input.joystick.x;
        const rawY = input.joystick.y;
        const dist = Math.sqrt(rawX * rawX + rawY * rawY);

        if (dist < deadzone) {
          yawInput = 0;
          pitchInput = 0;
        } else {
          // Scale distance linearly starting from the deadzone threshold to 1.0
          const scaledDist = (dist - deadzone) / (1.0 - deadzone);
          // Apply response exponent (1.5) to make it smooth and precise near the center
          const curveDist = Math.pow(scaledDist, 1.5);

          const joyX = (rawX / dist) * curveDist;
          const joyY = (rawY / dist) * curveDist;

          // Steer multipliers (reduced slightly from 2.2/2.0 to 1.8/1.6 for comfortable touch steering)
          yawInput = -joyX * 1.8;
          pitchInput = joyY * 1.6;
        }
      } else if (input.mouseControl) {
        if (Math.abs(input.mouse.x) > 0.05) yawInput = -input.mouse.x * 2.2;
        if (Math.abs(input.mouse.y) > 0.05) pitchInput = input.mouse.y * 2.0;
      } else {
        if (input.keys.w) pitchInput = 1.8;  // Pitch down
        if (input.keys.s) pitchInput = -1.8; // Pitch up
        if (input.keys.a) yawInput = 1.6;    // Turn left
        if (input.keys.d) yawInput = -1.6;   // Turn right
      }
    }

    // Apply Rotation speeds
    const rotSpeedMap = { 0: 1.2, 1: 1.4, 2: 1.1, 3: 0.8 };
    const rotSpeed = rotSpeedMap[this.selectedGear];
    sub.rotateOnAxis(new THREE.Vector3(1, 0, 0), pitchInput * rotSpeed * delta);
    sub.rotateOnAxis(new THREE.Vector3(0, 1, 0), yawInput * rotSpeed * delta);

    // Roll stabilizer & banking effect into turns
    const currentRoll = Math.atan2(
      right.y,
      right.clone().projectOnPlane(new THREE.Vector3(0, 1, 0)).length()
    );
    const targetRoll = -yawInput * 0.25;
    sub.rotateOnAxis(new THREE.Vector3(0, 0, 1), (targetRoll - currentRoll) * 0.08);

    // SPEED KINEMATICS (No boosts, cruise speed strictly mapped to gear)
    const speedMult = 1.0 + (this.upgrades.speed || 0) * 0.15;
    const cruisingSpeedMap = { 0: 0.0, 1: 3.5, 2: 7.0, 3: 11.5 };
    const baseCruisingSpeed = cruisingSpeedMap[this.selectedGear] * speedMult;

    // VERTICAL HEAVE CONTROL (Space to go Up, X to go Down)
    const heaveSpeedMap = { 0: 2.0, 1: 3.0, 2: 5.0, 3: 7.0 };
    const heaveSpeed = heaveSpeedMap[this.selectedGear] * speedMult;
    if (!this.autopilotActive) {
      if (input.keys.Space) heaveInput += heaveSpeed;
      if (input.keys.x) heaveInput -= heaveSpeed;
    }

    // Combine forward and global vertical velocity
    this.velocity.copy(forward).multiplyScalar(baseCruisingSpeed);
    this.velocity.y += heaveInput;

    // Apply position integration
    sub.position.addScaledVector(this.velocity, delta);

    // BOUNDARIES ENFORCEMENT
    if (sub.position.y > 0) {
      // Recharge/Refill oxygen when surfacing
      if (this.oxygen < 99) {
        this.oxygen = 100;
        audio.playSplash();
        triggerSurfaceBanner();
      }
      sub.position.y = 0;
      if (this.velocity.y > 0) this.velocity.y *= -0.5;
    }

    const terrainHeight = environment.getTerrainHeight(sub.position.x, sub.position.z);
    if (sub.position.y < terrainHeight + 1.6) {
      sub.position.y = terrainHeight + 1.6;
      if (this.velocity.y < 0) this.velocity.y = 0;
    }

    const arenaRadius = 160;
    const distFromOrigin = Math.sqrt(sub.position.x * sub.position.x + sub.position.z * sub.position.z);
    if (distFromOrigin > arenaRadius) {
      const push = new THREE.Vector3(-sub.position.x, 0, -sub.position.z).normalize().multiplyScalar(delta * 12);
      sub.position.add(push);
    }

    // SUBMARINE KINEMATIC ANIMATIONS
    // Propeller spinning speed & bubble exhaust
    let spinMultiplier = 3.0; // base slow drift
    if (this.selectedGear > 0) {
      const currentSpeed = this.velocity.length();
      spinMultiplier = currentSpeed * 1.5;

      // Exhaust bubble rate scales per gear, slightly enhanced when performing vertical maneuvers
      const exhaustProb = { 1: 0.08, 2: 0.25, 3: 0.55 }[this.selectedGear];
      const isHeaving = input.keys.Space || input.keys.c;
      const finalExhaustChance = isHeaving ? (exhaustProb * 1.5) : exhaustProb;

      if (Math.random() < finalExhaustChance) {
        const exhaustPos = new THREE.Vector3(0, 0, -2.4).applyMatrix4(this.mesh.matrixWorld);
        const dragVel = forward.clone().multiplyScalar(-3.0);
        this.spawnBubble(exhaustPos, dragVel);
      }
    } else {
      // Stopped
      spinMultiplier = 0.2;
    }
    this.propellerGroup.rotation.z += (spinMultiplier) * delta;

    // Control surface fin feedback (rudders tilt for yaw, elevators tilt for pitch + heave)
    this.rudder.rotation.y = yawInput * 0.35;

    let elevatorTilt = -pitchInput * 0.3;
    if (input.keys.Space) elevatorTilt += 0.25; // tilt horizontal planes up
    if (input.keys.x) elevatorTilt -= 0.25; // tilt horizontal planes down

    this.elevator.rotation.x = elevatorTilt;
    this.leftFin.rotation.x = elevatorTilt;
    this.rightFin.rotation.x = elevatorTilt;

    // 7. MULTI-ANGLE TRACKING CAMERA
    let camOffsetLocal, lookOffsetLocal;

    // Smoothly interpolate free-look orbit angles based on right-click drag pan inputs
    if (input.freeLook && input.freeLook.active) {
      this.freeLookYaw = input.freeLook.yaw;
      this.freeLookPitch = input.freeLook.pitch;
    } else if (input.freeLook) {
      // Smoothly return to center position behind submarine on release
      input.freeLook.yaw += (0 - input.freeLook.yaw) * 6.0 * delta;
      input.freeLook.pitch += (0 - input.freeLook.pitch) * 6.0 * delta;
      this.freeLookYaw = input.freeLook.yaw;
      this.freeLookPitch = input.freeLook.pitch;
    }

    switch (this.cameraMode) {
      case 1: // First-Person / Porthole View
        camOffsetLocal = new THREE.Vector3(0, 0.3, 1.2);
        lookOffsetLocal = new THREE.Vector3(0, 0.3, 8.0);
        break;
      case 2: // Top-Down / Overhead Sonar View
        camOffsetLocal = new THREE.Vector3(0, 14.0, -0.1);
        lookOffsetLocal = new THREE.Vector3(0, 0, 0.5);
        break;
      case 3: // Side Cinematic / Fly-by View
        camOffsetLocal = new THREE.Vector3(9.0, 1.5, -4.0);
        lookOffsetLocal = new THREE.Vector3(0, 0.2, 2.0);
        break;
      case 0: // Third-Person Chase (Default)
      default:
        camOffsetLocal = new THREE.Vector3(0, 2.5, -9.5);
        lookOffsetLocal = new THREE.Vector3(0, 0.2, 4.0);
        
        // Orbit camera around submarine based on right-click free-look angles
        if (Math.abs(this.freeLookYaw) > 0.001 || Math.abs(this.freeLookPitch) > 0.001) {
          const orbitRotation = new THREE.Euler(this.freeLookPitch, this.freeLookYaw, 0, 'YXZ');
          camOffsetLocal.applyEuler(orbitRotation);
        }
        break;
    }

    const isFirstPerson = (this.cameraMode === 1);
    if (this.hull) this.hull.visible = !isFirstPerson;
    if (this.leftPipe) this.leftPipe.visible = !isFirstPerson;
    if (this.rightPipe) this.rightPipe.visible = !isFirstPerson;
    if (this.leftFin) this.leftFin.visible = !isFirstPerson;
    if (this.rightFin) this.rightFin.visible = !isFirstPerson;
    if (this.cockpitGroup) this.cockpitGroup.visible = !isFirstPerson;

    const camOffset = camOffsetLocal.applyQuaternion(sub.quaternion);
    const targetCamPos = sub.position.clone().add(camOffset);

    // In First-Person, camera lock position is instant to prevent laggy translation
    if (this.cameraMode === 1) {
      camera.position.copy(targetCamPos);
    } else {
      camera.position.lerp(targetCamPos, 0.08);
    }

    const lookOffset = lookOffsetLocal.applyQuaternion(sub.quaternion);
    camera.lookAt(sub.position.clone().add(lookOffset));

    // Align point light to follow camera
    camLight.position.copy(camera.position);

    // Keep sun lighting centered near player for shadow map quality
    sunLight.position.set(sub.position.x, sub.position.y + 45, sub.position.z + 15);
    sunLight.target = sub;

    // Update depths tracking
    this.depth = -sub.position.y;
    if (this.depth > this.maxDepth) this.maxDepth = this.depth;

    // Drain oxygen (life support battery) slowly
    const o2DrainMult = 1.0 - (this.upgrades.oxygen || 0) * 0.20;
    this.oxygen = Math.max(0, this.oxygen - delta * 1.15 * o2DrainMult);

    // warning strobe beacons blink out-of-phase (Ultra/High graphics setting warning beacon animations)
    if (this.blueStrobe && this.redStrobe) {
      const show = this.graphicsHigh;
      this.blueStrobe.visible = show && (Math.floor(time * 2.8) % 2 === 0);
      this.redStrobe.visible = show && (Math.floor(time * 2.8 + 1) % 2 === 0);
    }
  }

  updateMenuAnimation(time, delta, camera) {
    this.mesh.position.y = -15 + Math.sin(time * 0.6) * 0.8;
    this.mesh.rotation.y += delta * 0.05;

    // Propeller spin
    this.propellerGroup.rotation.z += 4.0 * delta;

    // Warning strobes blink out-of-phase on menu background
    if (this.blueStrobe && this.redStrobe) {
      const show = this.graphicsHigh;
      this.blueStrobe.visible = show && (Math.floor(time * 2.8) % 2 === 0);
      this.redStrobe.visible = show && (Math.floor(time * 2.8 + 1) % 2 === 0);
    }

    // Reset control surfaces
    this.rudder.rotation.y = 0;
    this.elevator.rotation.x = 0;
    this.leftFin.rotation.x = 0;
    this.rightFin.rotation.x = 0;

    camera.position.set(0, -11, -12);
    camera.lookAt(0, -15, 0);
  }
}
