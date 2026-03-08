import type { BreathingPhase, BreathingPreset, BuiltInBreathingPresetId, BreathingSessionConfig } from '../types.js';

export const BREATHING_PRESETS: BreathingPreset[] = [
  {
    id: 'coherence',
    name: 'Coherent Breathing',
    tip: 'Best general daily regulation',
    phases: [
      { label: 'inhale', duration: 5 },
      { label: 'exhale', duration: 5 },
    ],
    defaultCycles: 30,
    defaultMinutes: 5,
  },
  {
    id: 'box',
    name: 'Box Breathing',
    tip: 'Best for focus',
    phases: [
      { label: 'inhale', duration: 4 },
      { label: 'hold-in', duration: 4 },
      { label: 'exhale', duration: 4 },
      { label: 'hold-out', duration: 4 },
    ],
    defaultCycles: 20,
    defaultMinutes: 5,
  },
  {
    id: '4-7-8',
    name: '4-7-8 Breath',
    tip: 'Best for sleep/downshifting',
    phases: [
      { label: 'inhale', duration: 4 },
      { label: 'hold-in', duration: 7 },
      { label: 'exhale', duration: 8 },
    ],
    defaultCycles: 8,
    defaultMinutes: 5,
  },
  {
    id: 'apnea-prep',
    name: 'Freediving Prep',
    tip: 'Longer exhales to settle before apnea',
    phases: [
      { label: 'inhale', duration: 4 },
      { label: 'exhale', duration: 8 },
    ],
    defaultCycles: 12,
    defaultMinutes: 5,
  },
  {
    id: 'custom',
    name: 'Custom',
    phases: [
      { label: 'inhale', duration: 4 },
      { label: 'hold-in', duration: 0 },
      { label: 'exhale', duration: 4 },
      { label: 'hold-out', duration: 0 },
    ],
    defaultCycles: 15,
    defaultMinutes: 5,
  },
];

export function getPresetById(id: string): BreathingPreset | undefined {
  return BREATHING_PRESETS.find((p) => p.id === id);
}

export function isBuiltInBreathingPresetId(id: string): id is BuiltInBreathingPresetId {
  return BREATHING_PRESETS.some((preset) => preset.id === id);
}

/** Sum of all active (duration > 0) phase durations in one cycle. */
export function cycleDuration(preset: BreathingPreset): number {
  return preset.phases.reduce((s, p) => s + p.duration, 0);
}

/** Total session duration in seconds given a config. */
export function sessionDuration(config: BreathingSessionConfig): number {
  if (config.durationMode === 'minutes') return config.totalMinutes * 60;
  return cycleDuration(config.preset) * config.totalCycles;
}

/** Active phases only (duration > 0). */
export function activePhases(preset: BreathingPreset): BreathingPhase[] {
  return preset.phases.filter((p) => p.duration > 0);
}
