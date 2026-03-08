import { getPresetById, isBuiltInBreathingPresetId } from './breathing-presets.js';
import { navigate } from '../navigation.js';
import type {
  BreathingPhase,
  BreathingPreset,
  BreathingSessionConfig,
  BuiltInBreathingPresetId,
  FreePhase,
  FreePhaseType,
  FreePreset,
} from '../types.js';

const BREATHING_PHASE_ORDER: BreathingPhase['label'][] = ['inhale', 'hold-in', 'exhale', 'hold-out'];
const BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const RAW_MARKER = '0';
const DEFLATE_MARKER = '1';
const DATA_PARAM = 'D';
const FREE_TYPE_CODES: Record<FreePhaseType, string> = {
  breathing: 'b',
  inhale: 'i',
  'apnea-full': 'f',
  exhale: 'e',
  'apnea-empty': 'o',
  activity: 'a',
};
const FREE_TYPES_BY_CODE = Object.fromEntries(
  Object.entries(FREE_TYPE_CODES).map(([key, value]) => [value, key]),
) as Record<string, FreePhaseType>;

interface SharedBreathingPayloadV1 {
  t: 'b';
  b?: BuiltInBreathingPresetId;
  n?: string;
  x?: string;
  p: [number, number, number, number];
  dm: 'c' | 'm';
  c: number;
  m: number;
}

interface SharedFreePayloadV1 {
  t: 'f';
  n?: string;
  r: number;
  p: Array<[string, 'd' | 'c', number, string?]>;
}

type SharedPayloadV1 = SharedBreathingPayloadV1 | SharedFreePayloadV1;

export interface SharedBreathingTraining {
  kind: 'breathing';
  route: '/training';
  preset: {
    builtinId?: BuiltInBreathingPresetId;
    name?: string;
    tip?: string;
    phases: BreathingPhase[];
  };
  durationMode: 'cycles' | 'minutes';
  totalCycles: number;
  totalMinutes: number;
}

export interface SharedFreeTraining {
  kind: 'free';
  route: '/training';
  preset: {
    name: string;
    phases: FreePhase[];
    rounds: number;
  };
}

export type SharedTraining = SharedBreathingTraining | SharedFreeTraining;

let pendingSharedTraining: SharedTraining | null = null;

export function normalizeBreathingPhases(phases: BreathingPhase[]): BreathingPhase[] {
  return BREATHING_PHASE_ORDER.map((label) => {
    const match = phases.find((phase) => phase.label === label);
    return { label, duration: clampInteger(match?.duration ?? 0, 0, 99) };
  });
}

export async function buildBreathingShareUrl(config: BreathingSessionConfig): Promise<string> {
  const preset = config.preset;
  const normalizedPhases = normalizeBreathingPhases(preset.phases);
  const payload: SharedBreathingPayloadV1 = {
    t: 'b',
    p: normalizedPhases.map((phase) => phase.duration) as [number, number, number, number],
    dm: config.durationMode === 'cycles' ? 'c' : 'm',
    c: clampInteger(config.totalCycles, 1, 99),
    m: clampInteger(config.totalMinutes, 1, 60),
  };

  if (isBuiltInBreathingPresetId(preset.id)) {
    payload.b = preset.id;
    if (preset.tip) payload.x = sanitizeText(preset.tip, 120);
  } else {
    payload.n = sanitizeText(preset.name, 40) || 'Imported breathing';
    if (preset.tip) payload.x = sanitizeText(preset.tip, 120);
  }

  return buildShareUrl(payload);
}

