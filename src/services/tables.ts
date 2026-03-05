import type { TableRound, Difficulty, DifficultyPreset } from '../types.js';

const CO2_PRESETS: Record<Difficulty, DifficultyPreset> = {
  easy: { holdFactor: 0.4, decrement: 15, minRest: 90 },
  normal: { holdFactor: 0.5, decrement: 15, minRest: 60 },
  hard: { holdFactor: 0.6, decrement: 15, minRest: 15 },
};

const O2_PRESETS: Record<Difficulty, DifficultyPreset> = {
  easy: { holdFactor: 0.65, increment: 15, rest: 150, minHold: 30 },
  normal: { holdFactor: 0.8, increment: 15, rest: 120, minHold: 30 },
  hard: { holdFactor: 0.85, increment: 15, rest: 90, minHold: 30 },
};

const ROUNDS = 8;

export function generateCO2Table(
  personalBest: number,
  difficulty: Difficulty = 'normal',
  rounds: number = ROUNDS,
): TableRound[] {
  const preset = CO2_PRESETS[difficulty];
  const holdTime = Math.round(personalBest * preset.holdFactor);
  const decrement = preset.decrement!;
  const minRest = preset.minRest!;
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
  const maxHold = Math.round(personalBest * preset.holdFactor);
  const increment = preset.increment!;
  const rest = preset.rest!;
  const minHold = preset.minHold!;
  const startHold = Math.max(maxHold - (rounds - 1) * increment, minHold);

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
