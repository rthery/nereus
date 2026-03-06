import type { TableRound, Difficulty, CO2Preset, O2Preset } from '../types.js';

/**
 * CO2 Table (Table A — Pelizzari/AIDA method).
 *
 * Constant hold, rest decrements by 10 s each round and lands exactly on
 * holdTime at round 8 — so the session always ends "rest = hold".
 *   startRest = holdTime + (rounds − 1) × decrement
 *   minRest   = holdTime  (rest never drops below hold duration)
 *
 * Difficulty only changes holdFactor (how much of PB you hold):
 *   easy   → 40 %   hard → 60 %   (normal = 50 %, the Pelizzari base)
 */
const CO2_PRESETS: Record<Difficulty, CO2Preset> = {
  easy:   { holdFactor: 0.4, decrement: 10 },
  normal: { holdFactor: 0.5, decrement: 10 },
  hard:   { holdFactor: 0.6, decrement: 10 },
};

/**
 * O2 Table (Table B — Pelizzari/AIDA method).
 *
 * Hold starts at startFactor × PB and increases by `increment` each round;
 * rest is constant. maxFactor caps the final hold for safety.
 *
 * For a 4:30 PB, normal produces:
 *   hold 2:15 → 3:25, rest 2:45  (Pelizzari's exact Table B parameters)
 */
const O2_PRESETS: Record<Difficulty, O2Preset> = {
  easy:   { startFactor: 0.4, increment: 10, rest: 180, maxFactor: 0.75 },
  normal: { startFactor: 0.5, increment: 10, rest: 165, maxFactor: 0.80 },
  hard:   { startFactor: 0.5, increment: 15, rest: 120, maxFactor: 0.85 },
};

const ROUNDS = 8;
/** Absolute minimum hold regardless of PB (safety floor). */
const MIN_HOLD = 30;

export function generateCO2Table(
  personalBest: number,
  difficulty: Difficulty = 'normal',
  rounds: number = ROUNDS,
): TableRound[] {
  const preset = CO2_PRESETS[difficulty];
  const holdTime = Math.round(personalBest * preset.holdFactor);
  const { decrement } = preset;
  // Rest starts high and lands on holdTime at the last round:
  //   startRest = holdTime + (rounds − 1) × decrement
  // minRest = holdTime ensures we never dip below hold duration.
  const minRest = holdTime;
  const startRest = holdTime + (rounds - 1) * decrement;

  const table: TableRound[] = [];
  for (let i = 0; i < rounds; i++) {
    table.push({
      rest: Math.max(startRest - i * decrement, minRest),
      hold: holdTime,
    });
  }
  return table;
}

export function generateO2Table(
  personalBest: number,
  difficulty: Difficulty = 'normal',
  rounds: number = ROUNDS,
): TableRound[] {
  const preset = O2_PRESETS[difficulty];
  const startHold = Math.max(
    Math.round(personalBest * preset.startFactor),
    MIN_HOLD,
  );
  const { increment, rest } = preset;
  // Cap the maximum hold at maxFactor × PB for safety.
  const maxHold = Math.min(
    startHold + (rounds - 1) * increment,
    Math.round(personalBest * preset.maxFactor),
  );

  const table: TableRound[] = [];
  for (let i = 0; i < rounds; i++) {
    table.push({
      rest,
      hold: Math.min(startHold + i * increment, maxHold),
    });
  }
  return table;
}

export function totalDuration(table: TableRound[]): number {
  return table.reduce((sum, r) => sum + r.rest + r.hold, 0);
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function parseTime(str: string): number {
  const parts = str.split(':');
  if (parts.length !== 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

export { CO2_PRESETS, O2_PRESETS, ROUNDS };
