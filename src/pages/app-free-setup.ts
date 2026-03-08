import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import { getFreePresets, saveFreePreset, deleteFreePreset, getSettings, saveSettings } from '../services/db.js';
import { navigate } from '../navigation.js';
import {
  iconArrowDown,
  iconArrowUp,
  iconPlus,
  iconEdit,
  iconShare2,
  iconTrash,
  iconX,
  iconCheckCircle,
  symbolBreathe,
  symbolInhale,
  symbolHoldIn,
  symbolExhale,
  symbolHoldOut,
  symbolActivity,
} from '../components/icons.js';
import { formatTime } from '../services/tables.js';
import { buildFreeShareUrl, buildImportedFreePreset, takePendingSharedTraining } from '../services/training-share.js';
import type { FreePhase, FreePhaseType, FreePreset } from '../types.js';
import '../components/share-dialog.js';

function phaseTypeLabel(type: FreePhaseType): string {
  switch (type) {
    case 'breathing':   return 'B';
    case 'inhale':      return 'In';
    case 'apnea-full':  return 'AF';
    case 'exhale':      return 'Ex';
    case 'apnea-empty': return 'AE';
    case 'activity':    return 'Act';
  }
}

function phaseTypeIcon(type: FreePhaseType) {
  switch (type) {
    case 'breathing':   return symbolBreathe;
    case 'inhale':      return symbolInhale;
    case 'apnea-full':  return symbolHoldIn;
    case 'exhale':      return symbolExhale;
    case 'apnea-empty': return symbolHoldOut;
    case 'activity':    return symbolActivity;
  }
}


/** Parse "M:SS" or plain seconds string → seconds. Returns 0 on invalid input. */
function parseDuration(val: string): number {
  const trimmed = val.trim();
  if (trimmed.includes(':')) {
    const [m, s] = trimmed.split(':').map(Number);
    if (!isNaN(m) && !isNaN(s)) return Math.max(0, m * 60 + s);
    return 0;
  }
  const n = parseInt(trimmed, 10);
  return isNaN(n) ? 0 : Math.max(0, n);
}

/** Total duration in seconds for timed phases only. Returns null if any count phases. */
function presetTotalSeconds(preset: FreePreset): number | null {
  let total = 0;
  for (const p of preset.phases) {
    if (p.mode === 'count') return null;
    total += p.duration ?? 0;
  }
  return total * preset.rounds;
}

function defaultPhase(): FreePhase {
  return { type: 'breathing', mode: 'duration', duration: 30, label: '' };
}

function formatFreeCardDuration(seconds: number): string {
  return seconds <= 60 ? `${seconds}s` : formatTime(seconds);
}

@localized()
@customElement('app-free-setup')
export class AppFreeSetup extends LitElement {
  @property({ type: Boolean }) embedded = false;

  @state() private _presets: FreePreset[] = [];
  @state() private _selectedId: string | null = null;
  @state() private _editing = false;
  @state() private _editId: string | null = null; // null = new preset
  @state() private _editName = '';
  @state() private _editPhases: FreePhase[] = [defaultPhase()];
  @state() private _editRounds = 1;
  @state() private _shareDialogOpen = false;
  @state() private _shareUrl = '';
  @state() private _sharePresetCard: any = null;
  @state() private _importedPresetName: string | null = null;

