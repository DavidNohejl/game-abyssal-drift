import * as THREE from 'three';

export class MarineSnow {
  constructor(scene, count = 1500) {
    this.scene = scene;
    this.count = count;
    this.boxSize = 75; // Bounding box size centered on the player
    
    // Initialize points geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * this.boxSize;
      positions[i * 3 + 1] = (Math.random() - 0.5) * this.boxSize;
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.boxSize;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Shader material
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        headlightPos: { value: new THREE.Vector3() },
        headlightDir: { value: new THREE.Vector3(0, 0, 1) },
        headlightOn: { value: 1.0 },
        time: { value: 0 }
      },
      vertexShader: `
        uniform vec3 headlightPos;
        uniform vec3 headlightDir;
        uniform float headlightOn;
        uniform float time;
        varying float vIntensity;
        
        void main() {
          // Compute world position of particle
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          
          // Sway movement using a tiny sine wave on Y and X
          worldPos.x += sin(time * 0.7 + position.y) * 0.15;
          worldPos.z += cos(time * 0.5 + position.x) * 0.15;
          
          vec3 toParticle = worldPos.xyz - headlightPos;
          float dist = length(toParticle);
          
          float intensity = 0.12; // dim ambient visibility
          
          if (headlightOn > 0.5 && dist < 85.0) {
            vec3 toParticleDir = normalize(toParticle);
            // Spotlight cone is Math.PI/12 (15 degrees) -> cos(15 deg) is 0.9659
            float cosAngle = dot(toParticleDir, headlightDir);
            if (cosAngle > 0.9659) {
              float coneFade = (cosAngle - 0.9659) / (1.0 - 0.9659);
              float distFade = 1.0 - (dist / 85.0);
              intensity += 1.2 * coneFade * distFade * distFade;
            }
          }
          
          vIntensity = intensity;
          
          // Perspective sizing
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (9.0 / -mvPosition.z) * (1.0 + intensity * 0.4);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vIntensity;
        
        void main() {
          // Draw as circular particles instead of square blocks
          vec2 coord = gl_PointCoord - vec2(0.5);
          if (length(coord) > 0.5) discard;
          
          vec3 baseColor = vec3(0.08, 0.35, 0.52); // dim ambient ocean particle
          vec3 glowColor = vec3(0.0, 0.95, 1.0);  // glowing headlight cyan core
          
          vec3 finalColor = mix(baseColor, glowColor, clamp((vIntensity - 0.12) / 1.2, 0.0, 1.0));
          float alpha = clamp(vIntensity * 0.45, 0.04, 0.70) * (1.0 - length(coord) * 2.0);
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    this.points = new THREE.Points(geometry, this.material);
    this.scene.add(this.points);
    this.visible = false;
    this.points.visible = false;
  }
  
  setVisible(visible) {
    this.visible = visible;
    this.points.visible = visible;
  }
  
  update(delta, time, playerPos, headlightPos, headlightDir, headlightOn) {
    if (!this.visible) return;
    
    // Update uniforms
    this.material.uniforms.headlightPos.value.copy(headlightPos);
    this.material.uniforms.headlightDir.value.copy(headlightDir);
    this.material.uniforms.headlightOn.value = headlightOn ? 1.0 : 0.0;
    this.material.uniforms.time.value = time;
    
    // Drift downward & wrap position relative to the player
    const positions = this.points.geometry.attributes.position.array;
    const halfBox = this.boxSize / 2;
    
    for (let i = 0; i < this.count; i++) {
      // 1. Move particle downward (drift)
      positions[i * 3 + 1] -= delta * 0.8;
      
      // 2. Wrap positions relative to the player coordinates
      let rx = positions[i * 3] - playerPos.x;
      let ry = positions[i * 3 + 1] - playerPos.y;
      let rz = positions[i * 3 + 2] - playerPos.z;
      
      if (rx > halfBox) positions[i * 3] -= this.boxSize;
      else if (rx < -halfBox) positions[i * 3] += this.boxSize;
      
      if (ry > halfBox) positions[i * 3 + 1] -= this.boxSize;
      else if (ry < -halfBox) positions[i * 3 + 1] += this.boxSize;
      
      if (rz > halfBox) positions[i * 3 + 2] -= this.boxSize;
      else if (rz < -halfBox) positions[i * 3 + 2] += this.boxSize;
    }
    
    this.points.geometry.attributes.position.needsUpdate = true;
  }
  
  destroy() {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
