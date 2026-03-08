import type { FreePhase } from '../types.js';

export interface FreeTimerState {
  phaseIndex: number;
  phase: FreePhase;
  round: number;
  totalRounds: number;
  /** Seconds elapsed in current duration phase (0 for count phases). */
  elapsed: number;
  /** Seconds remaining in current duration phase (0 for count phases). */
  remaining: number;
  phaseDuration: number;
  /** Taps completed so far in current count phase. */
  tapCount: number;
  /** Total taps required in current count phase. */
  phaseTotalCount: number;
  running: boolean;
  completed: boolean;
  /** True when session is running but waiting for manual tap (count mode). */
  waitingForTap: boolean;
}

export type FreeTickCallback = (state: FreeTimerState) => void;
export type FreePhaseChangeCallback = (phase: FreePhase, phaseIndex: number, round: number) => void;
export type FreeCountdownCallback = (secondsLeft: number) => void;
export type FreeCompleteCallback = () => void;

export interface FreeEngineOptions {
  phases: FreePhase[];
  totalRounds: number;
  onTick?: FreeTickCallback;
  onPhaseChange?: FreePhaseChangeCallback;
  onCountdown?: FreeCountdownCallback;
  onComplete?: FreeCompleteCallback;
}

export class FreeEngine {
  private readonly phases: FreePhase[];
  private readonly totalRounds: number;
  private readonly onTick?: FreeTickCallback;
  private readonly onPhaseChange?: FreePhaseChangeCallback;
  private readonly onCountdown?: FreeCountdownCallback;
  private readonly onComplete?: FreeCompleteCallback;

  private _phaseIndex = 0;
  private _round = 1;
  private _elapsed = 0;
  private _running = false;
  private _completed = false;
  private _tapCount = 0;
  private _lastCountdown = -1;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private phaseStartTimestamp = 0;

  constructor(options: FreeEngineOptions) {
    this.phases = options.phases;
    this.totalRounds = options.totalRounds;
    this.onTick = options.onTick;
    this.onPhaseChange = options.onPhaseChange;
    this.onCountdown = options.onCountdown;
    this.onComplete = options.onComplete;
  }

  private get _currentPhase(): FreePhase {
    return this.phases[this._phaseIndex] ?? this.phases[0];
  }

  private get _isCountMode(): boolean {
    return this._currentPhase.mode === 'count';
  }

  get state(): FreeTimerState {
    const phase = this._currentPhase;
    const isCount = phase.mode === 'count';

    let elapsed = this._elapsed;
    let remaining = 0;
    const phaseDuration = isCount ? 0 : (phase.duration ?? 0);

    if (!isCount) {
      elapsed = this._running
        ? Math.min((performance.now() - this.phaseStartTimestamp) / 1000, phaseDuration)
        : this._elapsed;
      remaining = Math.max(phaseDuration - elapsed, 0);
    }

    return {
      phaseIndex: this._phaseIndex,
      phase,
      round: this._round,
      totalRounds: this.totalRounds,
      elapsed,
      remaining: isCount ? 0 : Math.ceil(remaining),
      phaseDuration,
      tapCount: this._tapCount,
      phaseTotalCount: isCount ? (phase.count ?? 1) : 0,
      running: this._running,
      completed: this._completed,
      waitingForTap: this._running && isCount,
    };
  }

  start(): void {
    if (this._running || this._completed) return;
    this._running = true;
    this.onPhaseChange?.(this._currentPhase, this._phaseIndex, this._round);
    this._startCurrentPhase();
  }

  stop(): void {
    if (!this._running) return;
    this._running = false;
    if (!this._isCountMode) {
      this._elapsed = (performance.now() - this.phaseStartTimestamp) / 1000;
    }
    this._clearInterval();
  }

  resume(): void {
    if (this._running || this._completed) return;
    this._running = true;
    if (!this._isCountMode) {
      this.phaseStartTimestamp = performance.now() - this._elapsed * 1000;
      this.intervalId = setInterval(() => this._tick(), 100);
    }
    // Count mode: _running = true re-enables tap button, no interval needed
  }

  /** One tap immediately ends the current count-mode phase. */
  advanceManual(): void {
    if (!this._running || !this._isCountMode) return;
    this._advancePhase();
  }

  /** Skip the current phase (dev mode). */
  skipPhase(): void {
    if (this._completed) return;
    if (!this._isCountMode) this._clearInterval();
    this._advancePhase();
  }

  abort(): void {
    this.stop();
    this._completed = true;
  }

  destroy(): void {
    this._clearInterval();
  }

  private _startCurrentPhase(): void {
    if (this._isCountMode) {
      this._tapCount = 0;
      // No interval — waits for manual advance
    } else {
      this._elapsed = 0;
      this.phaseStartTimestamp = performance.now();
      this.intervalId = setInterval(() => this._tick(), 100);
    }
  }

  private _clearInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private _tick(): void {
    const now = performance.now();
    this._elapsed = (now - this.phaseStartTimestamp) / 1000;

    const phase = this._currentPhase;
    const phaseDuration = phase.duration ?? 0;
    const remaining = phaseDuration - this._elapsed;

    const secondsLeft = Math.ceil(remaining);
    if (secondsLeft <= 3 && secondsLeft > 0 && secondsLeft !== this._lastCountdown) {
      this._lastCountdown = secondsLeft;
      this.onCountdown?.(secondsLeft);
    }

    if (remaining <= 0) {
      this._clearInterval();
      this._advancePhase();
      return;
    }

    this.onTick?.(this.state);
  }

  private _advancePhase(): void {
    this._lastCountdown = -1;
    this._phaseIndex++;

    if (this._phaseIndex >= this.phases.length) {
      if (this._round >= this.totalRounds) {
        this._complete();
        return;
      }
      this._round++;
      this._phaseIndex = 0;
    }

    this._elapsed = 0;
    this._tapCount = 0;
    this.onPhaseChange?.(this._currentPhase, this._phaseIndex, this._round);

    if (this._running) {
      this._startCurrentPhase();
    }

    this.onTick?.(this.state);
  }

  private _complete(): void {
    this._running = false;
    this._completed = true;
    this._clearInterval();
    this.onComplete?.();
  }
}
