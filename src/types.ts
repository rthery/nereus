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
  breathingCustomPhases?: BreathingPhase[];
  breathingDurationMode?: 'cycles' | 'minutes';
  breathingCycles?: number;
  breathingMinutes?: number;
}

export const DEFAULT_SETTINGS: Settings = {
  personalBest: 0,
  theme: 'system',
  soundEnabled: true,
  vibrationEnabled: true,
  co2Difficulty: 'normal',
  o2Difficulty: 'normal',
  roundCount: 8,
  customRounds: 8,
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

/** CO2 table preset (Table A — constant hold, decreasing rest). */
export interface CO2Preset {
  /** Hold duration = round(PB × holdFactor). */
  holdFactor: number;
  /** Rest decrements by this many seconds each round. */
  decrement: number;
}

/** O2 table preset (Table B — increasing hold, constant rest). */
export interface O2Preset {
  /** First hold = round(PB × startFactor). */
  startFactor: number;
  /** Hold grows by this many seconds each round. */
  increment: number;
  /** Fixed rest between holds (seconds). */
  rest: number;
  /** Safety ceiling: maxHold ≤ round(PB × maxFactor). */
  maxFactor: number;
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

// ---- Breathing Exercises ----

export interface BreathingPhase {
  label: 'inhale' | 'hold-in' | 'exhale' | 'hold-out';
  duration: number; // seconds, 0 = disabled
}

export type BreathingPresetId =
  | 'coherence'
  | 'box'
  | '4-7-8'
  | 'apnea-prep'
  | 'custom';

export interface BreathingPreset {
  id: BreathingPresetId;
  name: string;
  tip?: string;
  phases: BreathingPhase[];
  defaultCycles: number;
  defaultMinutes: number;
}

export interface BreathingSessionConfig {
  preset: BreathingPreset;
  durationMode: 'cycles' | 'minutes';
  totalCycles: number;
  totalMinutes: number;
}

export interface BreathingTimerState {
  phaseIndex: number;
  phase: BreathingPhase;
  cycle: number;
  totalCycles: number;
  elapsed: number;
  remaining: number;
  phaseDuration: number;
  running: boolean;
  completed: boolean;
}

export interface BreathingSession {
  id: string;
  date: number;
  presetId: BreathingPresetId;
  presetName: string;
  completedCycles: number;
  totalDuration: number; // seconds elapsed
  completed: boolean;
}
