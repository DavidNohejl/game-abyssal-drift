// ABYSSAL DRIFT - Procedural Web Audio Engine

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.ambienceNode = null;
    this.ambienceNoiseNode = null;
    this.ambienceFilter = null;
    this.masterGain = null;
    this.ambienceGain = null;
    this.initialized = false;
    this.pingInterval = null;
  }

  // Initialized on first user click to satisfy browser security rules
  init() {
    if (this.initialized) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      // Master gain node
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.enabled ? 0.8 : 0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      
      // Start background ambience
      this.setupAmbience();
      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported in this browser:", e);
    }
  }

  toggleSound(forceState = null) {
    this.enabled = forceState !== null ? forceState : !this.enabled;
    if (this.masterGain && this.ctx) {
      // Smooth transition to avoid pops
      const targetGain = this.enabled ? 0.8 : 0;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
    }
    return this.enabled;
  }

  // Create a continuous, smooth underwater drone using LFOs, swelling noise wash, and soft pings
  setupAmbience() {
    if (!this.ctx) return;

    // 1. Create a deep, smooth sub-bass sine drone (instead of buzzy triangle)
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(38, this.ctx.currentTime); // 38Hz (smooth sub rumble)

    // LFO to slowly modulate drone frequency (simulates subtle underwater currents)
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.1, this.ctx.currentTime); // 10s cycle
    
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(1.5, this.ctx.currentTime); // +/- 1.5Hz

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // 2. Create a noise buffer for the gentle water wash
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // Filter to cut off noise frequencies above 100Hz (muffled water)
    this.ambienceFilter = this.ctx.createBiquadFilter();
    this.ambienceFilter.type = 'lowpass';
    this.ambienceFilter.frequency.setValueAtTime(80, this.ctx.currentTime);
    this.ambienceFilter.Q.setValueAtTime(1, this.ctx.currentTime);

    // Soothing LFO to slowly swell/fade water wash (12s cycle)
    const swellLfo = this.ctx.createOscillator();
    swellLfo.type = 'sine';
    swellLfo.frequency.setValueAtTime(0.08, this.ctx.currentTime);

    const swellGain = this.ctx.createGain();
    swellGain.gain.setValueAtTime(0.08, this.ctx.currentTime); // Mod depth

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, this.ctx.currentTime); // Base wash volume (very gentle)

    swellLfo.connect(swellGain);
    swellGain.connect(noiseGain.gain);

    // Ambient gain controls
    this.ambienceGain = this.ctx.createGain();
    this.ambienceGain.gain.setValueAtTime(0.18, this.ctx.currentTime); // Softer overall

    // Connect nodes
    osc.connect(this.ambienceFilter);
    
    noiseSource.connect(noiseGain);
    noiseGain.connect(this.ambienceFilter);
    
    this.ambienceFilter.connect(this.ambienceGain);
    this.ambienceGain.connect(this.masterGain);

    // Start playback
    osc.start(0);
    lfo.start(0);
    swellLfo.start(0);
    noiseSource.start(0);

    this.ambienceNode = osc;
    this.ambienceNoiseNode = noiseSource;

    // Start periodic echoing sonar pings for high-tech deep-sea atmosphere
    this.startAmbientPing();
  }

  startAmbientPing() {
    if (!this.ctx || this.pingInterval) return;
    
    const playPing = () => {
      if (!this.enabled || !this.initialized || this.ctx.state === 'suspended') return;
      
      const now = this.ctx.currentTime;
      
      // Primary Ping
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1050, now);
      
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.015, now + 0.05); // very soft attack
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 4.0); // long decay
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1050, now);
      filter.Q.setValueAtTime(1.5, now);
      
      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      osc.start(now);
      osc.stop(now + 4.1);
      
      // Soft echo 0.95 seconds later
      setTimeout(() => {
        if (!this.enabled || !this.initialized || this.ctx.state === 'suspended') return;
        const echoNow = this.ctx.currentTime;
        
        const echoOsc = this.ctx.createOscillator();
        echoOsc.type = 'sine';
        echoOsc.frequency.setValueAtTime(1000, echoNow); // lower pitch
        
        const echoGain = this.ctx.createGain();
        echoGain.gain.setValueAtTime(0.001, echoNow);
        echoGain.gain.linearRampToValueAtTime(0.004, echoNow + 0.05);
        echoGain.gain.exponentialRampToValueAtTime(0.001, echoNow + 3.0);
        
        const echoFilter = this.ctx.createBiquadFilter();
        echoFilter.type = 'bandpass';
        echoFilter.frequency.setValueAtTime(1000, echoNow);
        echoFilter.Q.setValueAtTime(1.0, echoNow);
        
        echoOsc.connect(echoFilter);
        echoFilter.connect(echoGain);
        echoGain.connect(this.masterGain);
        
        echoOsc.start(echoNow);
        echoOsc.stop(echoNow + 3.1);
      }, 950);
    };
    
    // Play initial ping after 4 seconds
    setTimeout(() => playPing(), 4000);
    this.pingInterval = setInterval(playPing, 16000); // every 16 seconds
  }

  // Adjust underwater ambient hum properties based on the turtle's depth
  updateDepthEffects(depth) {
    if (!this.initialized || !this.enabled || !this.ambienceFilter) return;

    // As we go deeper:
    // - Low pass filter cuts off lower (muffled sound)
    // - Volumetric gain increases slightly to feel heavier
    const targetCutoff = Math.max(50, 100 - depth * 0.4); 
    const targetGain = Math.min(0.6, 0.4 + (depth * 0.001));

    this.ambienceFilter.frequency.setTargetAtTime(targetCutoff, this.ctx.currentTime, 0.5);
    this.ambienceGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.5);
  }

  // Pearl collection bubble pop
  playBubble() {
    if (!this.initialized || !this.enabled) return;

    const now = this.ctx.currentTime;
    
    // Bubble main pop frequency sweep
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.12);

    // Volume envelope
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    // Slight high pass filter for a crisp pop
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(150, now);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  // Speed boost swim stroke (swoosh)
  playBoost() {
    if (!this.initialized || !this.enabled) return;

    const now = this.ctx.currentTime;
    const duration = 0.5;

    // 1. Swoosh noise
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Dynamic bandpass sweep
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(150, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + duration * 0.4);
    filter.frequency.exponentialRampToValueAtTime(100, now + duration);
    filter.Q.setValueAtTime(3, now);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.4, now + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // 2. Heavy kick/thrust frequency sweep
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(80, now);
    subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.6, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    noise.start(now);
    subOsc.start(now);

    noise.stop(now + duration);
    subOsc.stop(now + 0.5);
  }

  // Surfacing splash sound
  playSplash() {
    if (!this.initialized || !this.enabled) return;

    const now = this.ctx.currentTime;
    const duration = 0.8;

    // Create water splash noise
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Lowpass filter sweeping up then down
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.frequency.exponentialRampToValueAtTime(500, now + 0.3);
    filter.frequency.exponentialRampToValueAtTime(150, now + duration);
    filter.Q.setValueAtTime(2, now);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.5, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Deep splash impact rumble
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(150, now);
    sub.frequency.exponentialRampToValueAtTime(40, now + 0.25);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    sub.connect(subGain);
    subGain.connect(this.masterGain);

    noise.start(now);
    sub.start(now);

    noise.stop(now + duration);
    sub.stop(now + 0.4);
  }

  // Jellyfish sting/zap (Dissonant high-pass sweep)
  playSting() {
    if (!this.initialized || !this.enabled) return;

    const now = this.ctx.currentTime;
    
    // Create dual dissonant oscillators
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(240, now);
    osc1.frequency.linearRampToValueAtTime(80, now + 0.25);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(247, now); // Slightly off for beat-frequency dissonance
    osc2.frequency.linearRampToValueAtTime(83, now + 0.25);

    // Zap noise burst
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(2000, now);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    noise.connect(highpass);
    highpass.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    noise.start(now);

    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
    noise.stop(now + 0.3);
  }

  // Play a happy, ascending major/pentatonic arpeggio at start
  playStart() {
    if (!this.initialized || !this.enabled) return;

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5
    
    notes.forEach((freq, idx) => {
      const time = now + idx * 0.08;
      
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0.001, time);
      gainNode.gain.linearRampToValueAtTime(0.2, time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, time);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      osc.start(time);
      osc.stop(time + 0.42);
    });
  }

  // Game over / submerge out chime (sad descending minor chords)
  playGameOver() {
    if (!this.initialized || !this.enabled) return;

    const now = this.ctx.currentTime;
    const notes = [392.00, 311.13, 233.08, 196.00]; // G4, Eb4, Bb3, G3 (descending G minor arpeggio)
    
    notes.forEach((freq, idx) => {
      const time = now + idx * 0.15;
      
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0.001, time);
      gainNode.gain.linearRampToValueAtTime(0.25, time + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, time); // Very muffled, underwater feel

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      osc.start(time);
      osc.stop(time + 0.85);
    });
  }

  playScanTones(progress) {
    if (!this.initialized || !this.enabled) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(700 + progress * 4.0, now); // frequency increases with progress
    
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.06, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    osc.connect(gainNode);
    gainNode.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playScanSuccess() {
    if (!this.initialized || !this.enabled) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(783.99, now + 0.08); // G5
    
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    
    osc.connect(gainNode);
    gainNode.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }
}

// Export a single global sound instance
export const audio = new SoundEngine();
