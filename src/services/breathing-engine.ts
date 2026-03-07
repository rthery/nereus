import type { BreathingPhase, BreathingTimerState } from '../types.js';
import { activePhases } from './breathing-presets.js';
import type { BreathingPreset } from '../types.js';

export type BreathingTickCallback = (state: BreathingTimerState) => void;
export type BreathingPhaseChangeCallback = (phase: BreathingPhase, phaseIndex: number, cycle: number) => void;
export type BreathingCountdownCallback = (secondsLeft: number) => void;
export type BreathingCompleteCallback = () => void;

export interface BreathingEngineOptions {
  preset: BreathingPreset;
  /** 0 = unlimited (minutes mode — caller decides when to abort). */
  totalCycles: number;
  onTick?: BreathingTickCallback;
  onPhaseChange?: BreathingPhaseChangeCallback;
  onCountdown?: BreathingCountdownCallback;
  onComplete?: BreathingCompleteCallback;
}

export class BreathingEngine {
  private phases: BreathingPhase[];
  private totalCycles: number;
  private onTick?: BreathingTickCallback;
  private onPhaseChange?: BreathingPhaseChangeCallback;
  private onCountdown?: BreathingCountdownCallback;
  private onComplete?: BreathingCompleteCallback;

  private _phaseIndex = 0;
  private _cycle = 1;
  private _elapsed = 0;
  private _running = false;
  private _completed = false;
  private _lastCountdown = -1;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private phaseStartTimestamp = 0;

  constructor(options: BreathingEngineOptions) {
    this.phases = activePhases(options.preset);
    this.totalCycles = options.totalCycles;
    this.onTick = options.onTick;
    this.onPhaseChange = options.onPhaseChange;
    this.onCountdown = options.onCountdown;
    this.onComplete = options.onComplete;
  }

  get state(): BreathingTimerState {
    const phase = this.phases[this._phaseIndex] ?? this.phases[0];
    const phaseDuration = phase.duration;
    // Compute live elapsed when running so rAF callers get 60fps precision
    const elapsed = this._running
      ? Math.min((performance.now() - this.phaseStartTimestamp) / 1000, phaseDuration)
      : this._elapsed;
    const remaining = Math.max(phaseDuration - elapsed, 0);
    return {
      phaseIndex: this._phaseIndex,
      phase,
      cycle: this._cycle,
      totalCycles: this.totalCycles,
      elapsed,
      remaining: Math.ceil(remaining),
      phaseDuration,
      running: this._running,
      completed: this._completed,
    };
  }

  start(): void {
    if (this._running || this._completed) return;
    this._running = true;
    this.phaseStartTimestamp = performance.now();
    this.onPhaseChange?.(this.phases[this._phaseIndex], this._phaseIndex, this._cycle);
    this.intervalId = setInterval(() => this.tick(), 100);
  }

  stop(): void {
    if (!this._running) return;
    this._running = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resume(): void {
    if (this._running || this._completed) return;
    this._running = true;
    this.phaseStartTimestamp = performance.now() - this._elapsed * 1000;
    this.intervalId = setInterval(() => this.tick(), 100);
  }

  abort(): void {
    this.stop();
    this._completed = true;
  }

  destroy(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick(): void {
    const now = performance.now();
    this._elapsed = (now - this.phaseStartTimestamp) / 1000;

    const phase = this.phases[this._phaseIndex];
    const phaseDuration = phase.duration;
    const remaining = phaseDuration - this._elapsed;

    // Countdown beeps for last 3 seconds
    const secondsLeft = Math.ceil(remaining);
    if (secondsLeft <= 3 && secondsLeft > 0 && secondsLeft !== this._lastCountdown) {
      this._lastCountdown = secondsLeft;
      this.onCountdown?.(secondsLeft);
    }

    if (remaining <= 0) {
      this.advancePhase();
    }

    this.onTick?.(this.state);
  }

  private advancePhase(): void {
    this._lastCountdown = -1;
    this._phaseIndex++;

    if (this._phaseIndex >= this.phases.length) {
      // End of one cycle
      if (this.totalCycles > 0 && this._cycle >= this.totalCycles) {
        this.complete();
        return;
      }
      this._cycle++;
      this._phaseIndex = 0;
    }

    this._elapsed = 0;
    this.phaseStartTimestamp = performance.now();
    this.onPhaseChange?.(this.phases[this._phaseIndex], this._phaseIndex, this._cycle);
  }

  private complete(): void {
    this._running = false;
    this._completed = true;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.onComplete?.();
  }
}
