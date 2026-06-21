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
    // 1. OCEAN SURFACE (Undulating Semi-Transparent Plane with custom GPU Shader)
    const surfaceGeo = new THREE.PlaneGeometry(500, 500, 100, 100); // Higher subdivisions for smooth GPU displacement
    surfaceGeo.rotateX(-Math.PI / 2);
    
    const surfaceMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 }
      },
      vertexShader: `
        uniform float time;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        
        float getWaveHeight(vec2 pos) {
          // Layer 1: Slow heavy swells
          float h = sin(pos.x * 0.035 + time * 1.0) * cos(pos.y * 0.035 + time * 1.0) * 1.4;
          // Layer 2: Wind chop
          h += sin(pos.x * 0.09 - time * 2.0) * cos(pos.y * 0.08 + time * 1.6) * 0.5;
          // Layer 3: Micro ripples
          h += sin(pos.x * 0.2 + time * 3.2) * 0.15;
          return h;
        }
        
        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.y = getWaveHeight(pos.xz);
          
          vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
          vWorldPosition = worldPosition.xyz;
          
          // Compute normal using finite differences of wave heights
          float eps = 0.4;
          float hL = getWaveHeight(pos.xz - vec2(eps, 0.0));
          float hR = getWaveHeight(pos.xz + vec2(eps, 0.0));
          float hD = getWaveHeight(pos.xz - vec2(0.0, eps));
          float hU = getWaveHeight(pos.xz + vec2(0.0, eps));
          
          vec3 tangent = vec3(2.0 * eps, hR - hL, 0.0);
          vec3 bitangent = vec3(0.0, hU - hD, 2.0 * eps);
          vNormal = normalize(cross(bitangent, tangent));
          
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          
          // Fresnel effect: high reflectivity at grazing angles, transparency looking straight down
          float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 4.0);
          
          // Deep ocean core water color
          vec3 deepColor = vec3(0.01, 0.06, 0.14);
          // Shallow/surface scattering turquoise color
          vec3 shallowColor = vec3(0.0, 0.72, 1.0);
          
          // Color mix combining base water depth and surface reflection
          float slope = 1.0 - normal.y; 
          vec3 waterColor = mix(deepColor, shallowColor, fresnel * 0.55 + slope * 0.45);
          
          // Procedural liquid caustic shimmer
          float caustic = sin(vWorldPosition.x * 0.15 + time * 1.5) * cos(vWorldPosition.z * 0.15 + time * 1.5);
          caustic += sin(vWorldPosition.x * 0.4 - time * 2.2) * cos(vWorldPosition.z * 0.38 + time * 1.8) * 0.5;
          caustic = smoothstep(0.65, 0.95, caustic);
          
          // Blend caustics/foam highlights
          waterColor += vec3(0.0, 0.95, 1.0) * caustic * 0.45;
          
          // Sunlight specular highlight (Blinn-Phong reflection alignment)
          vec3 sunDir = normalize(vec3(0.0, 1.0, 0.4)); // Sunlight vector
          vec3 halfDir = normalize(viewDir + sunDir);
          float spec = pow(max(0.0, dot(normal, halfDir)), 80.0); // sharp glittering highlights
          waterColor += vec3(0.9, 0.98, 1.0) * spec * 0.85;
          
          // Transparency gradient
          float opacity = mix(0.45, 0.90, fresnel);
          
          gl_FragColor = vec4(waterColor, opacity);
        }
      `,
      transparent: true,
      depthWrite: false, // Ensure transparency overlays properly with deep fog
      side: THREE.DoubleSide
    });
    
    this.surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    this.scene.add(this.surfaceMesh);
    
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
    
    const terrainMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 }
      },
      vertexColors: true,
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec3 vColor;
        
        void main() {
          vColor = color;
          vNormal = normalize(mat3(modelMatrix) * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec3 vColor;
        
        void main() {
          vec3 normal = normalize(vNormal);
          
          // 1. Lighting Setup
          // Sunlight direction (normalized)
          vec3 sunDir = normalize(vec3(0.0, 1.0, 0.4));
          // Sunlight color with intensity integrated
          vec3 sunColor = vec3(0.8627, 0.9568, 1.0) * 2.5;
          // Ambient light color with intensity integrated
          vec3 ambientColor = vec3(0.05098, 0.1686, 0.2706) * 1.5;
          
          // 2. Lambertian Diffuse Lighting
          float diffuse = max(0.0, dot(normal, sunDir));
          vec3 litColor = vColor * (ambientColor + sunColor * diffuse);
          
          // 3. Dynamic projected caustics (from world X and Z coordinates)
          // Double layer absolute sine waves for realistic web-like caustics
          float t = time * 1.5;
          
          // Layer 1
          vec2 p1 = vWorldPosition.xz * 0.18;
          float c1 = sin(p1.x + t) + cos(p1.y - t * 0.5);
          c1 = 1.0 - abs(sin(c1 * 2.5));
          
          // Layer 2
          vec2 p2 = vWorldPosition.xz * 0.09 + vec2(15.0);
          float c2 = sin(p2.x - t * 0.8) + cos(p2.y + t * 0.4);
          c2 = 1.0 - abs(cos(c2 * 2.5));
          
          // Combine and sharpen
          float caustic = pow(c1 * c2, 1.5);
          
          // Large scale modulation to prevent uniform tiling look
          float modulation = 0.5 + 0.5 * sin(vWorldPosition.x * 0.02 + time * 0.25) * cos(vWorldPosition.z * 0.02 + time * 0.2);
          caustic *= modulation;
          
          // 4. Depth-based attenuation
          // Highly visible at seamounts (-10m) and fades out at deep trenches (-40m)
          // Using a smooth clamp: Y values range from -48m to -8m
          float depthFactor = clamp((vWorldPosition.y + 40.0) / 30.0, 0.0, 1.0);
          
          // Add caustics colored highlighting to lit sand
          // In shallower areas, caustics are intense and colorized
          vec3 causticColor = vec3(0.2, 0.95, 1.0) * caustic * 0.75 * depthFactor;
          litColor += causticColor * vColor;
          
          // 5. Exponential Fog
          float depth = length(cameraPosition - vWorldPosition);
          float fogFactor = 1.0 - exp(-0.015 * 0.015 * depth * depth);
          fogFactor = clamp(fogFactor, 0.0, 1.0);
          vec3 fogColor = vec3(0.015686, 0.066667, 0.149020);
          
          gl_FragColor = vec4(mix(litColor, fogColor, fogFactor), 1.0);
        }
      `
    });
    
    this.terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);
    
    // 3. GOD RAYS (Semi-Transparent shimmering light shafts)
    this.godRaysGroup = new THREE.Group();
    const rayCount = 24; // More rays
    const rayGeo = new THREE.ConeGeometry(6, 95, 8, 1, true); // Longer and sleeker rays
    rayGeo.translate(0, -47.5, 0); // Position pivot to top
    
    const rayColors = [0x00f0ff, 0x00ffc8, 0xffebad, 0x00bfff]; // mix of cyan, emerald, golden-sun, and deep-blue
    
    for (let i = 0; i < rayCount; i++) {
      const color = rayColors[i % rayColors.length];
      const rayMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.06 + Math.random() * 0.14, // Higher visibility
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      
      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.position.set(
        (Math.random() - 0.5) * 180,
        0.5,
        (Math.random() - 0.5) * 180
      );
      ray.scale.set(0.5 + Math.random() * 0.8, 0.8 + Math.random() * 0.4, 0.5 + Math.random() * 0.8);
      ray.rotation.y = Math.random() * Math.PI * 2;
      
      const rotX = (Math.random() - 0.5) * 0.2 + (Math.PI / 8); // slight slant
      const rotZ = (Math.random() - 0.5) * 0.2;
      ray.rotation.x = rotX;
      ray.rotation.z = rotZ;
      
      ray.userData = {
        speed: 0.25 + Math.random() * 0.35,
        offset: Math.random() * 100,
        baseScaleX: ray.scale.x,
        baseScaleZ: ray.scale.z,
        baseRotX: rotX,
        baseRotZ: rotZ,
        baseOpacity: rayMat.opacity
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
    // 1. Shimmer/Undulate Ocean Surface (GPU Shader Material Update)
    if (this.surfaceMesh && this.surfaceMesh.material.uniforms) {
      this.surfaceMesh.material.uniforms.time.value = time;
    }
    
    // Update terrain caustics time uniform
    if (this.terrainMesh && this.terrainMesh.material.uniforms) {
      this.terrainMesh.material.uniforms.time.value = time;
    }
    
    // 2. Animate god rays shimmering
    if (this.godRaysGroup) {
      this.godRaysGroup.children.forEach(ray => {
        const t = time * ray.userData.speed + ray.userData.offset;
        
        // Shimmer scale
        ray.scale.x = ray.userData.baseScaleX * (1.0 + Math.sin(t) * 0.25);
        ray.scale.z = ray.userData.baseScaleZ * (1.0 + Math.cos(t * 0.8) * 0.25);
        
        // Swaying water motion
        ray.rotation.x = ray.userData.baseRotX + Math.sin(t * 0.5) * 0.08;
        ray.rotation.z = ray.userData.baseRotZ + Math.cos(t * 0.7) * 0.08;
        
        // Fade in/out independently
        ray.material.opacity = ray.userData.baseOpacity * (0.7 + Math.sin(t * 1.2) * 0.3);
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
