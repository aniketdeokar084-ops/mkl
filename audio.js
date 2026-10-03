let audioCtx = null;
let masterGain = null;
let ambientSource = null;
let ambientGain = null;
let isAmbientPlaying = false;

/**
 * Initializes the AudioContext. Must be called after user interaction.
 */
export function initAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.connect(audioCtx.destination);
      masterGain.gain.value = 0.7; // default
      
      ambientGain = audioCtx.createGain();
      ambientGain.connect(masterGain);
      ambientGain.gain.value = 0.5; // default ambient volume
    }
  } catch (e) {
    console.error('Error initializing audio:', e);
  }
}

/**
 * Internal helper to ensure audio context is ready
 */
function ensureContext() {
  if (!audioCtx) {
    initAudio();
  } else if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/**
 * @param {string} soundName 'bell' | 'chime' | 'digital' | 'nature'
 */
export function playAlarm(soundName) {
  try {
    ensureContext();
    if (!audioCtx) return;

    const t = audioCtx.currentTime;

    if (soundName === 'bell') {
      for (let i = 0; i < 2; i++) {
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523, t + i * 0.5); // C5
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659, t + i * 0.5); // E5
        
        gainNode.gain.setValueAtTime(0, t + i * 0.5);
        gainNode.gain.linearRampToValueAtTime(0.5, t + i * 0.5 + 0.01); // attack
        gainNode.gain.linearRampToValueAtTime(0.3, t + i * 0.5 + 0.3); // sustain
        gainNode.gain.exponentialRampToValueAtTime(0.001, t + i * 0.5 + 1.5); // release
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(masterGain);
        
        osc1.start(t + i * 0.5);
        osc2.start(t + i * 0.5);
        osc1.stop(t + i * 0.5 + 1.5);
        osc2.stop(t + i * 0.5 + 1.5);
      }
    } else if (soundName === 'chime') {
      const freqs = [523, 659, 784]; // C5, E5, G5
      freqs.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const startT = t + i * 0.15;
        
        osc.type = 'triangle';
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0, startT);
        gain.gain.linearRampToValueAtTime(0.4, startT + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.3);
        
        osc.connect(gain);
        gain.connect(masterGain);
        
        osc.start(startT);
        osc.stop(startT + 0.3);
      });
    } else if (soundName === 'digital') {
      for (let i = 0; i < 3; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const startT = t + i * 0.25;
        
        osc.type = 'square';
        osc.frequency.value = 880;
        
        gain.gain.setValueAtTime(0, startT);
        gain.gain.setValueAtTime(0.3, startT + 0.01);
        gain.gain.setValueAtTime(0, startT + 0.1);
        
        osc.connect(gain);
        gain.connect(masterGain);
        
        osc.start(startT);
        osc.stop(startT + 0.1);
      }
    } else if (soundName === 'nature') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 1.5);
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2);
      
      osc.connect(gain);
      gain.connect(masterGain);
      
      osc.start(t);
      osc.stop(t + 2);
    }
  } catch (e) {
    console.error('Error playing alarm:', e);
  }
}

/**
 * Plays a short tick sound
 */
export function playTick() {
  try {
    ensureContext();
    if (!audioCtx) return;

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = 800;
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.001); // 1ms burst
    gain.gain.linearRampToValueAtTime(0, t + 0.002);
    
    osc.connect(gain);
    gain.connect(masterGain);
    
    osc.start(t);
    osc.stop(t + 0.002);
  } catch (e) {
    console.error('Error playing tick:', e);
  }
}

/**
 * @param {number} volume 0 to 1
 */
export function setVolume(volume) {
  try {
    if (masterGain) {
      masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), audioCtx.currentTime);
    }
  } catch (e) {
    console.error('Error setting volume:', e);
  }
}

function createNoiseBuffer(duration, audioContext) {
  const length = audioContext.sampleRate * duration;
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * @param {string} type 'rain' | 'cafe' | 'whitenoise'
 */
export function startAmbient(type) {
  try {
    stopAmbient();
    ensureContext();
    if (!audioCtx) return;

    const buffer = createNoiseBuffer(5, audioCtx); // 5 second loop
    ambientSource = audioCtx.createBufferSource();
    ambientSource.buffer = buffer;
    ambientSource.loop = true;

    const filter = audioCtx.createBiquadFilter();
    
    if (type === 'rain') {
      filter.type = 'bandpass';
      filter.frequency.value = 400;
      filter.Q.value = 1;
    } else if (type === 'cafe') {
      filter.type = 'bandpass';
      filter.frequency.value = 1000;
      filter.Q.value = 0.7;
    } else if (type === 'whitenoise') {
      filter.type = 'lowpass';
      filter.frequency.value = 4000;
    }

    ambientSource.connect(filter);
    filter.connect(ambientGain);
    
    ambientSource.start();
    isAmbientPlaying = true;
  } catch (e) {
    console.error('Error starting ambient sound:', e);
  }
}

/**
 * Stops ambient sound
 */
export function stopAmbient() {
  try {
    if (ambientSource) {
      ambientSource.stop();
      ambientSource.disconnect();
      ambientSource = null;
    }
    isAmbientPlaying = false;
  } catch (e) {
    console.error('Error stopping ambient:', e);
  }
}

/**
 * @param {number} volume 0 to 1
 */
export function setAmbientVolume(volume) {
  try {
    if (ambientGain) {
      ambientGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), audioCtx.currentTime);
    }
  } catch (e) {
    console.error('Error setting ambient volume:', e);
  }
}
