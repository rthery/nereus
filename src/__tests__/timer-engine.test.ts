import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimerEngine } from '../services/timer-engine.js';
import type { TableRound } from '../types.js';

const simpleTable: TableRound[] = [
  { rest: 2, hold: 1 },
  { rest: 1.5, hold: 1 },
];

describe('TimerEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with breathe phase at round 0', () => {
    const engine = new TimerEngine({ table: simpleTable });
    const state = engine.state;
    expect(state.phase).toBe('breathe');
    expect(state.round).toBe(0);
    expect(state.totalRounds).toBe(2);
    expect(state.running).toBe(false);
    expect(state.completed).toBe(false);
  });

  it('starts running when start() is called', () => {
    const engine = new TimerEngine({ table: simpleTable });
    engine.start();
    expect(engine.state.running).toBe(true);
    engine.destroy();
  });

  it('does not start if already running', () => {
    const onPhaseChange = vi.fn();
    const engine = new TimerEngine({ table: simpleTable, onPhaseChange });
    engine.start();
    engine.start(); // should be no-op
    expect(onPhaseChange).toHaveBeenCalledTimes(1);
    engine.destroy();
  });

  it('fires onPhaseChange with breathe on start', () => {
    const onPhaseChange = vi.fn();
    const engine = new TimerEngine({ table: simpleTable, onPhaseChange });
    engine.start();
    expect(onPhaseChange).toHaveBeenCalledWith('breathe', 0);
    engine.destroy();
  });

  it('transitions from breathe to hold after rest duration', () => {
    const onPhaseChange = vi.fn();
    const engine = new TimerEngine({ table: simpleTable, onPhaseChange });
    engine.start();

    // Advance past the 2 second rest period
    vi.advanceTimersByTime(2100);

    expect(onPhaseChange).toHaveBeenCalledWith('hold', 0);
    engine.destroy();
  });

  it('transitions from hold to breathe (next round) after hold duration', () => {
    const onPhaseChange = vi.fn();
    const engine = new TimerEngine({ table: simpleTable, onPhaseChange });
    engine.start();

    // Rest (2s) + hold (1s) = 3s
    vi.advanceTimersByTime(3200);

    expect(onPhaseChange).toHaveBeenCalledWith('breathe', 1);
    engine.destroy();
  });

  it('completes after all rounds', () => {
    const onComplete = vi.fn();
    const engine = new TimerEngine({ table: simpleTable, onComplete });
    engine.start();

    // Round 0: rest(2) + hold(1) + Round 1: rest(1.5) + hold(1) = 5.5s
    vi.advanceTimersByTime(6000);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(engine.state.completed).toBe(true);
    expect(engine.state.running).toBe(false);
    engine.destroy();
  });

  it('fires onCountdown for last 3 seconds', () => {
    const onCountdown = vi.fn();
    const engine = new TimerEngine({
      table: [{ rest: 5, hold: 1 }],
      onCountdown,
    });
    engine.start();

    // Advance through the full 5s rest in small steps to trigger all countdowns
    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(100);
    }

    const countdownCalls = onCountdown.mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(countdownCalls).toContain(3);
    expect(countdownCalls).toContain(2);
    expect(countdownCalls).toContain(1);
    engine.destroy();
  });

  it('stop() pauses the timer', () => {
    const engine = new TimerEngine({ table: simpleTable });
    engine.start();
    vi.advanceTimersByTime(500);
    engine.stop();

    expect(engine.state.running).toBe(false);
    expect(engine.state.completed).toBe(false);
    engine.destroy();
  });

  it('abort() stops and marks completed', () => {
    const engine = new TimerEngine({ table: simpleTable });
    engine.start();
    engine.abort();

    expect(engine.state.running).toBe(false);
    expect(engine.state.completed).toBe(true);
    engine.destroy();
  });

  it('markContraction records during hold phase', () => {
    const engine = new TimerEngine({ table: simpleTable });
    engine.start();

    // Advance past breathe (2s) into hold
    vi.advanceTimersByTime(2200);
    engine.markContraction();

    const results = engine.results;
    expect(results[0].contractions.length).toBe(1);
    engine.destroy();
  });

  it('markContraction does nothing during breathe phase', () => {
    const engine = new TimerEngine({ table: simpleTable });
    engine.start();

    // Still in breathe phase
    vi.advanceTimersByTime(500);
    engine.markContraction();

    expect(engine.results[0].contractions.length).toBe(0);
    engine.destroy();
  });

  it('results track completion per round', () => {
    const onComplete = vi.fn();
    const engine = new TimerEngine({ table: simpleTable, onComplete });
    engine.start();

    vi.advanceTimersByTime(6000);

    const results = engine.results;
    expect(results[0].completed).toBe(true);
    expect(results[1].completed).toBe(true);
    engine.destroy();
  });

  it('handles single-round table', () => {
    const onComplete = vi.fn();
    const engine = new TimerEngine({
      table: [{ rest: 1, hold: 1 }],
      onComplete,
    });
    engine.start();

    vi.advanceTimersByTime(2200);

    expect(onComplete).toHaveBeenCalledTimes(1);
    engine.destroy();
  });

  it('phaseDuration reflects current phase', () => {
    const engine = new TimerEngine({ table: simpleTable });
    engine.start();

    expect(engine.state.phaseDuration).toBe(2); // rest for round 0

    vi.advanceTimersByTime(2100);
    expect(engine.state.phaseDuration).toBe(1); // hold for round 0

    engine.destroy();
  });
});
