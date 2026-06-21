import * as THREE from 'three';

export class EntityManager {
  constructor(scene, graphicsHigh) {
    this.scene = scene;
    this.graphicsHigh = graphicsHigh;
    
    this.pearls = [];
    this.jellyfish = [];
    this.kelps = [];
    this.rocks = [];
    this.fish = [];
    this.schools = [];
    this.vessel = null;
  }

  clear() {
    this.pearls.forEach(p => this.scene.remove(p.mesh));
    this.jellyfish.forEach(j => this.scene.remove(j.mesh));
    this.kelps.forEach(k => this.scene.remove(k));
    this.rocks.forEach(r => this.scene.remove(r));
    this.fish.forEach(f => this.scene.remove(f.mesh));
    
    if (this.vessel) {
      this.scene.remove(this.vessel);
      this.vessel = null;
    }
    
    this.pearls = [];
    this.jellyfish = [];
    this.kelps = [];
    this.rocks = [];
    this.fish = [];
    this.schools = [];
  }

  spawnEntities(getTerrainHeight) {
    this.getTerrainHeight = getTerrainHeight;
    this.clear();
    
    // 1. SPAWN PEARL ORBS (16 items)
    const pearlGroupGeo = new THREE.SphereGeometry(0.25, 12, 12);
    const bubbleGroupGeo = new THREE.SphereGeometry(0.48, 12, 12);
    
    const pearlMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 1.5,
      metalness: 0.1,
      roughness: 0.1
    });
    
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.3,
      metalness: 0.8,
      roughness: 0.05
    });
    
    for (let i = 0; i < 16; i++) {
      const group = new THREE.Group();
      
      const pearlMesh = new THREE.Mesh(pearlGroupGeo, pearlMat);
      const bubbleMesh = new THREE.Mesh(bubbleGroupGeo, bubbleMat);
      group.add(pearlMesh, bubbleMesh);
      
      // Random coordinates in space
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.2;
      const radius = 30 + Math.random() * 80;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const y = -5 - Math.random() * 25; // Depth range: -5m to -30m
      
      group.position.set(x, y, z);
      
      // Dynamic lighting for High setting
      let light = null;
      if (this.graphicsHigh) {
        light = new THREE.PointLight(0xffd700, 0.8, 10);
        group.add(light);
      }
      
      this.scene.add(group);
      this.pearls.push({
        mesh: group,
        light: light,
        offset: Math.random() * 100
      });
    }
    
    // 2. SPAWN JELLYFISH OBSTACLES (12 items)
    const domeGeo = new THREE.SphereGeometry(0.9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    domeGeo.scale(1.0, 0.9, 1.0);
    
    const jellyMat = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      emissive: 0xaa00aa,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    
    for (let i = 0; i < 12; i++) {
      const group = new THREE.Group();
      
      // Jelly bell
      const bell = new THREE.Mesh(domeGeo, jellyMat);
      bell.castShadow = true;
      group.add(bell);
      
      // Tentacles
      const tentacleGeo = new THREE.CylinderGeometry(0.02, 0.01, 2.2, 4);
      tentacleGeo.translate(0, -1.1, 0);
      const tentacleMat = new THREE.MeshBasicMaterial({
        color: 0xff33cc,
        transparent: true,
        opacity: 0.45
      });
      
      const tentacles = [];
      for (let t = 0; t < 6; t++) {
        const tentacle = new THREE.Mesh(tentacleGeo, tentacleMat);
        const tAngle = (t / 6) * Math.PI * 2;
        const rad = 0.65;
        tentacle.position.set(Math.sin(tAngle) * rad, -0.2, Math.cos(tAngle) * rad);
        group.add(tentacle);
        tentacles.push(tentacle);
      }
      
      // Position jellyfish
      const angle = ((i + 0.5) / 12) * Math.PI * 2;
      const radius = 40 + Math.random() * 60;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const y = -10 - Math.random() * 20;
      
      group.position.set(x, y, z);
      
      let light = null;
      if (this.graphicsHigh) {
        light = new THREE.PointLight(0xff00ff, 0.6, 12);
        group.add(light);
      }
      
      this.scene.add(group);
      this.jellyfish.push({
        mesh: group,
        light: light,
        tentacles: tentacles,
        offset: Math.random() * 100,
        speed: 0.015 + Math.random() * 0.01,
        dirY: Math.random() > 0.5 ? 1 : -1,
        yRange: 4 + Math.random() * 6,
        baseY: y,
        stingCooldown: 0
      });
    }
    
    // 3. SPAWN SCATTERED KELP ON FLOOR (30 clusters)
    for (let i = 0; i < 30; i++) {
      const x = (Math.random() - 0.5) * 200;
      const z = (Math.random() - 0.5) * 200;
      const y = getTerrainHeight(x, z); // snap to sand bed height
      
      const kelpPatch = this.createKelpPatch(x, y, z);
      this.scene.add(kelpPatch);
      this.kelps.push(kelpPatch);
    }
    
    // 4. SPAWN LARGE GLOWING CORALS & ROCKS (18 items)
    const rockGeo = new THREE.DodecahedronGeometry(2.5, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x162c3e,
      roughness: 0.85
    });
    
    const coralGeo = new THREE.SphereGeometry(0.8, 8, 8);
    const coralColors = [0x00ffc8, 0xff00ff, 0x00ffff, 0xffaa00];
    
    for (let i = 0; i < 18; i++) {
      const group = new THREE.Group();
      
      // Rock base
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.scale.set(1 + Math.random(), 0.5 + Math.random() * 1.5, 1 + Math.random());
      rock.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      group.add(rock);
      
      // Coral decorations on the rock
      const coralCount = 2 + Math.floor(Math.random() * 3);
      for (let c = 0; c < coralCount; c++) {
        const coralMat = new THREE.MeshStandardMaterial({
          color: coralColors[c % coralColors.length],
          emissive: coralColors[c % coralColors.length],
          emissiveIntensity: 0.6,
          roughness: 0.6
        });
        const coral = new THREE.Mesh(coralGeo, coralMat);
        coral.scale.set(0.6 + Math.random() * 0.6, 1 + Math.random() * 1.5, 0.6 + Math.random() * 0.6);
        
        // Distribute corals around top of rock
        const cAngle = (c / coralCount) * Math.PI * 2;
        coral.position.set(
          Math.sin(cAngle) * 1.5,
          1.0 + Math.random() * 0.8,
          Math.cos(cAngle) * 1.5
        );
        group.add(coral);
      }
      
      const x = (Math.random() - 0.5) * 220;
      const z = (Math.random() - 0.5) * 220;
      const y = getTerrainHeight(x, z) - 0.5; // embed slightly
      
      group.position.set(x, y, z);
      this.scene.add(group);
      this.rocks.push(group);
    }
    
    // 5. SPAWN SCHOOLING FISH (3 schools of 8 fish)
    const fishColors = [0xff6600, 0x00ffcc, 0xff00bb, 0xffd700];
    const bodyGeo = new THREE.BoxGeometry(0.12, 0.22, 0.55);
    const finGeo = new THREE.BoxGeometry(0.015, 0.18, 0.2);
    finGeo.translate(0, 0, -0.1); // Shift pivot point to tail base
    
    for (let s = 0; s < 3; s++) {
      const angle = (s / 3) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 25 + Math.random() * 45;
      const originX = Math.sin(angle) * radius;
      const originZ = Math.cos(angle) * radius;
      const originY = -8 - Math.random() * 15;
      
      let schoolLight = null;
      if (this.graphicsHigh) {
        schoolLight = new THREE.PointLight(fishColors[s % fishColors.length], 0.8, 15);
        this.scene.add(schoolLight);
      }
      
      const school = {
        originX, originY, originZ,
        target: new THREE.Vector3(originX, originY, originZ),
        offset: Math.random() * 100,
        light: schoolLight,
        fish: []
      };
      
      for (let f = 0; f < 8; f++) {
        const fishGroup = new THREE.Group();
        
        const chosenColor = fishColors[s % fishColors.length];
        const bodyMat = new THREE.MeshStandardMaterial({
          color: chosenColor,
          emissive: chosenColor,
          emissiveIntensity: 0.8,
          roughness: 0.3
        });
        
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.castShadow = true;
        fishGroup.add(bodyMesh);
        
        const tailGroup = new THREE.Group();
        tailGroup.position.set(0, 0, -0.27);
        fishGroup.add(tailGroup);
        
        const finMesh = new THREE.Mesh(finGeo, bodyMat);
        tailGroup.add(finMesh);
        
        // Random local offset in school
        const localOffset = new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 6
        );
        
        // Place fish initially
        fishGroup.position.copy(school.target).add(localOffset);
        
        this.scene.add(fishGroup);
        
        const fishObj = {
          mesh: fishGroup,
          tail: tailGroup,
          localOffset: localOffset,
          offset: Math.random() * 100
        };
        
        school.fish.push(fishObj);
        this.fish.push(fishObj);
      }
      
      this.schools.push(school);
    }
  }

  createKelpPatch(x, y, z) {
    const patch = new THREE.Group();
    patch.position.set(x, y, z);
    
    const bladeCount = 3 + Math.floor(Math.random() * 4);
    const kelpMat = new THREE.MeshStandardMaterial({
      color: 0x094f38,
      roughness: 0.7,
      side: THREE.DoubleSide
    });
    
    for (let b = 0; b < bladeCount; b++) {
      const base = new THREE.Group();
      // Spread blades slightly within the patch
      base.position.set((Math.random() - 0.5) * 1.2, 0, (Math.random() - 0.5) * 1.2);
      
      let currentParent = base;
      const segments = [];
      const segCount = 5 + Math.floor(Math.random() * 3);
      const segHeight = 1.1;
      
      for (let j = 0; j < segCount; j++) {
        const width = 0.16 - j * 0.018;
        const geo = new THREE.CylinderGeometry(width * 0.8, width, segHeight, 6);
        geo.translate(0, segHeight / 2, 0); // shift center pivot to base of segment
        
        const mesh = new THREE.Mesh(geo, kelpMat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.y = j === 0 ? 0 : segHeight;
        
        currentParent.add(mesh);
        currentParent = mesh;
        segments.push(mesh);
      }
      
      base.userData = {
        segments: segments,
        offset: Math.random() * 100,
        swaySpeed: 1.0 + Math.random() * 0.6
      };
      
      patch.add(base);
    }
    
    return patch;
  }

  respawnPearl(pearl, playerPos) {
    // Respawn pearl randomly at a distance ahead of the player
    const angle = Math.random() * Math.PI * 2;
    const radius = 50 + Math.random() * 80;
    const x = playerPos.x + Math.sin(angle) * radius;
    const z = playerPos.z + Math.cos(angle) * radius;
    const y = -4 - Math.random() * 26;
    
    pearl.mesh.position.set(x, y, z);
  }

  update(time, delta) {
    // 1. Pearls float & rotate
    this.pearls.forEach(p => {
      const mesh = p.mesh;
      const t = time * 2.2 + p.offset;
      mesh.rotation.y += delta * 0.6;
      mesh.position.y += Math.sin(t) * 0.006; // slow floating bob
    });
    
    // 2. Jellyfish swimming pulsers
    this.jellyfish.forEach(j => {
      const mesh = j.mesh;
      const t = time * 2.8 + j.offset;
      
      // Pulse scale (stretch/squish)
      const pulse = 1.0 + Math.sin(t) * 0.12;
      mesh.scale.set(pulse, 1.2 - (pulse - 1.0), pulse);
      
      // Sway tentacles based on bell pulse
      j.tentacles.forEach((tent, idx) => {
        const offsetT = t + idx * 0.35;
        tent.rotation.z = Math.sin(offsetT) * 0.15;
        tent.rotation.x = Math.cos(offsetT * 0.8) * 0.08;
      });
      
      // Move jellyfish up & down vertically
      mesh.position.y += j.dirY * j.speed;
      
      // Reverse vertical direction at boundaries
      const relativeDist = mesh.position.y - j.baseY;
      if (Math.abs(relativeDist) > j.yRange) {
        j.dirY *= -1;
        mesh.position.y += j.dirY * j.speed; // step once
      }
    });

    // 3. Sway Sea Kelp (Bones recursive rotation)
    this.kelps.forEach(kelpPatch => {
      kelpPatch.children.forEach(blade => {
        const t = time * blade.userData.swaySpeed + blade.userData.offset;
        blade.userData.segments.forEach((seg, idx) => {
          // Add minor rotation accumulation per segment joint
          seg.rotation.z = Math.sin(t + idx * 0.3) * 0.06;
          seg.rotation.x = Math.cos(t * 0.8 + idx * 0.3) * 0.04;
        });
      });
    });

    // 4. Schooling Fish update (organic cohesion & movement)
    if (this.schools) {
      this.schools.forEach(school => {
        // Wandering center point of the school
        const t = time * 0.15 + school.offset;
        school.target.x = school.originX + Math.sin(t * 1.5) * 18;
        school.target.z = school.originZ + Math.cos(t) * 18;
        
        // Keep target Y within range [-30, -4]
        const targetY = school.originY + Math.sin(t * 2.1) * 6;
        school.target.y = Math.max(-30, Math.min(-4, targetY));
        
        // Position school light at target center
        if (school.light) {
          school.light.position.copy(school.target);
        }
        
        school.fish.forEach(fish => {
          // Fish steers towards school target + localOffset
          const dest = school.target.clone().add(fish.localOffset);
          
          // Clamping steer destination relative to terrain floor and surface
          if (this.getTerrainHeight) {
            const floorAtDest = this.getTerrainHeight(dest.x, dest.z);
            dest.y = Math.max(floorAtDest + 3.0, Math.min(-3.0, dest.y));
          } else {
            dest.y = Math.max(-30, Math.min(-3.0, dest.y));
          }
          
          const toDest = dest.clone().sub(fish.mesh.position);
          const dist = toDest.length();
          
          if (dist > 0.1) {
            toDest.normalize();
            
            // Yaw steering
            const targetYaw = Math.atan2(toDest.x, toDest.z);
            let diffYaw = targetYaw - fish.mesh.rotation.y;
            diffYaw = Math.atan2(Math.sin(diffYaw), Math.cos(diffYaw));
            fish.mesh.rotation.y += diffYaw * delta * 2.5;
            
            // Pitch steering
            const targetPitch = Math.asin(toDest.y);
            let diffPitch = -targetPitch - fish.mesh.rotation.x;
            diffPitch = Math.atan2(Math.sin(diffPitch), Math.cos(diffPitch));
            fish.mesh.rotation.x += diffPitch * delta * 2.5;
          }
          
          // Swim forward
          const swimSpeed = 3.0 + Math.sin(time * 2.0 + fish.offset) * 0.8;
          const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(fish.mesh.quaternion);
          fish.mesh.position.addScaledVector(forward, swimSpeed * delta);
          
          // Keep fish strictly below surface (-1.2m) and above ocean floor (floor + 1.2m)
          if (this.getTerrainHeight) {
            const floorAtFish = this.getTerrainHeight(fish.mesh.position.x, fish.mesh.position.z);
            const minY = floorAtFish + 1.2;
            const maxY = -1.2;
            fish.mesh.position.y = Math.max(minY, Math.min(maxY, fish.mesh.position.y));
          } else {
            fish.mesh.position.y = Math.max(-30.0, Math.min(-1.2, fish.mesh.position.y));
          }
          
          // Wag tail fin proportional to speed
          const wagFreq = swimSpeed * 3.5;
          fish.tail.rotation.y = Math.sin(time * wagFreq + fish.offset) * 0.35;
        });
      });
    }

    // 5. Scientific Vessel bobbing
    if (this.vessel) {
      const waveY = Math.sin(time * 1.5) * Math.cos(time * 1.5) * 0.35;
      this.vessel.position.y = waveY;
      
      // Gentle pitch & roll bobbing
      this.vessel.rotation.z = Math.sin(time * 0.8) * 0.018; 
      this.vessel.rotation.x = Math.cos(time * 1.1) * 0.012;
    }
  }

  setGraphics(high) {
    this.graphicsHigh = high;
    this.pearls.forEach(p => {
      if (p.light) p.light.visible = high;
    });
    this.jellyfish.forEach(j => {
      if (j.light) j.light.visible = high;
    });
    this.schools.forEach(s => {
      if (s.light) s.light.visible = high;
    });
  }

  spawnVessel() {
    if (this.vessel) {
      this.scene.remove(this.vessel);
    }
    
    const vesselGroup = new THREE.Group();
    
    // Materials
    const hullRedMat = new THREE.MeshStandardMaterial({
      color: 0xcc3300,
      roughness: 0.5,
      metalness: 0.4
    });
    
    const deckWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.4,
      metalness: 0.3
    });
    
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      roughness: 0.5
    });
    
    const mastMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.3,
      metalness: 0.8
    });
    
    const windowMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff
    });
    
    const glowGreenMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      side: THREE.DoubleSide
    });
    
    // 1. Lower Red Hull (floating in water)
    const lowerHullGeo = new THREE.BoxGeometry(4.0, 1.2, 16.0);
    const lowerHull = new THREE.Mesh(lowerHullGeo, hullRedMat);
    lowerHull.position.y = -0.4; // partially submerged centering
    lowerHull.castShadow = true;
    lowerHull.receiveShadow = true;
    vesselGroup.add(lowerHull);
    
    // 2. Upper White Deck Hull
    const upperHullGeo = new THREE.BoxGeometry(4.0, 0.8, 16.0);
    const upperHull = new THREE.Mesh(upperHullGeo, deckWhiteMat);
    upperHull.position.y = 0.6;
    upperHull.castShadow = true;
    upperHull.receiveShadow = true;
    vesselGroup.add(upperHull);
    
    // 3. Cabin Superstructure
    const cabinGeo = new THREE.BoxGeometry(3.0, 1.5, 7.0);
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.75, -2.0); // Stern Cabin
    cabin.castShadow = true;
    vesselGroup.add(cabin);
    
    // 4. Bridge Deck
    const bridgeGeo = new THREE.BoxGeometry(3.0, 1.0, 3.0);
    const bridge = new THREE.Mesh(bridgeGeo, deckWhiteMat);
    bridge.position.set(0, 3.0, -1.0);
    bridge.castShadow = true;
    vesselGroup.add(bridge);
    
    // Glowing bridge window glass strip
    const windowGeo = new THREE.BoxGeometry(3.1, 0.3, 2.8);
    const windowMesh = new THREE.Mesh(windowGeo, windowMat);
    windowMesh.position.set(0, 3.1, -0.9);
    vesselGroup.add(windowMesh);
    
    // 5. Scientific Mast
    const mastGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.5, 8);
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(0, 5.25, -0.5);
    mast.castShadow = true;
    vesselGroup.add(mast);
    
    // Radar dish
    const dishGeo = new THREE.ConeGeometry(0.8, 0.4, 12, 1, true);
    dishGeo.rotateX(Math.PI / 3); 
    const dish = new THREE.Mesh(dishGeo, deckWhiteMat);
    dish.position.set(0, 7.0, -0.5);
    vesselGroup.add(dish);
    
    // 6. Docking Port underneath keel
    const dockRingGeo = new THREE.RingGeometry(1.6, 1.8, 16);
    dockRingGeo.rotateX(Math.PI / 2); // face downwards
    const dockRing = new THREE.Mesh(dockRingGeo, glowGreenMat);
    dockRing.position.set(0, -1.05, 0.0);
    vesselGroup.add(dockRing);
    
    // Light beam down from docking port
    const dockBeamGeo = new THREE.CylinderGeometry(1.6, 1.6, 1.5, 12, 1, true);
    dockBeamGeo.translate(0, -0.75, 0); 
    const dockBeamMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const dockBeam = new THREE.Mesh(dockBeamGeo, dockBeamMat);
    dockBeam.position.set(0, -1.05, 0.0);
    vesselGroup.add(dockBeam);
    
    // Position the whole ship on the surface at coordinates (0, 0)
    vesselGroup.position.set(0, 0, 0);
    
    this.scene.add(vesselGroup);
    this.vessel = vesselGroup;
  }
}
