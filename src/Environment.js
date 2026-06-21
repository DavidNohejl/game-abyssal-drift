import * as THREE from 'three';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.surfaceMesh = null;
    this.surfaceGeoPositions = null;
    this.terrainMesh = null;
    this.godRaysGroup = null;
    this.planktonParticles = null;
    
    this.create();
  }

  create() {
    // 1. OCEAN SURFACE (Undulating Semi-Transparent Plane)
    const surfaceGeo = new THREE.PlaneGeometry(500, 500, 40, 40);
    surfaceGeo.rotateX(-Math.PI / 2);
    
    const surfaceMat = new THREE.MeshStandardMaterial({
      color: 0x00bcff,
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    
    this.surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    this.scene.add(this.surfaceMesh);
    
    // Save original vertex positions for wave calculations
    this.surfaceGeoPositions = surfaceGeo.attributes.position.clone();
    
    // 2. OCEAN BED (Procedural Sand Dunes painted via Vertices)
    const terrainGeo = new THREE.PlaneGeometry(600, 600, 80, 80);
    terrainGeo.rotateX(-Math.PI / 2);
    
    const pos = terrainGeo.attributes.position;
    const colors = [];
    const minHeight = -48;
    const maxHeight = -8;
    
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      
      // Compute height using sine ripples
      let height = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 4;
      height += Math.sin(x * 0.08) * Math.sin(z * 0.08) * 1.5;
      height += Math.cos(x * 0.012) * Math.sin(z * 0.012) * 9; // hills
      
      // Add seamount mountains
      const m1 = 25 * Math.exp(-(Math.pow(x - 70, 2) + Math.pow(z - 80, 2)) / 3200);
      const m2 = 22 * Math.exp(-(Math.pow(x + 90, 2) + Math.pow(z + 70, 2)) / 2500);
      const m3 = 28 * Math.exp(-(Math.pow(x + 80, 2) + Math.pow(z - 90, 2)) / 4000);
      const m4 = 24 * Math.exp(-(Math.pow(x - 100, 2) + Math.pow(z + 100, 2)) / 1800);
      height += m1 + m2 + m3 + m4;
      
      const finalY = height - 38; // Place bed around -38m depth
      pos.setY(i, finalY);
      
      // Calculate color value based on height
      const ratio = Math.max(0, Math.min(1, (finalY - minHeight) / (maxHeight - minHeight)));
      
      // Interpolate along multi-stop color band (indigo -> emerald teal -> cyan -> volcano gold)
      let r, g, b;
      if (ratio < 0.4) {
        // Interpolate valley (indigo) to mid-slope (emerald teal)
        const t = ratio / 0.4;
        r = 0.02 + (0.00 - 0.02) * t;
        g = 0.07 + (0.45 - 0.07) * t;
        b = 0.16 + (0.35 - 0.16) * t;
      } else if (ratio < 0.8) {
        // Interpolate mid-slope (emerald teal) to ridge (bright emerald cyan)
        const t = (ratio - 0.4) / 0.4;
        r = 0.00 + (0.00 - 0.00) * t;
        g = 0.45 + (0.80 - 0.45) * t;
        b = 0.35 + (0.60 - 0.35) * t;
      } else {
        // Interpolate ridge (emerald cyan) to peak (sulfur volcano gold/orange)
        const t = (ratio - 0.8) / 0.2;
        r = 0.00 + (0.95 - 0.00) * t;
        g = 0.80 + (0.70 - 0.80) * t;
        b = 0.60 + (0.08 - 0.60) * t;
      }
      
      colors.push(r, g, b);
    }
    
    terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();
    
    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.05
    });
    
    this.terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);
    
    // 3. GOD RAYS (Semi-Transparent shimmering light shafts)
    this.godRaysGroup = new THREE.Group();
    const rayCount = 8;
    const rayGeo = new THREE.ConeGeometry(8, 70, 8, 1, true); // Open base cone
    rayGeo.translate(0, -35, 0); // Position pivot to top
    rayGeo.rotateX(Math.PI / 8); // Slight slant
    
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    for (let i = 0; i < rayCount; i++) {
      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.position.set(
        (Math.random() - 0.5) * 120,
        0.5,
        (Math.random() - 0.5) * 120
      );
      ray.scale.set(0.6 + Math.random() * 0.8, 0.8 + Math.random() * 0.4, 0.6 + Math.random() * 0.8);
      ray.rotation.y = Math.random() * Math.PI * 2;
      ray.userData = {
        speed: 0.2 + Math.random() * 0.3,
        offset: Math.random() * 100,
        baseScaleX: ray.scale.x
      };
      this.godRaysGroup.add(ray);
    }
    this.scene.add(this.godRaysGroup);
    
    // 4. FLOATING PLANKTON PARTICLES
    const particleCount = 600;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 220;     // x
      positions[i + 1] = -40 + Math.random() * 40;     // y
      positions[i + 2] = (Math.random() - 0.5) * 220; // z
    }
    
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Small glowing cyan particles
    const particleMat = new THREE.PointsMaterial({
      color: 0x00ffc8,
      size: 0.25,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    
    this.planktonParticles = new THREE.Points(particleGeo, particleMat);
    this.scene.add(this.planktonParticles);
  }

  getTerrainHeight(x, z) {
    let height = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 4;
    height += Math.sin(x * 0.08) * Math.sin(z * 0.08) * 1.5;
    height += Math.cos(x * 0.012) * Math.sin(z * 0.012) * 9; // hills
    
    // Add seamount mountains
    const m1 = 25 * Math.exp(-(Math.pow(x - 70, 2) + Math.pow(z - 80, 2)) / 3200);
    const m2 = 22 * Math.exp(-(Math.pow(x + 90, 2) + Math.pow(z + 70, 2)) / 2500);
    const m3 = 28 * Math.exp(-(Math.pow(x + 80, 2) + Math.pow(z - 90, 2)) / 4000);
    const m4 = 24 * Math.exp(-(Math.pow(x - 100, 2) + Math.pow(z + 100, 2)) / 1800);
    height += m1 + m2 + m3 + m4;
    
    return height - 38;
  }

  update(time, delta) {
    // 1. Shimmer/Undulate Ocean Surface (Sine wave math on geometry)
    if (this.surfaceMesh) {
      const posAttr = this.surfaceMesh.geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const x = this.surfaceGeoPositions.getX(i);
        const z = this.surfaceGeoPositions.getZ(i);
        const y = Math.sin(x * 0.08 + time * 1.5) * Math.cos(z * 0.08 + time * 1.5) * 0.35;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
    }
    
    // 2. Animate god rays shimmering
    if (this.godRaysGroup) {
      this.godRaysGroup.children.forEach(ray => {
        const t = time * ray.userData.speed + ray.userData.offset;
        ray.scale.x = ray.userData.baseScaleX + Math.sin(t) * 0.15;
        ray.rotation.z = Math.sin(t * 0.5) * 0.05;
      });
    }

    // 3. Update ambient plankton particles
    if (this.planktonParticles) {
      const posAttr = this.planktonParticles.geometry.attributes.position;
      for (let i = 0; i < posAttr.count * 3; i += 3) {
        // float up
        posAttr.array[i + 1] += delta * 0.4;
        // sway left/right
        posAttr.array[i] += Math.sin(time * 0.5 + i) * 0.02;
        
        // Wrap particles if they float above surface (Y=0) or beyond horizontal bounds
        if (posAttr.array[i + 1] > 2) {
          posAttr.array[i + 1] = -42; // send to ocean bottom
          posAttr.array[i] = (Math.random() - 0.5) * 220;
          posAttr.array[i + 2] = (Math.random() - 0.5) * 220;
        }
      }
      posAttr.needsUpdate = true;
    }
  }
}