export async function buildFreeShareUrl(preset: FreePreset): Promise<string> {
  const payload: SharedFreePayloadV1 = {
    t: 'f',
    n: sanitizeText(preset.name, 16) || 'Imported free training',
    r: clampInteger(preset.rounds, 1, 20),
    p: preset.phases.map((phase) => {
      const value = phase.mode === 'count'
        ? clampInteger(phase.count ?? 1, 1, 99)
        : clampInteger(phase.duration ?? 0, 0, 5999);
      const label = sanitizeText(phase.label, 16);
      return [FREE_TYPE_CODES[phase.type], phase.mode === 'count' ? 'c' : 'd', value, label || undefined];
    }),
  };

  return buildShareUrl(payload);
}

export function peekPendingSharedTraining(): SharedTraining | null {
  return pendingSharedTraining;
}

export function takePendingSharedTraining(kind?: SharedTraining['kind']): SharedTraining | null {
  if (!pendingSharedTraining) return null;
  if (kind && pendingSharedTraining.kind !== kind) return null;
  const next = pendingSharedTraining;
  pendingSharedTraining = null;
  return next;
}

export async function initializeSharedTrainingFromUrl(locationHref = window.location.href): Promise<void> {
  const url = new URL(locationHref);
  const data = url.searchParams.get(DATA_PARAM) ?? url.searchParams.get(DATA_PARAM.toLowerCase());

  if (!data) return;

  try {
    pendingSharedTraining = await decodeSharedTraining(data);
    if (pendingSharedTraining) {
      url.search = '';
      url.hash = pendingSharedTraining.route;
      window.history.replaceState(window.history.state, '', url.toString());
      navigate(pendingSharedTraining.route);
    }
  } catch {
    pendingSharedTraining = null;
  } finally {
    if (!pendingSharedTraining) {
      url.search = '';
      window.history.replaceState(window.history.state, '', url.toString());
    }
  }
}

async function buildShareUrl(payload: SharedPayloadV1): Promise<string> {
  const encoded = await encodePayload(payload);
  const origin = `${window.location.protocol.toUpperCase()}//${window.location.host.toUpperCase()}`;
  const pathname = window.location.pathname || '/';
  return `${origin}${pathname}?${DATA_PARAM}=${encoded}`;
}

async function encodePayload(payload: SharedPayloadV1): Promise<string> {
  const rawBytes = new TextEncoder().encode(JSON.stringify(payload));
  const rawEncoded = `${RAW_MARKER}${encodeBase32(rawBytes)}`;
  const compressedBytes = await compressBytes(rawBytes);

  if (!compressedBytes || compressedBytes.length >= rawBytes.length) {
    return rawEncoded;
  }

  const compressedEncoded = `${DEFLATE_MARKER}${encodeBase32(compressedBytes)}`;
  return compressedEncoded.length < rawEncoded.length ? compressedEncoded : rawEncoded;
}

async function decodeSharedTraining(encoded: string): Promise<SharedTraining> {
  const marker = encoded[0];
  const body = encoded.slice(1);
  const bytes = decodeBase32(body);

  let payloadBytes: Uint8Array;
  if (marker === DEFLATE_MARKER) {
    payloadBytes = await decompressBytes(bytes);
  } else if (marker === RAW_MARKER) {
    payloadBytes = bytes;
  } else {
    throw new RangeError('Unsupported shared training payload');
  }

  const raw = JSON.parse(new TextDecoder().decode(payloadBytes)) as SharedPayloadV1;
  if (raw.t === 'b') return decodeBreathingPayload(raw);
  if (raw.t === 'f') return decodeFreePayload(raw);
  throw new RangeError('Unsupported shared training payload');
}

