export type TableType = 'co2' | 'o2';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type ThemePreference = 'system' | 'light' | 'dark';
export type Phase = 'breathe' | 'hold';
export type PBSource = 'test' | 'manual';
export type RoundCount = 4 | 8 | 'custom';
export type LocalePreference = 'en' | 'fr' | 'auto';

export interface TableRound {
  rest: number; // seconds
  hold: number; // seconds
}

export interface RoundResult {
  round: number;
  plannedRest: number;
  plannedHold: number;
  actualHold: number;
  contractions: number[]; // timestamps relative to hold start (seconds)
  completed: boolean;
}

export interface Session {
  id: string;
  type: TableType | 'pb-test';
  date: number;
  completed: boolean;
  rounds: RoundResult[];
  personalBest?: number;
  table?: TableRound[];
}

export interface PBRecord {
  date: number;
  value: number; // seconds
  source: PBSource;
}

export interface Settings {
  personalBest: number;
  theme: ThemePreference;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  co2Difficulty: Difficulty;
  o2Difficulty: Difficulty;
  roundCount: RoundCount;
  customRounds: number;
  locale: LocalePreference;
  safetyAcknowledged: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  personalBest: 0,
  theme: 'system',
  soundEnabled: true,
  vibrationEnabled: true,
  co2Difficulty: 'normal',
  o2Difficulty: 'normal',
  roundCount: 8,
  customRounds: 6,
  locale: 'auto',
  safetyAcknowledged: false,
};

export type DisciplineKey = 'STA' | 'DYN' | 'DYNB' | 'DNF' | '8x50m' | '4x50m' | '2x50m';

export interface DisciplineResult {
  discipline: DisciplineKey;
  value: number; // seconds for STA/8x50m/4x50m/2x50m; meters for DYN/DYNB/DNF
  rank?: number; // optional finish position (1, 2, 3, ...)
}

export interface Competition {
  id: string;
  date: number; // timestamp (ms)
  name: string;
  location?: string; // city, country (optional)
  results: DisciplineResult[];
}

export interface DifficultyPreset {
  holdFactor: number;
  decrement?: number;
  minRest?: number;
  increment?: number;
  rest?: number;
  minHold?: number;
}

export interface TimerState {
  phase: Phase;
  round: number;
  totalRounds: number;
  elapsed: number;
  remaining: number;
  phaseDuration: number;
  running: boolean;
  completed: boolean;
}
