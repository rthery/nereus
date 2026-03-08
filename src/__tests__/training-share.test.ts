import { afterEach, describe, expect, it } from 'vitest';
import {
  buildBreathingShareUrl,
  buildFreeShareUrl,
  initializeSharedTrainingFromUrl,
  takePendingSharedTraining,
} from '../services/training-share.js';
import type { BreathingSessionConfig, FreePreset } from '../types.js';

const BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodePayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bits = 0;
  let value = 0;
  let output = '0';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function sharedUrl(payload: unknown): string {
  return `${window.location.origin}/?D=${encodePayload(payload)}`;
}

describe('training-share', () => {
  afterEach(() => {
    takePendingSharedTraining();
    window.history.replaceState(null, '', '/#/');
  });

  it('round-trips breathing session configs through the URL payload', async () => {
    const config: BreathingSessionConfig = {
      preset: {
        id: 'custom-breathing',
        name: 'CO2 Warmup',
        tip: 'Slow down before apnea',
        phases: [
          { label: 'inhale', duration: 4 },
          { label: 'hold-in', duration: 1 },
          { label: 'exhale', duration: 8 },
          { label: 'hold-out', duration: 2 },
        ],
        defaultCycles: 12,
        defaultMinutes: 6,
      },
      durationMode: 'minutes',
      totalCycles: 12,
      totalMinutes: 6,
    };

    await initializeSharedTrainingFromUrl(await buildBreathingShareUrl(config));
    const shared = takePendingSharedTraining('breathing');

    expect(shared?.kind).toBe('breathing');
    if (!shared || shared.kind !== 'breathing') throw new Error('Missing breathing share payload');
    expect(shared.preset.name).toBe('CO2 Warmup');
    expect(shared.preset.tip).toBe('Slow down before apnea');
    expect(shared.preset.phases.map((phase) => phase.duration)).toEqual([4, 1, 8, 2]);
    expect(shared.durationMode).toBe('minutes');
    expect(shared.totalCycles).toBe(12);
    expect(shared.totalMinutes).toBe(6);
  });

  it('preserves built-in breathing preset ids for localized imports', async () => {
    const config: BreathingSessionConfig = {
      preset: {
        id: 'coherence',
        name: 'Coherent Breathing',
        phases: [
          { label: 'inhale', duration: 5 },
          { label: 'exhale', duration: 5 },
        ],
        defaultCycles: 30,
        defaultMinutes: 5,
      },
      durationMode: 'cycles',
      totalCycles: 18,
      totalMinutes: 5,
    };

    await initializeSharedTrainingFromUrl(await buildBreathingShareUrl(config));
    const shared = takePendingSharedTraining('breathing');

    expect(shared?.kind).toBe('breathing');
    if (!shared || shared.kind !== 'breathing') throw new Error('Missing built-in breathing share payload');
    expect(shared.preset.builtinId).toBe('coherence');
    expect(shared.preset.phases.map((phase) => phase.duration)).toEqual([5, 0, 5, 0]);
    expect(shared.totalCycles).toBe(18);
  });

  it('round-trips free presets through the URL payload', async () => {
    const preset: FreePreset = {
      id: 'free-1',
      name: 'Pool Walk',
      rounds: 3,
      phases: [
        { type: 'breathing', mode: 'duration', duration: 45, label: 'Settle' },
        { type: 'activity', mode: 'count', count: 4, label: 'Laps' },
        { type: 'apnea-empty', mode: 'duration', duration: 90, label: 'AE' },
      ],
    };

    await initializeSharedTrainingFromUrl(await buildFreeShareUrl(preset));
    const shared = takePendingSharedTraining('free');

    expect(shared?.kind).toBe('free');
    if (!shared || shared.kind !== 'free') throw new Error('Missing free share payload');
    expect(shared.preset.name).toBe('Pool Walk');
    expect(shared.preset.rounds).toBe(3);
    expect(shared.preset.phases).toEqual([
      { type: 'breathing', mode: 'duration', duration: 45, label: 'Settle' },
      { type: 'activity', mode: 'count', count: 4, label: 'Laps' },
      { type: 'apnea-empty', mode: 'duration', duration: 90, label: 'AE' },
    ]);
  });

  it('sanitizes malformed incoming payload values', async () => {
    await initializeSharedTrainingFromUrl(sharedUrl({
      t: 'f',
      n: '   Imported      Free Preset That Is Much Too Long   ',
      r: 99,
      p: [
        ['a', 'c', 500, '  Sprint   '],
        ['b', 'd', -20, ''],
        ['x', 'd', 20, 'bad'],
      ],
    }));

    const shared = takePendingSharedTraining('free');
    expect(shared?.kind).toBe('free');
    if (!shared || shared.kind !== 'free') throw new Error('Missing sanitized free share payload');
    expect(shared.preset.name).toBe('Imported Free Pr');
    expect(shared.preset.rounds).toBe(20);
    expect(shared.preset.phases).toEqual([
      { type: 'activity', mode: 'count', count: 99, label: 'Sprint' },
      { type: 'breathing', mode: 'duration', duration: 0, label: '' },
    ]);
  });

  it('ignores unsupported payload markers', async () => {
    await initializeSharedTrainingFromUrl(`${window.location.origin}/?D=9ABC`);
    expect(takePendingSharedTraining()).toBeNull();
  });
});