function decodeBreathingPayload(payload: SharedBreathingPayloadV1): SharedBreathingTraining {
  const phases = Array.isArray(payload.p) ? payload.p : [4, 0, 4, 0];
  const normalizedPhases = normalizeBreathingPhases(BREATHING_PHASE_ORDER.map((label, index) => ({
    label,
    duration: clampInteger(phases[index] ?? 0, 0, 99),
  })));

  const builtinId = payload.b && isBuiltInBreathingPresetId(payload.b) ? payload.b : undefined;
  const name = sanitizeText(payload.n, 40) || undefined;
  const tip = sanitizeText(payload.x, 120) || undefined;
  const activeCount = normalizedPhases.filter((phase) => phase.duration > 0).length;
  if (activeCount === 0) normalizedPhases[0].duration = 4;

  return {
    kind: 'breathing',
    route: '/training',
    preset: {
      builtinId,
      name,
      tip,
      phases: normalizedPhases,
    },
    durationMode: payload.dm === 'm' ? 'minutes' : 'cycles',
    totalCycles: clampInteger(payload.c, 1, 99),
    totalMinutes: clampInteger(payload.m, 1, 60),
  };
}

function decodeFreePayload(payload: SharedFreePayloadV1): SharedFreeTraining {
  const phases = Array.isArray(payload.p)
    ? payload.p.reduce<FreePhase[]>((acc, [typeCode, modeCode, value, label]) => {
      const type = FREE_TYPES_BY_CODE[typeCode];
      if (!type) return acc;

      if (modeCode === 'c') {
        acc.push({
          type,
          mode: 'count',
          count: clampInteger(value, 1, 99),
          label: sanitizeText(label, 16),
        });
        return acc;
      }

      acc.push({
        type,
        mode: 'duration',
        duration: clampInteger(value, 0, 5999),
        label: sanitizeText(label, 16),
      });
      return acc;
    }, [])
    : [];

  const safePhases = phases.length > 0
    ? phases
    : [{ type: 'breathing', mode: 'duration', duration: 30, label: '' } satisfies FreePhase];

  return {
    kind: 'free',
    route: '/training',
    preset: {
      name: sanitizeText(payload.n, 16) || 'Imported free training',
      phases: safePhases,
      rounds: clampInteger(payload.r, 1, 20),
    },
  };
}

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

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

function decodeBase32(encoded: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of encoded.toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new RangeError('Invalid Base32 payload');
    value = (value << 5) | index;
    bits += 5;

    while (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Uint8Array.from(bytes);
}

async function compressBytes(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new CompressionStream('deflate');
    const reader = stream.readable.getReader();
    const writer = stream.writable.getWriter();
    
    const writePromise = (async () => {
      await writer.write(bytes.slice());
      await writer.close();
    })();
    
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLength += value.length;
    }
    
    await writePromise;
    
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  } catch {
    return null;
  }
}

async function decompressBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new RangeError('Compressed share payload is not supported in this browser');
  }
  const stream = new DecompressionStream('deflate');
  const reader = stream.readable.getReader();
  const writer = stream.writable.getWriter();
  
  const writePromise = (async () => {
    await writer.write(bytes.slice());
    await writer.close();
  })();
  
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }
  
  await writePromise;
  
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result;
}

export function breathingPresetMatchesBuiltIn(training: SharedBreathingTraining): boolean {
  const builtinId = training.preset.builtinId;
  if (!builtinId) return false;
  const builtin = getPresetById(builtinId);
  if (!builtin) return false;

  const a = normalizeBreathingPhases(training.preset.phases);
  const b = normalizeBreathingPhases(builtin.phases);
  return a.every((phase, index) => phase.duration === b[index]?.duration);
}

function clampInteger(value: unknown, min: number, max: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function buildImportedBreathingPreset(
  training: SharedBreathingTraining,
  fallbackName: string,
): BreathingPreset {
  return {
    id: crypto.randomUUID(),
    name: training.preset.name ?? fallbackName,
    tip: training.preset.tip,
    phases: normalizeBreathingPhases(training.preset.phases),
    defaultCycles: training.totalCycles,
    defaultMinutes: training.totalMinutes,
  };
}

export function buildImportedFreePreset(training: SharedFreeTraining): FreePreset {
  return {
    id: crypto.randomUUID(),
    name: training.preset.name,
    phases: training.preset.phases.map((phase) => ({ ...phase })),
    rounds: training.preset.rounds,
  };
}
