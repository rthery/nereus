import { describe, it, expect } from 'vitest';
import {
  generateCO2Table,
  generateO2Table,
  totalDuration,
  formatTime,
  parseTime,
  ROUNDS,
} from '../services/tables.js';

describe('CO2 Table Generation', () => {
  it('generates 8 rounds by default', () => {
    const table = generateCO2Table(180);
    expect(table).toHaveLength(ROUNDS);
  });

  it('generates custom round count', () => {
    expect(generateCO2Table(180, 'normal', 4)).toHaveLength(4);
    expect(generateCO2Table(180, 'normal', 6)).toHaveLength(6);
    expect(generateCO2Table(180, 'normal', 12)).toHaveLength(12);
  });

  it('holds are constant across all rounds', () => {
    const table = generateCO2Table(180);
    const holdTime = table[0].hold;
    for (const round of table) {
      expect(round.hold).toBe(holdTime);
    }
  });

  it('hold time is 50% of PB for normal difficulty', () => {
    const table = generateCO2Table(180, 'normal');
    expect(table[0].hold).toBe(90); // 180 * 0.5
  });

  it('hold time is 40% of PB for easy difficulty', () => {
    const table = generateCO2Table(180, 'easy');
    expect(table[0].hold).toBe(72); // 180 * 0.4
  });

  it('hold time is 60% of PB for hard difficulty', () => {
    const table = generateCO2Table(180, 'hard');
    expect(table[0].hold).toBe(108); // 180 * 0.6
  });

  it('rest decreases by 15s each round', () => {
    const table = generateCO2Table(300, 'normal');
    for (let i = 1; i < table.length; i++) {
      const diff = table[i - 1].rest - table[i].rest;
      // diff should be 15 unless we hit the floor
      if (table[i].rest > 60) {
        expect(diff).toBe(15);
      }
    }
  });

  it('rest never goes below minRest (60s for normal)', () => {
    const table = generateCO2Table(120, 'normal');
    for (const round of table) {
      expect(round.rest).toBeGreaterThanOrEqual(60);
    }
  });

  it('rest never goes below 90s for easy', () => {
    const table = generateCO2Table(120, 'easy');
    for (const round of table) {
      expect(round.rest).toBeGreaterThanOrEqual(90);
    }
  });

  it('rest never goes below 15s for hard', () => {
    const table = generateCO2Table(120, 'hard');
    for (const round of table) {
      expect(round.rest).toBeGreaterThanOrEqual(15);
    }
  });

  it('first rest is the longest', () => {
    const table = generateCO2Table(240);
    for (let i = 1; i < table.length; i++) {
      expect(table[0].rest).toBeGreaterThanOrEqual(table[i].rest);
    }
  });

  it('handles very short PB (60s)', () => {
    const table = generateCO2Table(60);
    expect(table).toHaveLength(8);
    expect(table[0].hold).toBe(30);
    for (const round of table) {
      expect(round.rest).toBeGreaterThanOrEqual(60);
      expect(round.hold).toBeGreaterThan(0);
    }
  });

  it('handles long PB (360s / 6 minutes)', () => {
    const table = generateCO2Table(360);
    expect(table).toHaveLength(8);
    expect(table[0].hold).toBe(180);
  });
});

describe('O2 Table Generation', () => {
  it('generates 8 rounds by default', () => {
    const table = generateO2Table(180);
    expect(table).toHaveLength(ROUNDS);
  });

  it('generates custom round count', () => {
    expect(generateO2Table(180, 'normal', 4)).toHaveLength(4);
    expect(generateO2Table(180, 'normal', 6)).toHaveLength(6);
    expect(generateO2Table(180, 'normal', 12)).toHaveLength(12);
  });

  it('rest is constant across all rounds', () => {
    const table = generateO2Table(180);
    for (const round of table) {
      expect(round.rest).toBe(120); // normal: 120s
    }
  });

  it('rest is 150s for easy difficulty', () => {
    const table = generateO2Table(180, 'easy');
    for (const round of table) {
      expect(round.rest).toBe(150);
    }
  });

  it('rest is 90s for hard difficulty', () => {
    const table = generateO2Table(180, 'hard');
    for (const round of table) {
      expect(round.rest).toBe(90);
    }
  });

  it('hold increases across rounds', () => {
    const table = generateO2Table(240);
    for (let i = 1; i < table.length; i++) {
      expect(table[i].hold).toBeGreaterThanOrEqual(table[i - 1].hold);
    }
  });

  it('max hold never exceeds 80% of PB for normal', () => {
    const pb = 180;
    const table = generateO2Table(pb, 'normal');
    const maxAllowed = Math.round(pb * 0.8);
    for (const round of table) {
      expect(round.hold).toBeLessThanOrEqual(maxAllowed);
    }
  });

  it('max hold never exceeds 65% of PB for easy', () => {
    const pb = 240;
    const table = generateO2Table(pb, 'easy');
    const maxAllowed = Math.round(pb * 0.65);
    for (const round of table) {
      expect(round.hold).toBeLessThanOrEqual(maxAllowed);
    }
  });

  it('max hold never exceeds 85% of PB for hard', () => {
    const pb = 240;
    const table = generateO2Table(pb, 'hard');
    const maxAllowed = Math.round(pb * 0.85);
    for (const round of table) {
      expect(round.hold).toBeLessThanOrEqual(maxAllowed);
    }
  });

  it('hold increments are 15 seconds', () => {
    const table = generateO2Table(300);
    for (let i = 1; i < table.length; i++) {
      const diff = table[i].hold - table[i - 1].hold;
      // diff should be 15 or 0 (if capped at max)
      expect(diff).toBeLessThanOrEqual(15);
      expect(diff).toBeGreaterThanOrEqual(0);
    }
  });

  it('minimum hold is 30s', () => {
    const table = generateO2Table(60, 'normal');
    for (const round of table) {
      expect(round.hold).toBeGreaterThanOrEqual(30);
    }
  });

  it('handles very short PB (60s)', () => {
    const table = generateO2Table(60);
    expect(table).toHaveLength(8);
    for (const round of table) {
      expect(round.hold).toBeGreaterThanOrEqual(30);
      expect(round.hold).toBeLessThanOrEqual(48); // 60 * 0.8
    }
  });
});

describe('totalDuration', () => {
  it('sums all rest and hold times', () => {
    const table = [
      { rest: 120, hold: 60 },
      { rest: 105, hold: 60 },
    ];
    expect(totalDuration(table)).toBe(345);
  });

  it('returns 0 for empty table', () => {
    expect(totalDuration([])).toBe(0);
  });
});

describe('formatTime', () => {
  it('formats seconds to m:ss', () => {
    expect(formatTime(90)).toBe('1:30');
    expect(formatTime(60)).toBe('1:00');
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(125)).toBe('2:05');
    expect(formatTime(300)).toBe('5:00');
  });
});

describe('parseTime', () => {
  it('parses m:ss to seconds', () => {
    expect(parseTime('1:30')).toBe(90);
    expect(parseTime('2:00')).toBe(120);
    expect(parseTime('0:45')).toBe(45);
  });

  it('returns 0 for invalid input', () => {
    expect(parseTime('')).toBe(0);
    expect(parseTime('abc')).toBe(0);
  });
});
