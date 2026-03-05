import { msg } from '@lit/localize';
import { formatTime } from './tables.js';
import type { DisciplineKey } from '../types.js';

export const ALL_DISCIPLINES: DisciplineKey[] = [
  'STA',
  'DYN',
  'DYNB',
  'DNF',
  '8x50m',
  '4x50m',
  '2x50m',
];

const DURATION_DISCIPLINES = new Set<DisciplineKey>(['STA', '8x50m', '4x50m', '2x50m']);

export function isDurationDiscipline(key: DisciplineKey): boolean {
  return DURATION_DISCIPLINES.has(key);
}

export function formatDisciplineValue(key: DisciplineKey, value: number): string {
  if (isDurationDiscipline(key)) return formatTime(value);
  return `${value} m`;
}

export function getDisciplineUnit(key: DisciplineKey): string {
  return isDurationDiscipline(key) ? msg('mm:ss') : msg('meters');
}

export function getDisciplineLabel(key: DisciplineKey): string {
  const labels: Record<DisciplineKey, string> = {
    STA: `${msg('Static Apnea')} (STA)`,
    DYN: `${msg('Dynamic Apnea with Monofin')} (DYN)`,
    DYNB: `${msg('Dynamic Apnea with Bifins')} (DYNB)`,
    DNF: `${msg('Dynamic Apnea without Fins')} (DNF)`,
    '8x50m': `8×50m ${msg('Speed Apnea')} (8x50m)`,
    '4x50m': `4×50m ${msg('Speed Apnea')} (4x50m)`,
    '2x50m': `2×50m ${msg('Speed Apnea')} (2x50m)`,
  };
  return labels[key];
}

export function getDisciplineShortLabel(key: DisciplineKey): string {
  const labels: Record<DisciplineKey, string> = {
    STA: msg('Static Apnea'),
    DYN: msg('Dynamic Monofin'),
    DYNB: msg('Dynamic Bifins'),
    DNF: msg('Dynamic No Fins'),
    '8x50m': '8×50m',
    '4x50m': '4×50m',
    '2x50m': '2×50m',
  };
  return labels[key];
}