  static styles = [
    sharedStyles,
    css`
      .page {
        padding: var(--spacing-lg);
        max-width: 600px;
        margin: 0 auto;
        padding-bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0) + 80px);
      }

      :host([embedded]) .page {
        padding-top: 0;
      }

      .page-title {
        font-size: var(--font-xl);
        font-weight: 800;
        margin: 0 0 var(--spacing-lg) 0;
        color: var(--color-activity);
      }

      /* ---- Preset list ---- */
      .preset-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-lg);
      }

      .preset-card {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        cursor: pointer;
        transition: border-color var(--transition-fast), background var(--transition-fast);
        text-align: left;
        width: 100%;
        font-family: inherit;
        color: var(--color-text-primary);
      }

      .preset-card:hover { border-color: var(--color-activity); }

      .preset-card.active {
        border-color: var(--color-activity);
        background: color-mix(in srgb, var(--color-activity) 8%, transparent);
      }

      .preset-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--spacing-xs);
      }

      .preset-name {
        font-size: var(--font-md);
        font-weight: 700;
      }

      .preset-meta {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
      }

      .preset-card-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-md);
        align-items: center;
      }

      .preset-card-actions .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        flex: 0 0 auto;
        min-height: 38px;
        padding: 9px 16px;
        font-size: var(--font-sm);
        white-space: nowrap;
      }

      .preset-card-actions .btn svg {
        width: 14px;
        height: 14px;
      }

      .preset-card-actions .btn-icon-only {
        padding: 9px 11px;
        min-width: 38px;
      }

      .preset-card-actions-main {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-sm);
      }

      .preset-card-actions-delete {
        margin-left: auto;
      }

      .phase-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
        margin-top: var(--spacing-xs);
      }

      .phase-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: var(--radius-full);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .phase-pill svg {
        width: 10px;
        height: 10px;
        flex-shrink: 0;
      }

      .phase-pill-duration {
        text-transform: none;
      }

      .phase-pill.breathing   { background: color-mix(in srgb, var(--color-rest) 20%, transparent); color: var(--color-rest); }
      .phase-pill.inhale      { background: color-mix(in srgb, var(--color-breathe) 20%, transparent); color: var(--color-breathe); }
      .phase-pill.apnea-full  { background: color-mix(in srgb, var(--color-breathe) 20%, transparent); color: var(--color-breathe); }
      .phase-pill.exhale      { background: color-mix(in srgb, var(--color-hold) 20%, transparent); color: var(--color-hold); }
      .phase-pill.apnea-empty { background: color-mix(in srgb, var(--color-hold) 20%, transparent); color: var(--color-hold); }
      .phase-pill.activity    { background: color-mix(in srgb, var(--color-activity) 20%, transparent); color: var(--color-activity); }

      .round-pill-meta {
        display: inline-flex;
        align-items: center;
        font-size: 10px;
        font-weight: 700;
        color: var(--color-text-muted);
        line-height: 1;
        transform: translateY(1px);
      }

      .new-preset-btn {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        width: 100%;
        padding: var(--spacing-md);
        border: 2px dashed var(--color-border);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-text-muted);
        font-size: var(--font-sm);
        font-weight: 600;
        cursor: pointer;
        transition: border-color var(--transition-fast), color var(--transition-fast);
        font-family: inherit;
        justify-content: center;
      }

      .new-preset-btn:hover {
        border-color: var(--color-activity);
        color: var(--color-activity);
      }

      .empty-state {
        text-align: center;
        padding: var(--spacing-2xl) var(--spacing-lg);
        color: var(--color-text-secondary);
        font-size: var(--font-sm);
        line-height: 1.6;
      }

      .import-banner {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--spacing-md);
        background: color-mix(in srgb, var(--color-activity) 12%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-activity) 28%, transparent);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
      }

      .import-banner-title {
        font-size: var(--font-sm);
        font-weight: 700;
        color: var(--color-text-primary);
      }

      .import-banner-copy {
        color: var(--color-text-secondary);
        font-size: var(--font-sm);
        line-height: 1.45;
        margin-top: 4px;
      }

      .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
      }

      /* ---- Editor ---- */
      .editor {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
      }

      .editor-title {
        font-size: var(--font-md);
        font-weight: 700;
        margin-bottom: var(--spacing-md);
        color: var(--color-activity);
      }

      .name-input {
        width: 100%;
        padding: var(--spacing-sm) var(--spacing-md);
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        color: var(--color-text-primary);
        font-size: var(--font-md);
        font-weight: 600;
        font-family: inherit;
        margin-bottom: var(--spacing-md);
      }

      .name-input:focus {
        outline: none;
        border-color: var(--color-activity);
      }

      /* ---- Phase rows ---- */
      .phase-editor-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-md);
      }

      .phase-row {
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: var(--spacing-sm) var(--spacing-md);
        overflow: hidden;
      }

      .phase-row-top {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-sm);
      }

      .phase-num {
        font-size: var(--font-xs);
        font-weight: 700;
        color: var(--color-text-muted);
        width: 16px;
        flex-shrink: 0;
        text-align: center;
      }

      .phase-label-input {
        flex: 1;
        min-width: 0;
        padding: var(--spacing-xs) var(--spacing-sm);
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        color: var(--color-text-primary);
        font-size: var(--font-sm);
        font-weight: 600;
        font-family: inherit;
      }

      .phase-label-input:focus {
        outline: none;
        border-color: var(--color-accent);
      }

      .phase-delete-btn {
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        border-radius: var(--radius-sm);
        font-family: inherit;
        flex-shrink: 0;
        transition: color var(--transition-fast);
      }

      .phase-delete-btn:hover { color: var(--color-danger); }
      .phase-delete-btn svg { width: 14px; height: 14px; }

      .phase-row-bottom {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: var(--spacing-xs);
      }

      .phase-row-types {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }

      .phase-row-value {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        flex-wrap: nowrap;
        min-width: 0;
      }

      .phase-row-value-spacer {
        flex: 1;
      }

      /* Type selector */
      .type-selector {
        display: flex;
        gap: 3px;
        flex-shrink: 0;
      }

      .type-btn {
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-full);
        border: 1px solid transparent;
        cursor: pointer;
        font-family: inherit;
        transition: all var(--transition-fast);
        opacity: 0.45;
        flex-shrink: 0;
      }

      .type-btn svg { pointer-events: none; }

      .type-btn.breathing   { background: color-mix(in srgb, var(--color-rest) 15%, transparent); color: var(--color-rest); border-color: var(--color-rest); }
      .type-btn.inhale      { background: color-mix(in srgb, var(--color-breathe) 15%, transparent); color: var(--color-breathe); border-color: var(--color-breathe); }
      .type-btn.apnea-full  { background: color-mix(in srgb, var(--color-breathe) 15%, transparent); color: var(--color-breathe); border-color: var(--color-breathe); }
      .type-btn.exhale      { background: color-mix(in srgb, var(--color-hold) 15%, transparent); color: var(--color-hold); border-color: var(--color-hold); }
      .type-btn.apnea-empty { background: color-mix(in srgb, var(--color-hold) 15%, transparent); color: var(--color-hold); border-color: var(--color-hold); }
      .type-btn.activity    { background: color-mix(in srgb, var(--color-activity) 15%, transparent); color: var(--color-activity); border-color: var(--color-activity); }

      .type-btn.active { opacity: 1; }

      /* Mode toggle */
      .mode-toggle {
        display: flex;
        gap: 2px;
        flex-shrink: 0;
      }

      .mode-btn {
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: var(--radius-full);
        border: 1px solid var(--color-border);
        background: transparent;
        color: var(--color-text-muted);
        cursor: pointer;
        font-family: inherit;
        transition: all var(--transition-fast);
      }

      .mode-btn.active {
        background: var(--color-accent);
        color: #fff;
        border-color: var(--color-accent);
      }

      /* Compact stepper for phase duration/count editing. Mirrors breathing custom phase editor. */
      .value-stepper {
        display: flex;
        align-items: stretch;
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        overflow: hidden;
      }

      .value-stepper-btn {
        width: 36px;
        border: none;
        background: transparent;
        color: var(--color-text-primary);
        font-size: 18px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: inherit;
        padding: var(--spacing-xs) 0;
        -webkit-tap-highlight-color: transparent;
        transition: background var(--transition-fast);
      }

      .value-stepper-btn:active { background: var(--color-border); }
      .value-stepper-btn:disabled { opacity: 0.25; cursor: default; }

      .value-stepper-input {
        width: 34px;
        border: none;
        outline: none;
        background: transparent;
        color: var(--color-text-primary);
        font-size: var(--font-sm);
        font-weight: 700;
        text-align: center;
        font-family: inherit;
        font-variant-numeric: tabular-nums;
        padding: var(--spacing-xs) 0;
        -moz-appearance: textfield;
      }

      .value-stepper-input::-webkit-outer-spin-button,
      .value-stepper-input::-webkit-inner-spin-button { -webkit-appearance: none; }

      .value-stepper-unit {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        flex-shrink: 0;
      }

      /* Phase reorder controls */
      .phase-reorder-controls {
        display: flex;
        gap: var(--spacing-xs);
        flex-shrink: 0;
      }

      .phase-reorder-btn {
        width: 36px;
        height: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        color: var(--color-text-secondary);
        cursor: pointer;
        border-radius: var(--radius-full);
        font-family: inherit;
        transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
      }

      .phase-reorder-btn svg {
        width: 18px;
        height: 18px;
      }

      .phase-reorder-btn:hover {
        color: var(--color-text-primary);
        border-color: var(--color-accent);
      }

      .phase-reorder-btn:disabled {
        opacity: 0.25;
        cursor: default;
      }

      .add-phase-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-xs);
        width: 100%;
        padding: var(--spacing-sm);
        border: 1px dashed var(--color-border);
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-muted);
        font-size: var(--font-sm);
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: border-color var(--transition-fast), color var(--transition-fast);
      }

      .add-phase-btn:hover {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .add-phase-btn svg { width: 14px; height: 14px; }

      /* Rounds stepper in editor */
      .rounds-row {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
        margin-top: var(--spacing-md);
      }

      .rounds-label {
        font-size: var(--font-sm);
        font-weight: 600;
        color: var(--color-text-secondary);
        flex: 1;
      }

      .stepper {
        display: flex;
        align-items: stretch;
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        overflow: hidden;
      }

      .stepper-btn {
        flex-shrink: 0;
        width: 40px;
        border: none;
        background: transparent;
        color: var(--color-text-primary);
        font-size: 20px;
        font-weight: 300;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background var(--transition-fast);
        font-family: inherit;
        padding: var(--spacing-xs) 0;
        -webkit-tap-highlight-color: transparent;
      }

      .stepper-btn:active { background: var(--color-border); }
      .stepper-btn:disabled { opacity: 0.25; cursor: default; }

      .stepper-center {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-xs) var(--spacing-sm);
        min-width: 60px;
        gap: 1px;
      }

      .stepper-input {
        background: transparent;
        border: none;
        outline: none;
        font-family: inherit;
        font-size: var(--font-md);
        font-weight: 700;
        color: var(--color-text-primary);
        text-align: center;
        width: 100%;
        padding: 0;
        -moz-appearance: textfield;
      }

      .stepper-input::-webkit-outer-spin-button,
      .stepper-input::-webkit-inner-spin-button { -webkit-appearance: none; }

      .stepper-unit {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
      }

      /* Total duration hint */
      .total-hint {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        text-align: right;
        margin-top: var(--spacing-xs);
      }

      /* Action bar */
      .action-bar {
        position: fixed;
        bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0));
        left: 0;
        right: 0;
        padding: var(--spacing-md) var(--spacing-lg);
        background: var(--color-bg-secondary);
        border-top: 1px solid var(--color-border);
        display: flex;
        gap: var(--spacing-sm);
        justify-content: center;
        z-index: 50;
      }

      .action-bar .btn { flex: 1; max-width: 300px; }

      @media (min-width: 769px) {
        .action-bar { bottom: 0; left: 80px; }
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this._initialize();
  }

  private async _initialize(): Promise<void> {
    await this._loadPresets();
    await this._applySharedTrainingImport();
  }

  private _resolveSelectedId(presets: FreePreset[], preferredId: string | null): string | null {
    if (presets.length === 0) return null;
    if (preferredId && presets.some((preset) => preset.id === preferredId)) return preferredId;
    return presets[0]?.id ?? null;
  }

  private _persistSelectedPreset(id: string | null): void {
    void saveSettings({ freeLastPresetId: id ?? undefined });
  }

  private async _loadPresets(preferredId: string | null = this._selectedId): Promise<void> {
    const [presets, settings] = await Promise.all([getFreePresets(), getSettings()]);
    this._presets = presets;

    const nextSelectedId = this._resolveSelectedId(presets, preferredId ?? settings.freeLastPresetId ?? null);
    this._selectedId = nextSelectedId;
    this._persistSelectedPreset(nextSelectedId);
  }

  // ---- Preset selection ----

  private _selectPreset(id: string): void {
    if (this._selectedId === id) return;
    this._selectedId = id;
    this._persistSelectedPreset(id);
  }

  private async _deletePreset(id: string): Promise<void> {
    await deleteFreePreset(id);
    const preferredId = this._selectedId === id ? null : this._selectedId;
    await this._loadPresets(preferredId);
  }

  private _startNew(): void {
    this._editId = null;
    this._editName = '';
    this._editPhases = [defaultPhase()];
    this._editRounds = 1;
    this._editing = true;
  }

  private _openEdit(preset: FreePreset): void {
    this._editId = preset.id;
    this._editName = preset.name;
    this._editPhases = preset.phases.map((p) => ({ ...p }));
    this._editRounds = preset.rounds;
    this._editing = true;
  }

  private _cancelEdit(): void {
    this._editing = false;
  }

  private async _savePreset(): Promise<void> {
    const name = this._editName.trim() || msg('Untitled', { id: 'free-untitled' });
    const phases = this._editPhases.filter((p) => p.label.trim() !== '' || this._editPhases.length === 1);
    if (phases.length === 0) return;

    const preset: FreePreset = {
      id: this._editId ?? crypto.randomUUID(),
      name,
      phases,
      rounds: this._editRounds,
    };

    await saveFreePreset(preset);
    this._editing = false;
    await this._loadPresets(preset.id);
  }

  private _startSession(): void {
    const preset = this._presets.find((p) => p.id === this._selectedId);
    if (!preset) return;
    navigate('/free-timer', { preset });
  }

  private async _applySharedTrainingImport(): Promise<void> {
    const shared = takePendingSharedTraining('free');
    if (!shared || shared.kind !== 'free') return;

    const preset = buildImportedFreePreset(shared);
    await saveFreePreset(preset);
    this._importedPresetName = preset.name;
    await this._loadPresets(preset.id);
  }

  private _shareTargetPreset(): FreePreset | null {
    if (this._editing) {
      return {
        id: this._editId ?? 'draft',
        name: this._editName.trim() || msg('Untitled', { id: 'free-untitled' }),
        phases: this._editPhases.map((phase) => ({ ...phase })),
        rounds: this._editRounds,
      };
    }
    return this._presets.find((preset) => preset.id === this._selectedId) ?? null;
  }

  private async _openShareDialog(): Promise<void> {
    const preset = this._shareTargetPreset();
    if (!preset) return;
    this._shareDialogOpen = true;
    this._shareUrl = '';
    this._sharePresetCard = this._renderPresetCardForShare(preset);
    try {
      this._shareUrl = await buildFreeShareUrl(preset);
    } catch (err) {
      console.error('Failed to generate share URL:', err);
    }
  }

  // ---- Phase editor helpers ----

  private _addPhase(): void {
    const last = this._editPhases[this._editPhases.length - 1];
    const newPhase = defaultPhase();
    if (last) {
      newPhase.type = last.type;
      newPhase.mode = last.mode;
      newPhase.duration = last.duration;
      newPhase.count = last.mode === 'count' ? (last.count ?? 1) : newPhase.count;
    }
    this._editPhases = [...this._editPhases, newPhase];
  }

  private _removePhase(idx: number): void {
    if (this._editPhases.length <= 1) return;
    this._editPhases = this._editPhases.filter((_, i) => i !== idx);
  }

  private _movePhase(idx: number, dir: -1 | 1): void {
    const to = idx + dir;
    if (to < 0 || to >= this._editPhases.length) return;
    const arr = [...this._editPhases];
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    this._editPhases = arr;
  }

  private _updatePhase(idx: number, patch: Partial<FreePhase>): void {
    this._editPhases = this._editPhases.map((p, i) => i === idx ? { ...p, ...patch } : p);
  }

  private _updatePhaseDuration(idx: number, val: string): void {
    const seconds = Math.min(parseDuration(val), 5999);
    this._updatePhase(idx, { duration: seconds });
  }

  private _stepPhaseDuration(idx: number, delta: number): void {
    const current = this._editPhases[idx]?.duration ?? 0;
    const next = Math.max(0, Math.min(5999, current + delta));
    this._updatePhase(idx, { duration: next });
  }

  private _updatePhaseCount(idx: number, val: string): void {
    const n = Math.max(1, Math.min(99, parseInt(val, 10) || 1));
    this._updatePhase(idx, { count: n });
  }

  private _stepPhaseCount(idx: number, delta: number): void {
    const current = this._editPhases[idx]?.count ?? 1;
    const next = Math.max(1, Math.min(99, current + delta));
    this._updatePhase(idx, { count: next });
  }

  // ---- Render helpers ----

  private _renderPhasePills(preset: FreePreset) {
    const shown = preset.phases.slice(0, 6);
    const more = preset.phases.length - shown.length;
    return html`
      <div class="phase-pills">
        ${shown.map((p) => html`
          <span class="phase-pill ${p.type}">
            ${phaseTypeIcon(p.type)}
            ${p.label || phaseTypeLabel(p.type)}
            ${p.mode === 'duration'
              ? html` <span class="phase-pill-duration">${formatFreeCardDuration(p.duration ?? 0)}</span>`
              : ` ×${p.count ?? 1}`}
          </span>
        `)}
        ${more > 0 ? html`<span class="round-pill-meta">+${more}</span>` : ''}
        ${preset.rounds > 1 ? html`<span class="round-pill-meta">×${preset.rounds}</span>` : ''}
      </div>
    `;
  }

  private _renderPresetMeta(preset: FreePreset): string {
    let roundSeconds = 0;
    for (const phase of preset.phases) {
      if (phase.mode === 'duration') roundSeconds += phase.duration ?? 0;
    }
    if (roundSeconds <= 0) return msg('Varies / round', { id: 'free-meta-varies-round' });
    return msg(str`~${formatFreeCardDuration(roundSeconds)} / round`, { id: 'free-meta-round-duration' });
  }

  private _renderPresetCardForShare(preset: FreePreset) {
    return html`
      <div class="preset-card active">
        <div class="preset-card-header">
          <span class="preset-name">${preset.name}</span>
          <span class="preset-meta">${this._renderPresetMeta(preset)}</span>
        </div>
        ${this._renderPhasePills(preset)}
      </div>
    `;
  }

  private _renderPresetList() {
    if (this._presets.length === 0) {
      return html`
        <div class="empty-state">
          ${msg('No presets yet.', { id: 'free-no-presets' })}<br>
          ${msg('Create your first free training preset.', { id: 'free-empty-hint' })}
        </div>
      `;
    }

    return html`
      <div class="preset-list">
        ${this._presets.map((preset) => html`
          <button
            class="preset-card ${this._selectedId === preset.id ? 'active' : ''}"
            @click=${() => this._selectPreset(preset.id)}
          >
            <div class="preset-card-header">
              <span class="preset-name">${preset.name}</span>
              <span class="preset-meta">${this._renderPresetMeta(preset)}</span>
            </div>
            ${this._renderPhasePills(preset)}
            ${this._selectedId === preset.id ? html`
              <div class="preset-card-actions">
                <div class="preset-card-actions-main">
                  <button class="btn btn-secondary" @click=${(e: Event) => { e.stopPropagation(); void this._openShareDialog(); }}>
                    ${iconShare2} ${msg('Share')}
                  </button>
                  <button class="btn btn-secondary" @click=${(e: Event) => { e.stopPropagation(); this._openEdit(preset); }}>
                    ${iconEdit} ${msg('Edit', { id: 'free-edit' })}
                  </button>
                </div>
                <button
                  class="btn btn-danger btn-icon-only preset-card-actions-delete"
                  title=${msg('Delete')}
                  aria-label=${msg('Delete')}
                  @click=${(e: Event) => { e.stopPropagation(); void this._deletePreset(preset.id); }}
                >
                  ${iconTrash}
                </button>
              </div>
            ` : ''}
          </button>
        `)}
      </div>
    `;
  }

  private _renderPhaseRow(phase: FreePhase, idx: number) {
    const types: FreePhaseType[] = ['breathing', 'inhale', 'apnea-full', 'exhale', 'apnea-empty', 'activity'];

    const durationVal = phase.mode === 'duration' ? String(phase.duration ?? 0) : '';
    const countVal = phase.mode === 'count' ? String(phase.count ?? 1) : '';

    return html`
      <div class="phase-row">
        <div class="phase-row-top">
          <span class="phase-num">${idx + 1}</span>
          <input
            class="phase-label-input"
            type="text"
            maxlength="16"
            placeholder=${msg('Phase name', { id: 'free-label-placeholder' })}
            .value=${phase.label}
            @input=${(e: Event) => this._updatePhase(idx, { label: (e.target as HTMLInputElement).value })}
          />
          <button class="phase-delete-btn" ?disabled=${this._editPhases.length <= 1} @click=${() => this._removePhase(idx)}>
            ${iconX}
          </button>
        </div>
        <div class="phase-row-bottom">
          <div class="phase-row-types">
            <div class="type-selector">
              ${types.map((t) => html`
                <button
                  class="type-btn ${t} ${phase.type === t ? 'active' : ''}"
                  @click=${() => this._updatePhase(idx, { type: t })}
                >${phaseTypeIcon(t)}</button>
              `)}
            </div>
          </div>
          <div class="phase-row-value">
            <div class="mode-toggle">
              <button
                class="mode-btn ${phase.mode === 'duration' ? 'active' : ''}"
                @click=${() => this._updatePhase(idx, { mode: 'duration', duration: phase.duration ?? 30 })}
              >⏱</button>
              <button
                class="mode-btn ${phase.mode === 'count' ? 'active' : ''}"
                @click=${() => this._updatePhase(idx, { mode: 'count', count: phase.count ?? 1 })}
              >#</button>
            </div>
            ${phase.mode === 'duration' ? html`
              <div class="value-stepper">
                <button
                  class="value-stepper-btn"
                  ?disabled=${(phase.duration ?? 0) <= 0}
                  @click=${() => this._stepPhaseDuration(idx, -1)}
                >−</button>
                <input
                  class="value-stepper-input"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  max="5999"
                  .value=${durationVal}
                  @change=${(e: Event) => this._updatePhaseDuration(idx, (e.target as HTMLInputElement).value)}
                />
                <button
                  class="value-stepper-btn"
                  ?disabled=${(phase.duration ?? 0) >= 5999}
                  @click=${() => this._stepPhaseDuration(idx, 1)}
                >+</button>
              </div>
              <span class="value-stepper-unit">s</span>
            ` : html`
              <div class="value-stepper">
                <button
                  class="value-stepper-btn"
                  ?disabled=${(phase.count ?? 1) <= 1}
                  @click=${() => this._stepPhaseCount(idx, -1)}
                >−</button>
                <input
                  class="value-stepper-input"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="99"
                  .value=${countVal}
                  @change=${(e: Event) => this._updatePhaseCount(idx, (e.target as HTMLInputElement).value)}
                />
                <button
                  class="value-stepper-btn"
                  ?disabled=${(phase.count ?? 1) >= 99}
                  @click=${() => this._stepPhaseCount(idx, 1)}
                >+</button>
              </div>
              <span class="value-stepper-unit">x</span>
            `}
            <span class="phase-row-value-spacer"></span>
            <div class="phase-reorder-controls">
              <button
                class="phase-reorder-btn"
                aria-label="Move phase up"
                ?disabled=${idx === 0}
                @click=${() => this._movePhase(idx, -1)}
              >
                ${iconArrowUp}
              </button>
              <button
                class="phase-reorder-btn"
                aria-label="Move phase down"
                ?disabled=${idx === this._editPhases.length - 1}
                @click=${() => this._movePhase(idx, 1)}
              >
                ${iconArrowDown}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private _renderEditor() {
    const totalSec = presetTotalSeconds({ id: '', name: '', phases: this._editPhases, rounds: this._editRounds });
    const totalHint = totalSec !== null
      ? msg(str`~${formatTime(totalSec)} total`, { id: 'free-total-hint' })
      : msg('Duration varies (count phases)', { id: 'free-total-hint-count' });

    return html`
      <div class="editor">
        <div class="editor-title">
          ${this._editId ? msg('Edit preset', { id: 'free-edit-title' }) : msg('New preset', { id: 'free-new-title' })}
        </div>

        <input
          class="name-input"
          type="text"
          maxlength="16"
          placeholder=${msg('Preset name', { id: 'free-name-placeholder' })}
          .value=${this._editName}
          @input=${(e: Event) => { this._editName = (e.target as HTMLInputElement).value; }}
        />

        <div class="section-label" style="margin-bottom:var(--spacing-sm)">
          ${msg('Phases', { id: 'free-phases-label' })}
        </div>

        <div class="phase-editor-list">
          ${this._editPhases.map((phase, idx) => this._renderPhaseRow(phase, idx))}
        </div>

        <button class="add-phase-btn" @click=${this._addPhase}>
          ${iconPlus} ${msg('Add phase', { id: 'free-add-phase' })}
        </button>

        <div class="rounds-row">
          <span class="rounds-label">${msg('Rounds', { id: 'free-rounds' })}</span>
          <div class="stepper">
            <button class="stepper-btn" ?disabled=${this._editRounds <= 1} @click=${() => { this._editRounds = Math.max(1, this._editRounds - 1); }}>−</button>
            <div class="stepper-center">
              <input
                class="stepper-input"
                type="number"
                inputmode="numeric"
                min="1"
                max="20"
                .value=${String(this._editRounds)}
                @change=${(e: Event) => { this._editRounds = Math.max(1, Math.min(20, parseInt((e.target as HTMLInputElement).value, 10) || 1)); }}
              />
              <span class="stepper-unit">${msg('rounds', { id: 'free-rounds-unit' })}</span>
            </div>
            <button class="stepper-btn" ?disabled=${this._editRounds >= 20} @click=${() => { this._editRounds = Math.min(20, this._editRounds + 1); }}>+</button>
          </div>
        </div>

        <div class="total-hint">${totalHint}</div>
      </div>
    `;
  }

  private _renderImportBanner() {
    if (!this._importedPresetName) return '';
    return html`
      <div class="import-banner">
        <div>
          <div class="import-banner-title">${msg('Imported from link')}</div>
          <div class="import-banner-copy">
            ${msg('Saved locally as')}: <strong>${this._importedPresetName}</strong>
          </div>
        </div>
        <button
          class="icon-btn"
          @click=${() => { this._importedPresetName = null; }}
          aria-label=${msg('Dismiss')}
        >
          ${iconX}
        </button>
      </div>
    `;
  }

  render() {
    return html`
      <div class="page">
        ${!this.embedded ? html`<h1 class="page-title">${msg('Free Training', { id: 'free-title' })}</h1>` : ''}
        ${this._renderImportBanner()}

        ${this._editing ? this._renderEditor() : this._renderPresetList()}

        ${!this._editing ? html`
          <button class="new-preset-btn" @click=${this._startNew}>
            ${iconPlus} ${msg('New preset', { id: 'free-new-btn' })}
          </button>
        ` : ''}
      </div>

      <div class="action-bar">
        ${this._editing ? html`
          <button class="btn btn-secondary" @click=${this._cancelEdit}>
            ${msg('Cancel', { id: 'free-cancel' })}
          </button>
          <button
            class="btn btn-primary"
            ?disabled=${this._editPhases.length === 0}
            @click=${() => void this._savePreset()}
          >
            ${iconCheckCircle} ${msg('Save', { id: 'free-save' })}
          </button>
        ` : html`
          <button
            class="btn btn-primary btn-large"
            ?disabled=${!this._selectedId}
            @click=${this._startSession}
          >
            ${msg('Start', { id: 'free-start' })}
          </button>
        `}
      </div>

      <share-dialog
        .open=${this._shareDialogOpen}
        .title=${msg('Share free training')}
        .url=${this._shareUrl}
        .presetCard=${this._sharePresetCard}
        @close-request=${() => { this._shareDialogOpen = false; this._shareUrl = ''; this._sharePresetCard = null; }}
      ></share-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-free-setup': AppFreeSetup;
  }
}
