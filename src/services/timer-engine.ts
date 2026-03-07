import type { TableRound, Phase, TimerState, RoundResult } from '../types.js';

export type TimerCallback = (state: TimerState) => void;
export type PhaseChangeCallback = (phase: Phase, round: number) => void;
export type CountdownCallback = (secondsLeft: number) => void;
export type CompleteCallback = (results: RoundResult[]) => void;

export interface TimerEngineOptions {
  table: TableRound[];
  onTick?: TimerCallback;
  onPhaseChange?: PhaseChangeCallback;
  onCountdown?: CountdownCallback;
  onComplete?: CompleteCallback;
}

export class TimerEngine {
  private table: TableRound[];
  private onTick?: TimerCallback;
  private onPhaseChange?: PhaseChangeCallback;
  private onCountdown?: CountdownCallback;
  private onComplete?: CompleteCallback;

  private _phase: Phase = 'breathe';
  private _round = 0;
  private _elapsed = 0;
  private _running = false;
  private _completed = false;
  private _results: RoundResult[] = [];
  private _lastCountdown = -1;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private startTimestamp = 0;
  private phaseStartTimestamp = 0;

  constructor(options: TimerEngineOptions) {
    this.table = options.table;
    this.onTick = options.onTick;
    this.onPhaseChange = options.onPhaseChange;
    this.onCountdown = options.onCountdown;
    this.onComplete = options.onComplete;

    this._results = this.table.map((r, i) => ({
      round: i,
      plannedRest: r.rest,
      plannedHold: r.hold,
      actualHold: 0,
      contractions: [],
      completed: false,
    }));
  }

  get state(): TimerState {
    const currentRound = this.table[this._round];
    const phaseDuration =
      this._phase === 'breathe' ? currentRound.rest : currentRound.hold;
    // Compute live elapsed when running so rAF callers get 60fps precision
    const elapsed = this._running
      ? Math.min((performance.now() - this.phaseStartTimestamp) / 1000, phaseDuration)
      : this._elapsed;
    const remaining = Math.max(phaseDuration - elapsed, 0);

    return {
      phase: this._phase,
      round: this._round,
      totalRounds: this.table.length,
      elapsed,
      remaining: Math.ceil(remaining),
      phaseDuration,
      running: this._running,
      completed: this._completed,
    };
  }

  get results(): RoundResult[] {
    return this._results;
  }

  start(): void {
    if (this._running || this._completed) return;
    this._running = true;
    this.startTimestamp = performance.now();
    this.phaseStartTimestamp = this.startTimestamp;

    this.onPhaseChange?.(this._phase, this._round);

    this.intervalId = setInterval(() => this.tick(), 100);
  }

  stop(): void {
    if (!this._running) return;
    this._running = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this._phase === 'hold') {
      this._results[this._round].actualHold = this._elapsed;
    }
  }

  resume(): void {
    if (this._running || this._completed) return;
    this._running = true;
    this.phaseStartTimestamp = performance.now() - this._elapsed * 1000;
    this.intervalId = setInterval(() => this.tick(), 100);
  }

  markContraction(): void {
    if (this._phase !== 'hold' || !this._running) return;
    this._results[this._round].contractions.push(
      Math.round(this._elapsed * 10) / 10,
    );
  }

  abort(): void {
    this.stop();
    this._completed = true;
  }

  private tick(): void {
    const now = performance.now();
    this._elapsed = (now - this.phaseStartTimestamp) / 1000;

    const currentRound = this.table[this._round];
    const phaseDuration =
      this._phase === 'breathe' ? currentRound.rest : currentRound.hold;
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

    if (this._phase === 'breathe') {
      this._phase = 'hold';
    } else {
      // End of hold
      this._results[this._round].actualHold = this.table[this._round].hold;
      this._results[this._round].completed = true;

      if (this._round >= this.table.length - 1) {
        this.complete();
        return;
      }

      this._round++;
      this._phase = 'breathe';
    }

    this._elapsed = 0;
    this.phaseStartTimestamp = performance.now();
    this.onPhaseChange?.(this._phase, this._round);
  }

  private complete(): void {
    this._running = false;
    this._completed = true;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.onComplete?.(this._results);
  }

  destroy(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
