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
    this.isDocked = false;
    this.dockCooldown = 0;
    
    // Upgrades and autopilot navigation state
    this.upgrades = {
      speed: 0,
      oxygen: 0,
      autopilot: false // unlocked or not
    };
    this.autopilotActive = false;
    this.autopilotStatus = "OFFLINE";
    
    // Bubble Pool for exhaust bubbles
    this.bubblePool = [];
    this.bubblePoolIndex = 0;
    
    this.createModel();
    this.createBubblePool();
    
    this.scene.add(this.mesh);
  }

  createModel() {
    // 1. Sleek metallic hull material (dark steel/carbon grey)
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x222a33,
      roughness: 0.15,
      metalness: 0.85
    });

    // Accent safety orange/yellow trim material
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xff8c00,
      roughness: 0.3,
      metalness: 0.6
    });

    // Glowing cyan neon/light material
    const neonMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff
    });

    // 2. Main Hull (sleek cylindrical capsule shape)
    const hullGeo = new THREE.SphereGeometry(1.0, 16, 16);
    hullGeo.scale(0.85, 0.85, 2.2);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.castShadow = true;
    hull.receiveShadow = true;
    this.mesh.add(hull);

    // 3. Conning Tower / Sail (safety orange accent)
    const towerGeo = new THREE.BoxGeometry(0.35, 0.6, 0.8);
    const tower = new THREE.Mesh(towerGeo, accentMat);
    tower.position.set(0, 0.7, 0.2);
    tower.castShadow = true;
    this.mesh.add(tower);

    // Small periscope mast on conning tower
    const scopeGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8);
    const scope = new THREE.Mesh(scopeGeo, hullMat);
    scope.position.set(0, 1.1, 0.4);
    this.mesh.add(scope);

    // Glowing periscope lens tip
    const scopeTipGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const scopeTip = new THREE.Mesh(scopeTipGeo, neonMat);
    scopeTip.position.set(0, 1.25, 0.4);
    this.mesh.add(scopeTip);

    // 4. Glowing Portholes / Windows (3 along each side)
    const windowGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.02, 12);
    windowGeo.rotateX(Math.PI / 2); // align along Z axis
    
    for (let i = 0; i < 3; i++) {
      const zOffset = 0.6 - i * 0.6;
      
      // Left side portholes
      const wLeft = new THREE.Mesh(windowGeo, neonMat);
      wLeft.position.set(0.68, 0.1, zOffset);
      wLeft.rotation.y = Math.PI / 2;
      this.mesh.add(wLeft);

      // Right side portholes
      const wRight = new THREE.Mesh(windowGeo, neonMat);
      wRight.position.set(-0.68, 0.1, zOffset);
      wRight.rotation.y = -Math.PI / 2;
      this.mesh.add(wRight);
    }

    // 5. Headlight/Spotlight nose lens
    const lensGeo = new THREE.SphereGeometry(0.35, 12, 12);
    lensGeo.scale(1.0, 1.0, 0.3); // flat lens cap
    const lens = new THREE.Mesh(lensGeo, neonMat);
    lens.position.set(0, 0, 2.15); // nose tip
    this.mesh.add(lens);

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
    const nozzle = new THREE.Mesh(nozzleGeo, hullMat);
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
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.1 });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    this.propellerGroup.add(hub);

    // 4 Propeller Blades (safety yellow/gold accent)
    const bladeGeo = new THREE.BoxGeometry(0.08, 0.65, 0.02);
    bladeGeo.translate(0, 0.32, 0); // pivot at base
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      metalness: 0.8,
      roughness: 0.2
    });
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.z = (i * Math.PI) / 2;
      this.propellerGroup.add(blade);
    }
    this.mesh.add(this.propellerGroup);

    // 7. Stabilizing Control Surfaces (Fins, rudders, elevators)
    // Left front diving plane
    this.leftFin = new THREE.Group();
    this.leftFin.position.set(0.8, 0, 0.6);
    const finGeo = new THREE.BoxGeometry(0.4, 0.03, 0.22);
    finGeo.translate(0.2, 0, 0); // pivot
    const leftFinMesh = new THREE.Mesh(finGeo, accentMat);
    this.leftFin.add(leftFinMesh);
    this.mesh.add(this.leftFin);

    // Right front diving plane
    this.rightFin = new THREE.Group();
    this.rightFin.position.set(-0.8, 0, 0.6);
    const finGeoRight = new THREE.BoxGeometry(0.4, 0.03, 0.22);
    finGeoRight.translate(-0.2, 0, 0);
    const rightFinMesh = new THREE.Mesh(finGeoRight, accentMat);
    this.rightFin.add(rightFinMesh);
    this.mesh.add(this.rightFin);

    // Rear vertical rudder (steer yaw)
    this.rudder = new THREE.Group();
    this.rudder.position.set(0, 0, -1.8);
    const rudderGeo = new THREE.BoxGeometry(0.03, 0.7, 0.25);
    rudderGeo.translate(0, 0.35, -0.125); // pivot at bottom-front
    const rudderMesh = new THREE.Mesh(rudderGeo, accentMat);
    this.rudder.add(rudderMesh);
    this.mesh.add(this.rudder);

    // Rear horizontal elevator (steer pitch)
    this.elevator = new THREE.Group();
    this.elevator.position.set(0, 0, -1.8);
    const elevatorGeo = new THREE.BoxGeometry(0.7, 0.03, 0.25);
    elevatorGeo.translate(0, 0, -0.125);
    const elevatorMesh = new THREE.Mesh(elevatorGeo, accentMat);
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
    
    this.mesh.position.set(0, -15, 0);
    this.mesh.rotation.set(0, 0, 0);
    
    // Hide active bubbles
    this.bubblePool.forEach(b => {
      b.mesh.visible = false;
    });
  }

  setGraphics(high) {
    this.graphicsHigh = high;
    this.mesh.traverse(child => {
      if (child.isMesh) {
        child.castShadow = high;
        child.receiveShadow = high;
      }
    });
    if (this.searchlight) {
      this.searchlight.castShadow = high;
    }
    this.updateHeadlightVisibility();
  }

  setHeadlight(on) {
    this.headlightOn = on;
    this.updateHeadlightVisibility();
  }

  updateHeadlightVisibility() {
    const visible = this.headlightOn && (this.graphicsHigh !== undefined ? this.graphicsHigh : true);
    if (this.searchlight) {
      this.searchlight.visible = visible;
    }
    if (this.searchlightBeam) {
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
      
      // Press C or S to undock (ballast down / steer back)
      if (input.keys.c || input.keys.s) {
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
    
    // VERTICAL HEAVE CONTROL (Space to go Up, C to go Down)
    const heaveSpeedMap = { 0: 2.0, 1: 3.0, 2: 5.0, 3: 7.0 };
    const heaveSpeed = heaveSpeedMap[this.selectedGear] * speedMult;
    if (!this.autopilotActive) {
      if (input.keys.Space) heaveInput += heaveSpeed;
      if (input.keys.c) heaveInput -= heaveSpeed;
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
    if (input.keys.c) elevatorTilt -= 0.25; // tilt horizontal planes down
    
    this.elevator.rotation.x = elevatorTilt;
    this.leftFin.rotation.x = elevatorTilt;
    this.rightFin.rotation.x = elevatorTilt;
    
    // 7. CINEMATIC TRACKING CAMERA (behind player)
    const camOffset = new THREE.Vector3(0, 2.5, -9.5).applyQuaternion(sub.quaternion);
    const targetCamPos = sub.position.clone().add(camOffset);
    camera.position.lerp(targetCamPos, 0.08);
    
    const lookOffset = new THREE.Vector3(0, 0.2, 4.0).applyQuaternion(sub.quaternion);
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
  }

  updateMenuAnimation(time, delta, camera) {
    this.mesh.position.y = -15 + Math.sin(time * 0.6) * 0.8;
    this.mesh.rotation.y += delta * 0.05;
    
    // Propeller spin
    this.propellerGroup.rotation.z += 4.0 * delta;
    
    // Reset control surfaces
    this.rudder.rotation.y = 0;
    this.elevator.rotation.x = 0;
    this.leftFin.rotation.x = 0;
    this.rightFin.rotation.x = 0;
    
    camera.position.set(0, -11, -12);
    camera.lookAt(0, -15, 0);
  }
}
