let audioCtx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.3,
): void {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available
  }
}

export function playPhaseBeep(): void {
  playTone(880, 0.15, 'sine', 0.3);
}

export function playCountdownBeep(): void {
  playTone(660, 0.1, 'sine', 0.2);
}

export function playDoubleBeep(): void {
  playTone(880, 0.1, 'sine', 0.3);
  setTimeout(() => playTone(880, 0.1, 'sine', 0.3), 150);
}

export function playCompleteChime(): void {
  playTone(523, 0.3, 'sine', 0.3);
  setTimeout(() => playTone(659, 0.3, 'sine', 0.3), 200);
  setTimeout(() => playTone(784, 0.5, 'sine', 0.3), 400);
}

export function playHoldStart(): void {
  playTone(440, 0.3, 'triangle', 0.25);
}

export function playBreatheStart(): void {
  playTone(523, 0.2, 'sine', 0.2);
}

export function ensureAudioContext(): void {
  getContext();
}
