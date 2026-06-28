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
    this.sharks = [];
    this.vessel = null;
    this.radarMesh = null;
    this.dockBeamMat = null;
    this.beaconMesh = null;
  }

  clear() {
    this.pearls.forEach(p => this.scene.remove(p.mesh));
    this.jellyfish.forEach(j => this.scene.remove(j.mesh));
    this.kelps.forEach(k => this.scene.remove(k));
    this.rocks.forEach(r => this.scene.remove(r));
    this.fish.forEach(f => this.scene.remove(f.mesh));
    if (this.sharks) {
      this.sharks.forEach(s => this.scene.remove(s.mesh));
    }

    if (this.vessel) {
      this.scene.remove(this.vessel);
      this.vessel = null;
      this.radarMesh = null;
      this.dockBeamMat = null;
      this.beaconMesh = null;
    }

    this.pearls = [];
    this.jellyfish = [];
    this.kelps = [];
    this.rocks = [];
    this.fish = [];
    this.schools = [];
    this.sharks = [];
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

    // 6. SPAWN SOLITARY SHARKS (3 items)
    for (let i = 0; i < 3; i++) {
      const sharkData = this.createSharkMesh();
      const sharkMesh = sharkData.mesh;
      const tailGroup = sharkData.tail;

      // Starting coordinates
      const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.4;
      const radius = 60 + Math.random() * 45;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const y = -12 - Math.random() * 15;

      sharkMesh.position.set(x, y, z);

      // Set graphics shadow visibility
      sharkMesh.traverse(child => {
        if (child.isMesh) {
          child.castShadow = this.graphicsHigh;
          child.receiveShadow = this.graphicsHigh;
        }
      });

      // Add a dynamic point light in High graphics settings
      let light = null;
      if (this.graphicsHigh) {
        light = new THREE.PointLight(0x00ffaa, 0.7, 15);
        sharkMesh.add(light);
      }

      this.scene.add(sharkMesh);

      this.sharks.push({
        mesh: sharkMesh,
        tail: tailGroup,
        light: light,
        offset: Math.random() * 100,
        speed: 3.5 + Math.random() * 1.5,
        targetPos: new THREE.Vector3(x, y, z),
        nextTargetTime: 0
      });
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

    // 4b. Update Solitary Sharks (Majestic wandering & steering AI)
    if (this.sharks) {
      this.sharks.forEach(shark => {
        // Periodic new target generation (every 10-18 seconds or when close to target)
        const distToTarget = shark.mesh.position.distanceTo(shark.targetPos);
        if (time > shark.nextTargetTime || distToTarget < 5.0) {
          shark.nextTargetTime = time + 10.0 + Math.random() * 8.0;

          // Pick a random target in the deep water column
          const angle = Math.random() * Math.PI * 2;
          const radius = 40 + Math.random() * 80;
          const tx = Math.sin(angle) * radius;
          const tz = Math.cos(angle) * radius;
          let ty = -10 - Math.random() * 20;

          // Clamp target relative to terrain floor
          if (this.getTerrainHeight) {
            const floorAtT = this.getTerrainHeight(tx, tz);
            ty = Math.max(floorAtT + 4.0, Math.min(-5.0, ty));
          } else {
            ty = Math.max(-30.0, Math.min(-5.0, ty));
          }
          shark.targetPos.set(tx, ty, tz);
        }

        // Steering logic towards targetPos
        const toTarget = shark.targetPos.clone().sub(shark.mesh.position);
        const dist = toTarget.length();

        if (dist > 0.1) {
          toTarget.normalize();

          // Steer Yaw
          const targetYaw = Math.atan2(toTarget.x, toTarget.z);
          let diffYaw = targetYaw - shark.mesh.rotation.y;
          diffYaw = Math.atan2(Math.sin(diffYaw), Math.cos(diffYaw));
          shark.mesh.rotation.y += diffYaw * delta * 1.5;

          // Steer Pitch
          const targetPitch = Math.asin(toTarget.y);
          let diffPitch = -targetPitch - shark.mesh.rotation.x;
          diffPitch = Math.atan2(Math.sin(diffPitch), Math.cos(diffPitch));
          shark.mesh.rotation.x += diffPitch * delta * 1.5;
        }

        // Roll stabilization (bank into turns)
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(shark.mesh.quaternion);
        const currentRoll = Math.atan2(
          right.y,
          right.clone().projectOnPlane(new THREE.Vector3(0, 1, 0)).length()
        );
        const targetRoll = (toTarget.x * right.z - toTarget.z * right.x) * 0.15; // bank smoothly
        shark.mesh.rotateOnAxis(new THREE.Vector3(0, 0, 1), (targetRoll - currentRoll) * delta * 2.0);

        // Move shark forward
        const forwardMove = new THREE.Vector3(0, 0, 1).applyQuaternion(shark.mesh.quaternion);
        shark.mesh.position.addScaledVector(forwardMove, shark.speed * delta);

        // Strictly clamp height above floor and below surface
        if (this.getTerrainHeight) {
          const floorAtShark = this.getTerrainHeight(shark.mesh.position.x, shark.mesh.position.z);
          const minY = floorAtShark + 3.0;
          const maxY = -4.0;
          shark.mesh.position.y = Math.max(minY, Math.min(maxY, shark.mesh.position.y));
        } else {
          shark.mesh.position.y = Math.max(-30.0, Math.min(-4.0, shark.mesh.position.y));
        }

        // Majestic slow tail wag
        const wagFreq = 2.0 + Math.sin(time * 0.5) * 0.5;
        shark.tail.rotation.y = Math.sin(time * wagFreq + shark.offset) * 0.38;
      });
    }

    // 5. Scientific Vessel bobbing & animations
    if (this.vessel) {
      const waveY = Math.sin(time * 1.5) * Math.cos(time * 1.5) * 0.35;
      this.vessel.position.y = waveY;

      // Gentle pitch & roll bobbing
      this.vessel.rotation.z = Math.sin(time * 0.8) * 0.018;
      this.vessel.rotation.x = Math.cos(time * 1.1) * 0.012;

      // Rotate radar dish
      if (this.radarMesh) {
        this.radarMesh.rotation.y += delta * 1.8;
      }

      // Update docking beam time uniform
      if (this.dockBeamMat && this.dockBeamMat.uniforms) {
        this.dockBeamMat.uniforms.time.value = time;
      }

      // Strobe beacon warning light on mast
      if (this.beaconMesh) {
        // Blink beacon every second (0.5s on, 0.5s off)
        const strobe = Math.floor(time * 2.0) % 2 === 0 ? 1.5 : 0.08;
        this.beaconMesh.material.emissiveIntensity = strobe;
      }
    }
  }

  setGraphics(high) {
    this.setGraphicsLevel(high ? 'HIGH' : 'LOW');
  }

  setGraphicsLevel(level) {
    this.graphicsLevel = level;
    this.graphicsHigh = (level !== 'LOW');
    const high = this.graphicsHigh;
    this.pearls.forEach(p => {
      if (p.light) p.light.visible = high;
    });
    this.jellyfish.forEach(j => {
      if (j.light) j.light.visible = high;
    });
    this.schools.forEach(s => {
      if (s.light) s.light.visible = high;
    });
    this.sharks.forEach(s => {
      if (s.light) s.light.visible = high;
      s.mesh.traverse(child => {
        if (child.isMesh) {
          child.castShadow = high;
          child.receiveShadow = high;
        }
      });
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
      color: 0x333333,
      roughness: 0.3,
      metalness: 0.8
    });

    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00bfff,
      emissiveIntensity: 1.5,
      roughness: 0.1
    });

    const glowGreenMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      side: THREE.DoubleSide
    });

    const glowCyanMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      side: THREE.DoubleSide
    });

    const redLightMat = new THREE.MeshStandardMaterial({
      color: 0xff3333,
      emissive: 0xff0000,
      emissiveIntensity: 2.0
    });

    const greenLightMat = new THREE.MeshStandardMaterial({
      color: 0x33ff33,
      emissive: 0x00ff00,
      emissiveIntensity: 2.0
    });

    const whiteStrobeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.0
    });

    this.dockBeamMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        
        void main() {
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        
        void main() {
          // Scrolling energy rings traveling downwards
          float ring = sin(vUv.y * 12.0 + time * 5.0) * 0.5 + 0.5;
          
          // Rotating scanning lines around the cylinder
          float scan = sin(vUv.x * 24.0 + time * 3.0) * 0.5 + 0.5;
          
          // Dynamic vertical pulse (breathing effect)
          float pulse = sin(time * 2.5) * 0.15 + 0.85;
          
          // Soft fade at top (near ship) and bottom (deeper)
          float edgeFade = sin(vUv.y * 3.14159);
          
          // Combine effects
          float alpha = (ring * 0.6 + scan * 0.4) * edgeFade * 0.35 * pulse;
          
          // Soft neon teal/emerald color
          vec3 beamColor = mix(vec3(0.0, 1.0, 0.85), vec3(0.0, 1.0, 0.3), ring * 0.5 + 0.5);
          
          gl_FragColor = vec4(beamColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    // 1. Catamaran Pontoons
    const pontoonCylGeo = new THREE.CylinderGeometry(0.55, 0.55, 12.0, 10);
    pontoonCylGeo.rotateX(Math.PI / 2); // align along Z axis

    const bowConeGeo = new THREE.ConeGeometry(0.55, 2.5, 10);
    bowConeGeo.rotateX(Math.PI / 2); // align along Z axis

    // Left Pontoon
    const leftPontoonCyl = new THREE.Mesh(pontoonCylGeo, hullRedMat);
    leftPontoonCyl.position.set(-2.2, -0.5, 0);
    leftPontoonCyl.castShadow = true;
    leftPontoonCyl.receiveShadow = true;
    vesselGroup.add(leftPontoonCyl);

    const leftBow = new THREE.Mesh(bowConeGeo, hullRedMat);
    leftBow.position.set(-2.2, -0.5, 7.25);
    leftBow.castShadow = true;
    vesselGroup.add(leftBow);

    // Right Pontoon
    const rightPontoonCyl = new THREE.Mesh(pontoonCylGeo, hullRedMat);
    rightPontoonCyl.position.set(2.2, -0.5, 0);
    rightPontoonCyl.castShadow = true;
    rightPontoonCyl.receiveShadow = true;
    vesselGroup.add(rightPontoonCyl);

    const rightBow = new THREE.Mesh(bowConeGeo, hullRedMat);
    rightBow.position.set(2.2, -0.5, 7.25);
    rightBow.castShadow = true;
    vesselGroup.add(rightBow);

    // Propeller pods at stern (Z = -6.0)
    const thrusterShroudGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.5, 8, 1, true);
    thrusterShroudGeo.rotateX(Math.PI / 2);
    const thrusterHubGeo = new THREE.ConeGeometry(0.12, 0.4, 8);
    thrusterHubGeo.rotateX(-Math.PI / 2);

    // Left thruster
    const leftShroud = new THREE.Mesh(thrusterShroudGeo, mastMat);
    leftShroud.position.set(-2.2, -0.5, -6.25);
    leftShroud.castShadow = true;
    vesselGroup.add(leftShroud);

    const leftHub = new THREE.Mesh(thrusterHubGeo, mastMat);
    leftHub.position.set(-2.2, -0.5, -6.35);
    vesselGroup.add(leftHub);

    // Right thruster
    const rightShroud = new THREE.Mesh(thrusterShroudGeo, mastMat);
    rightShroud.position.set(2.2, -0.5, -6.25);
    rightShroud.castShadow = true;
    vesselGroup.add(rightShroud);

    const rightHub = new THREE.Mesh(thrusterHubGeo, mastMat);
    rightHub.position.set(2.2, -0.5, -6.35);
    vesselGroup.add(rightHub);

    // Glowing cyan pontoon stripes
    const decalGeo = new THREE.CylinderGeometry(0.08, 0.08, 9.0, 4);
    decalGeo.rotateX(Math.PI / 2);

    const leftDecal = new THREE.Mesh(decalGeo, glowCyanMat);
    leftDecal.position.set(-2.8, -0.4, 0);
    vesselGroup.add(leftDecal);

    const rightDecal = new THREE.Mesh(decalGeo, glowCyanMat);
    rightDecal.position.set(2.8, -0.4, 0);
    vesselGroup.add(rightDecal);

    // 2. Central Deck Platform
    const deckGeo = new THREE.BoxGeometry(4.4, 0.3, 13.0);
    const deck = new THREE.Mesh(deckGeo, deckWhiteMat);
    deck.position.set(0, 0.3, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    vesselGroup.add(deck);

    // Railings / Side plates
    const sidePlateGeo = new THREE.BoxGeometry(0.15, 0.6, 13.0);
    const leftPlate = new THREE.Mesh(sidePlateGeo, hullRedMat);
    leftPlate.position.set(-2.1, 0.6, 0);
    leftPlate.castShadow = true;
    leftPlate.receiveShadow = true;
    vesselGroup.add(leftPlate);

    const rightPlate = new THREE.Mesh(sidePlateGeo, hullRedMat);
    rightPlate.position.set(2.1, 0.6, 0);
    rightPlate.castShadow = true;
    rightPlate.receiveShadow = true;
    vesselGroup.add(rightPlate);

    // 3. Cabin Superstructure
    const cabinGeo = new THREE.BoxGeometry(3.6, 1.3, 7.0);
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.0, -2.2);
    cabin.castShadow = true;
    cabin.receiveShadow = true;
    vesselGroup.add(cabin);

    // Bridge Cabin
    const bridgeGeo = new THREE.BoxGeometry(3.0, 1.0, 3.5);
    const bridge = new THREE.Mesh(bridgeGeo, deckWhiteMat);
    bridge.position.set(0, 2.05, 0.5);
    bridge.castShadow = true;
    vesselGroup.add(bridge);

    // Slanted Front Windshield
    const windshieldGeo = new THREE.BoxGeometry(2.8, 0.9, 0.05);
    const windshield = new THREE.Mesh(windshieldGeo, windowMat);
    windshield.position.set(0, 2.0, 2.2);
    windshield.rotateX(Math.PI / 7); // Slanted back
    vesselGroup.add(windshield);

    // Side Windows
    const sideWindowGeo = new THREE.BoxGeometry(0.02, 0.5, 2.0);
    const leftSideWindow = new THREE.Mesh(sideWindowGeo, windowMat);
    leftSideWindow.position.set(-1.51, 2.05, 0.5);
    vesselGroup.add(leftSideWindow);

    const rightSideWindow = new THREE.Mesh(sideWindowGeo, windowMat);
    rightSideWindow.position.set(1.51, 2.05, 0.5);
    vesselGroup.add(rightSideWindow);

    // 4. Navigation Lights
    const navLightGeo = new THREE.SphereGeometry(0.12, 8, 8);
    // Port (Red)
    const portLight = new THREE.Mesh(navLightGeo, redLightMat);
    portLight.position.set(-1.55, 2.4, 1.5);
    vesselGroup.add(portLight);

    // Starboard (Green)
    const starboardLight = new THREE.Mesh(navLightGeo, greenLightMat);
    starboardLight.position.set(1.55, 2.4, 1.5);
    vesselGroup.add(starboardLight);

    // 5. Stern A-Frame Crane Gantry
    const craneGeo = new THREE.CylinderGeometry(0.06, 0.08, 4.0, 8);
    const leftCrane = new THREE.Mesh(craneGeo, mastMat);
    leftCrane.position.set(-1.6, 1.8, -5.5);
    leftCrane.rotation.z = Math.PI / 15; // tilt in
    leftCrane.castShadow = true;
    vesselGroup.add(leftCrane);

    const rightCrane = new THREE.Mesh(craneGeo, mastMat);
    rightCrane.position.set(1.6, 1.8, -5.5);
    rightCrane.rotation.z = -Math.PI / 15; // tilt in
    rightCrane.castShadow = true;
    vesselGroup.add(rightCrane);

    const crossBarGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8);
    crossBarGeo.rotateZ(Math.PI / 2); // align along X axis
    const crossBar = new THREE.Mesh(crossBarGeo, mastMat);
    crossBar.position.set(0, 3.65, -5.5);
    crossBar.castShadow = true;
    vesselGroup.add(crossBar);

    // 6. Instrument Mast & Rotating Radar
    const mastGeo = new THREE.CylinderGeometry(0.08, 0.1, 2.5, 8);
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(0, 3.3, -0.5);
    mast.castShadow = true;
    vesselGroup.add(mast);

    const radarPlatformGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 8);
    const radarPlatform = new THREE.Mesh(radarPlatformGeo, deckWhiteMat);
    radarPlatform.position.set(0, 4.6, -0.5);
    vesselGroup.add(radarPlatform);

    // Strobe Warning Beacon on Mast top (above radar)
    const beaconGeo = new THREE.SphereGeometry(0.12, 8, 8);
    this.beaconMesh = new THREE.Mesh(beaconGeo, whiteStrobeMat);
    this.beaconMesh.position.set(0, 4.9, -0.5);
    vesselGroup.add(this.beaconMesh);

    // Rotatable Radar Group
    this.radarMesh = new THREE.Group();
    this.radarMesh.position.set(0, 4.75, -0.5);

    const dishGeo = new THREE.ConeGeometry(0.8, 0.35, 12, 1, true);
    dishGeo.rotateX(Math.PI / 3); // tilt dish up
    const dish = new THREE.Mesh(dishGeo, deckWhiteMat);
    dish.position.set(0, 0.2, 0);
    dish.castShadow = true;
    this.radarMesh.add(dish);

    const supportPinGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8);
    const supportPin = new THREE.Mesh(supportPinGeo, mastMat);
    supportPin.position.set(0, 0, 0);
    this.radarMesh.add(supportPin);

    vesselGroup.add(this.radarMesh);

    // 7. Volumetric Bow Searchlight
    const lightCasingGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.5, 8);
    lightCasingGeo.rotateX(Math.PI / 2);
    const casing = new THREE.Mesh(lightCasingGeo, deckWhiteMat);
    casing.position.set(0, 0.5, 6.2);
    casing.castShadow = true;
    vesselGroup.add(casing);

    const lensGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.05, 8);
    lensGeo.rotateX(Math.PI / 2);
    const lens = new THREE.Mesh(lensGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    lens.position.set(0, 0.5, 6.43);
    vesselGroup.add(lens);

    // Volumetric Cone Light Beam
    const searchlightBeamMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        void main() {
          // Fade out down the cone (vUv.y goes from 0 at top to 1 at bottom)
          float fade = pow(1.0 - vUv.y, 2.5);
          // Radial fade to soften the edges of the cone
          float radialFade = sin(vUv.x * 3.14159);
          float intensity = fade * radialFade * 0.22;
          gl_FragColor = vec4(vec3(0.3, 0.92, 1.0), intensity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const beamGeo = new THREE.ConeGeometry(2.0, 16.0, 16, 1, true);
    beamGeo.translate(0, -8.0, 0); // pivot at tip
    beamGeo.rotateX(Math.PI / 3.0); // angle forward and down
    const searchlightBeam = new THREE.Mesh(beamGeo, searchlightBeamMat);
    searchlightBeam.position.set(0, 0.5, 6.4);
    vesselGroup.add(searchlightBeam);

    // 8. Heavy Octagon Docking Port under keel
    const dockBaseGeo = new THREE.CylinderGeometry(2.1, 2.1, 0.4, 8);
    const dockBase = new THREE.Mesh(dockBaseGeo, mastMat);
    dockBase.position.set(0, -0.9, 0.0);
    dockBase.castShadow = true;
    dockBase.receiveShadow = true;
    vesselGroup.add(dockBase);

    const dockRing = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.6, 16), glowGreenMat);
    dockRing.geometry.rotateX(Math.PI / 2);
    dockRing.position.set(0, -1.11, 0.0);
    vesselGroup.add(dockRing);

    // Tapered energetic docking tractor beam
    const dockBeamGeo = new THREE.CylinderGeometry(1.4, 2.2, 5.0, 16, 1, true);
    dockBeamGeo.translate(0, -2.5, 0); // pivot at top center of port

    const dockBeam = new THREE.Mesh(dockBeamGeo, this.dockBeamMat);
    dockBeam.position.set(0, -1.1, 0.0);
    vesselGroup.add(dockBeam);

    // Position the whole ship on the surface at coordinates (0, 0)
    vesselGroup.position.set(0, 0, 0);

    this.scene.add(vesselGroup);
    this.vessel = vesselGroup;
  }

  createSharkMesh() {
    const sharkGroup = new THREE.Group();

    // Materials
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x1d2936, // Deep slate grey/blue
      roughness: 0.3,
      metalness: 0.5
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x070c12, // Dark slate for mouth and gills
      roughness: 0.8
    });

    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x00ffaa,
      emissive: 0x00ffaa,
      emissiveIntensity: 1.5,
      roughness: 0.2
    });

    // 1. Body cylinder (main trunk)
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.5, 3.0, 8);
    bodyGeo.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, skinMat);
    body.castShadow = true;
    body.receiveShadow = true;
    sharkGroup.add(body);

    // 2. Snout (Flat, wide shark head pointing forward)
    const snoutGeo = new THREE.ConeGeometry(0.35, 1.2, 8);
    snoutGeo.rotateX(Math.PI / 2);
    snoutGeo.scale(1.4, 0.6, 1.0); // Flatten horizontally & widen
    const snout = new THREE.Mesh(snoutGeo, skinMat);
    snout.position.set(0, -0.08, 2.1); // Shift forward & down slightly
    snout.castShadow = true;
    sharkGroup.add(snout);

    // Ventral Mouth (underside of snout)
    const mouthGeo = new THREE.BoxGeometry(0.42, 0.08, 0.55);
    const mouth = new THREE.Mesh(mouthGeo, darkMat);
    mouth.position.set(0, -0.32, 1.45);
    sharkGroup.add(mouth);

    // Tiny glowing teeth row at the front edge of the mouth
    const teethGeo = new THREE.BoxGeometry(0.38, 0.03, 0.03);
    const teeth = new THREE.Mesh(teethGeo, glowMat);
    teeth.position.set(0, -0.33, 1.68);
    sharkGroup.add(teeth);

    // 3. Tail Cone (tapering backward)
    const tailConeGeo = new THREE.ConeGeometry(0.5, 1.8, 8);
    tailConeGeo.rotateX(-Math.PI / 2);
    const tailCone = new THREE.Mesh(tailConeGeo, skinMat);
    tailCone.position.set(0, 0, -2.4); // Shift backward
    tailCone.castShadow = true;
    sharkGroup.add(tailCone);

    // 4. Fins
    // Classic Curved Dorsal Fin (Top)
    const dorsalBase = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.65), skinMat);
    dorsalBase.rotation.x = Math.PI / 10; // slanted back
    dorsalBase.position.set(0, 0.65, -0.15);
    dorsalBase.castShadow = true;
    sharkGroup.add(dorsalBase);

    const dorsalTip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.4), skinMat);
    dorsalTip.rotation.x = Math.PI / 4; // swept tip
    dorsalTip.position.set(0, 0.85, -0.45);
    dorsalTip.castShadow = true;
    sharkGroup.add(dorsalTip);

    // Second smaller dorsal fin (near tail)
    const secondDorsal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.28), skinMat);
    secondDorsal.rotation.x = Math.PI / 8;
    secondDorsal.position.set(0, 0.5, -2.1);
    secondDorsal.castShadow = true;
    sharkGroup.add(secondDorsal);

    // Pelvic/Anal fin (underside near tail)
    const analFin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.24), skinMat);
    analFin.rotation.x = -Math.PI / 8;
    analFin.position.set(0, -0.5, -2.1);
    analFin.castShadow = true;
    sharkGroup.add(analFin);

    // Left Pectoral Fin (Wide swept shark wing)
    const leftPecGeo = new THREE.BoxGeometry(1.2, 0.04, 0.5);
    leftPecGeo.rotateY(-Math.PI / 6); // Sweep back
    leftPecGeo.rotateZ(-Math.PI / 10); // Tilt down
    const leftPec = new THREE.Mesh(leftPecGeo, skinMat);
    leftPec.position.set(0.95, -0.25, 0.75);
    leftPec.castShadow = true;
    sharkGroup.add(leftPec);

    // Right Pectoral Fin (Wide swept shark wing)
    const rightPecGeo = new THREE.BoxGeometry(1.2, 0.04, 0.5);
    rightPecGeo.rotateY(Math.PI / 6); // Sweep back
    rightPecGeo.rotateZ(Math.PI / 10); // Tilt down
    const rightPec = new THREE.Mesh(rightPecGeo, skinMat);
    rightPec.position.set(-0.95, -0.25, 0.75);
    rightPec.castShadow = true;
    sharkGroup.add(rightPec);

    // 5. Bioluminescent details
    // Glowing Eyes
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, glowMat);
    leftEye.position.set(0.28, 0.08, 2.15);
    sharkGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, glowMat);
    rightEye.position.set(-0.28, 0.08, 2.15);
    sharkGroup.add(rightEye);

    // Glowing side lines
    const stripeGeo = new THREE.CylinderGeometry(0.02, 0.02, 2.4, 4);
    stripeGeo.rotateX(Math.PI / 2);

    const leftStripe = new THREE.Mesh(stripeGeo, glowMat);
    leftStripe.position.set(0.48, 0.05, 0);
    sharkGroup.add(leftStripe);

    const rightStripe = new THREE.Mesh(stripeGeo, glowMat);
    rightStripe.position.set(-0.48, 0.05, 0);
    sharkGroup.add(rightStripe);

    // 5 vertical gill slits on each side of the head
    const gillGeo = new THREE.BoxGeometry(0.012, 0.35, 0.015);
    for (let g = 0; g < 5; g++) {
      const zVal = 1.35 - g * 0.12; // spawn in sequence behind eye

      const leftGill = new THREE.Mesh(gillGeo, darkMat);
      leftGill.position.set(0.44, -0.05, zVal);
      leftGill.rotation.y = Math.PI / 12;
      sharkGroup.add(leftGill);

      const rightGill = new THREE.Mesh(gillGeo, darkMat);
      rightGill.position.set(-0.44, -0.05, zVal);
      rightGill.rotation.y = -Math.PI / 12;
      sharkGroup.add(rightGill);
    }

    // 6. Heterocercal Caudal Tail Fin (vertical fin at the back that wiggles)
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0, -3.3); // Pivot at the end of the tail cone
    sharkGroup.add(tailGroup);

    // Upper Lobe (Longer, swept back)
    const upperLobeGeo = new THREE.BoxGeometry(0.06, 1.25, 0.35);
    upperLobeGeo.rotateX(Math.PI / 4.7); // Slanted back
    const upperLobe = new THREE.Mesh(upperLobeGeo, skinMat);
    upperLobe.position.set(0, 0.52, -0.28);
    upperLobe.castShadow = true;
    tailGroup.add(upperLobe);

    // Lower Lobe (Shorter)
    const lowerLobeGeo = new THREE.BoxGeometry(0.05, 0.55, 0.25);
    lowerLobeGeo.rotateX(-Math.PI / 4.7); // Slanted back-down
    const lowerLobe = new THREE.Mesh(lowerLobeGeo, skinMat);
    lowerLobe.position.set(0, -0.22, -0.15);
    lowerLobe.castShadow = true;
    tailGroup.add(lowerLobe);

    // Connector plate
    const connectPlate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.3), skinMat);
    connectPlate.position.set(0, 0.1, -0.12);
    connectPlate.castShadow = true;
    tailGroup.add(connectPlate);

    // Glowing stripe on the tip of the upper lobe
    const tailStripeGeo = new THREE.BoxGeometry(0.08, 0.8, 0.08);
    tailStripeGeo.rotateX(Math.PI / 4.7);
    const tailStripe = new THREE.Mesh(tailStripeGeo, glowMat);
    tailStripe.position.set(0, 0.85, -0.52);
    tailGroup.add(tailStripe);

    return {
      mesh: sharkGroup,
      tail: tailGroup
    };
  }
}
