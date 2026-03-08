import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import {
  deleteBreathingPreset,
  getBreathingPresets,
  getSettings,
  saveBreathingPreset,
  saveSettings,
} from '../services/db.js';
import { navigate } from '../navigation.js';
import {
  BREATHING_PRESETS,
  cycleDuration,
  activePhases,
  isBuiltInBreathingPresetId,
} from '../services/breathing-presets.js';
import {
  iconBookmark,
  iconEdit,
  iconX,
  symbolInhale,
  symbolExhale,
  symbolHoldIn,
  symbolHoldOut,
} from '../components/icons.js';
import type { BreathingPhase, BreathingPreset } from '../types.js';

interface CustomDraftSnapshot {
  selectedId: string;
  phases: BreathingPhase[];
  cycles: number;
  minutes: number;
  saveName: string;
  saveDescription: string;
  saveFormOpen: boolean;
}

@localized()
@customElement('app-breathing-setup')
export class AppBreathingSetup extends LitElement {
  /** When true (embedded in training page tabs), hides the page title and removes top padding. */
  @property({ type: Boolean }) embedded = false;

  @state() private _selectedId = 'coherence';
  @state() private _savedPresets: BreathingPreset[] = [];
  @state() private _customPhases: BreathingPhase[] = [
    { label: 'inhale', duration: 4 },
    { label: 'hold-in', duration: 0 },
    { label: 'exhale', duration: 4 },
    { label: 'hold-out', duration: 0 },
  ];
  @state() private _durationMode: 'cycles' | 'minutes' = 'cycles';
  @state() private _cycles = 15;
  @state() private _minutes = 5;
  @state() private _saveName = '';
  @state() private _saveDescription = '';
  @state() private _saveFormOpen = false;
  @state() private _editingSavedPresetId: string | null = null;

  private _editSnapshot: CustomDraftSnapshot | null = null;

  static styles = [
    sharedStyles,
    css`
      .page {
        padding: var(--spacing-lg);
        max-width: 600px;
        margin: 0 auto;
        padding-bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0) + 80px);
      }

      .page-title {
        font-size: var(--font-xl);
        font-weight: 800;
        margin: 0 0 var(--spacing-lg) 0;
        color: var(--color-accent);
      }

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
        color: var(--color-text-primary);
      }

      .preset-card:hover,
      .preset-card:focus-visible {
        border-color: var(--color-accent);
        outline: none;
      }

      .preset-card.active {
        border-color: var(--color-accent);
        background: var(--color-accent-subtle);
      }

      .preset-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-xs);
      }

      .preset-name-row {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        min-width: 0;
      }

      .preset-name {
        font-size: var(--font-md);
        font-weight: 700;
        min-width: 0;
      }

      .preset-duration {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        flex-shrink: 0;
      }

      .saved-indicator {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 7px;
        border-radius: var(--radius-full);
        background: color-mix(in srgb, var(--color-accent) 14%, transparent);
        color: var(--color-accent);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        flex-shrink: 0;
      }

      .saved-indicator svg {
        width: 11px;
        height: 11px;
      }

      .preset-tip {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        margin-top: 4px;
        font-style: italic;
      }

      .phase-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: var(--spacing-xs);
      }

      .phase-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: var(--radius-full);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .phase-pill svg { width: 9px; height: 9px; flex-shrink: 0; }

      .phase-pill-duration { text-transform: none; }

      .phase-pill.inhale {
        background: color-mix(in srgb, var(--color-breathe) 20%, transparent);
        color: var(--color-breathe);
      }

      .phase-pill.hold-in {
        background: color-mix(in srgb, var(--color-breathe) 12%, transparent);
        color: var(--color-breathe);
        opacity: 0.75;
      }

      .phase-pill.exhale {
        background: color-mix(in srgb, var(--color-hold) 20%, transparent);
        color: var(--color-hold);
      }

      .phase-pill.hold-out {
        background: color-mix(in srgb, var(--color-hold) 12%, transparent);
        color: var(--color-hold);
        opacity: 0.75;
      }

      .preset-card-actions {
        display: flex;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-md);
      }

      .preset-card-actions .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        flex: 1;
      }

      .preset-card-actions .btn svg {
        width: 14px;
        height: 14px;
      }

      .custom-phases {
        margin-top: var(--spacing-md);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      }

      .custom-phase-row {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
      }

      .custom-phase-label {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: var(--font-sm);
        font-weight: 600;
        width: 110px;
        flex-shrink: 0;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .custom-phase-label svg { width: 11px; height: 11px; flex-shrink: 0; }

      .custom-phase-label.inhale { color: var(--color-breathe); }
      .custom-phase-label.exhale { color: var(--color-hold); }
      .custom-phase-label.hold-in { color: var(--color-breathe); opacity: 0.7; }
      .custom-phase-label.hold-out { color: var(--color-hold); opacity: 0.7; }

      .custom-phase-unit {
        font-size: var(--font-sm);
        color: var(--color-text-muted);
      }

      .section-label {
        font-size: var(--font-xs);
        font-weight: 600;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: var(--spacing-xs);
      }

      .duration-section {
        margin-bottom: var(--spacing-lg);
      }

      .mode-toggle {
        display: flex;
        gap: var(--spacing-xs);
        background: var(--color-bg-surface);
        border-radius: var(--radius-full);
        padding: 3px;
        border: 1px solid var(--color-border);
        margin-bottom: var(--spacing-md);
      }

      .mode-btn {
        flex: 1;
        padding: var(--spacing-sm) var(--spacing-md);
        border: none;
        border-radius: var(--radius-full);
        background: transparent;
        color: var(--color-text-secondary);
        font-size: var(--font-sm);
        font-weight: 600;
        cursor: pointer;
        transition: all var(--transition-fast);
        font-family: inherit;
      }

      .mode-btn.active {
        background: var(--color-accent);
        color: #fff;
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
        width: 52px;
        border: none;
        background: transparent;
        color: var(--color-text-primary);
        font-size: 22px;
        font-weight: 300;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background var(--transition-fast);
        font-family: inherit;
        padding: var(--spacing-sm) 0;
        -webkit-tap-highlight-color: transparent;
      }

      .stepper-btn:active { background: var(--color-border); }

      .stepper-btn:disabled {
        opacity: 0.25;
        cursor: default;
      }

      .stepper-center {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-sm) 0;
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
        user-select: text;
        -webkit-user-select: text;
      }

      .stepper-input::-webkit-outer-spin-button,
      .stepper-input::-webkit-inner-spin-button { -webkit-appearance: none; }

      .stepper-unit {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        font-weight: 400;
      }

      .stepper-hint {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        text-align: center;
        margin-top: var(--spacing-xs);
      }

      .custom-stepper {
        display: flex;
        align-items: stretch;
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        overflow: hidden;
      }

      .custom-stepper .stepper-btn {
        width: 36px;
        padding: var(--spacing-xs) 0;
        font-size: 18px;
      }

      .custom-stepper .stepper-input {
        width: 40px;
        font-size: var(--font-sm);
        padding: var(--spacing-xs) 0;
      }

      .save-card {
        margin-top: var(--spacing-md);
        padding-top: var(--spacing-md);
        border-top: 1px solid color-mix(in srgb, var(--color-border) 75%, transparent);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      }

      .save-title {
        font-size: var(--font-sm);
        font-weight: 700;
        color: var(--color-text-primary);
      }

      .save-hint {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        line-height: 1.5;
      }

      .save-input,
      .save-textarea {
        width: 100%;
        padding: var(--spacing-sm) var(--spacing-md);
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        color: var(--color-text-primary);
        font-size: var(--font-sm);
        font-family: inherit;
      }

      .save-input {
        font-weight: 600;
      }

      .save-textarea {
        resize: vertical;
        min-height: 72px;
      }

      .save-input:focus,
      .save-textarea:focus {
        outline: none;
        border-color: var(--color-accent);
      }

      .save-actions {
        display: flex;
        gap: var(--spacing-sm);
      }

      .save-actions .btn {
        flex: 1;
      }

      .save-trigger {
        margin-top: var(--spacing-md);
        width: 100%;
      }

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

      .action-bar .btn {
        flex: 1;
        max-width: 300px;
      }

      @media (min-width: 769px) {
        .action-bar {
          bottom: 0;
          left: 80px;
        }
      }

      :host([embedded]) .page {
        padding-top: 0;
      }

      :host([embedded]) .page-title {
        display: none;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this._load();
  }

  private _sortedSavedPresets(presets: BreathingPreset[]): BreathingPreset[] {
    return [...presets].sort((a, b) => a.name.localeCompare(b.name));
  }

  private _allPresets(savedPresets = this._savedPresets): BreathingPreset[] {
    const customPreset = BREATHING_PRESETS.find((preset) => preset.id === 'custom')!;
    return [
      ...BREATHING_PRESETS.filter((preset) => preset.id !== 'custom'),
      ...this._sortedSavedPresets(savedPresets),
      customPreset,
    ];
  }

  private _getPresetById(id: string): BreathingPreset | undefined {
    return this._allPresets().find((preset) => preset.id === id);
  }

  private _resolveSelectedId(savedPresets: BreathingPreset[], preferredId: string | null): string {
    const all = this._allPresets(savedPresets);
    if (preferredId && all.some((preset) => preset.id === preferredId)) return preferredId;
    return 'coherence';
  }

  private _persistSelectedPreset(id: string): void {
    void saveSettings({ breathingLastPresetId: id });
  }

  private async _load(preferredId: string | null = null): Promise<void> {
    const [settings, savedPresets] = await Promise.all([getSettings(), getBreathingPresets()]);

    if (settings.breathingCustomPhases) {
      this._customPhases = settings.breathingCustomPhases;
    }
    if (settings.breathingDurationMode) this._durationMode = settings.breathingDurationMode;
    if (settings.breathingCycles) this._cycles = settings.breathingCycles;
    if (settings.breathingMinutes) this._minutes = settings.breathingMinutes;

    this._savedPresets = this._sortedSavedPresets(savedPresets);
    const nextSelectedId = this._resolveSelectedId(
      this._savedPresets,
      preferredId ?? settings.breathingLastPresetId ?? this._selectedId,
    );
    this._selectedId = nextSelectedId;

    const preset = this._getPresetById(nextSelectedId);
    if (preset && nextSelectedId !== 'custom') {
      this._cycles = preset.defaultCycles;
      this._minutes = preset.defaultMinutes;
      this._saveFormOpen = false;
    }

    this._persistSelectedPreset(nextSelectedId);
  }

  private async _selectPreset(id: string): Promise<void> {
    if (this._editingSavedPresetId && id !== 'custom') {
      await this._cancelEditingSavedPreset(id);
      return;
    }
    if (this._selectedId === id) return;

    this._selectedId = id;
    this._persistSelectedPreset(id);

    const preset = this._getPresetById(id);
    if (preset && id !== 'custom') {
      this._cycles = preset.defaultCycles;
      this._minutes = preset.defaultMinutes;
      this._saveFormOpen = false;
    }
  }

  private _handlePresetKeydown(event: KeyboardEvent, id: string): void {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    void this._selectPreset(id);
  }

  private async _setCustomPhase(index: number, value: string): Promise<void> {
    const n = parseInt(value, 10);
    const duration = isNaN(n) || n < 0 ? 0 : Math.min(n, 99);
    this._customPhases = this._customPhases.map((phase, i) =>
      i === index ? { ...phase, duration } : phase,
    );
    await saveSettings({ breathingCustomPhases: this._customPhases });
  }

  private async _setDurationMode(mode: 'cycles' | 'minutes'): Promise<void> {
    this._durationMode = mode;
    await saveSettings({ breathingDurationMode: mode });
  }

  private async _setCycles(value: string): Promise<void> {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1) return;
    this._cycles = Math.min(n, 99);
    await saveSettings({ breathingCycles: this._cycles });
  }

  private async _setMinutes(value: string): Promise<void> {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1) return;
    this._minutes = Math.min(n, 60);
    await saveSettings({ breathingMinutes: this._minutes });
  }

  private async _stepCycles(delta: number): Promise<void> {
    await this._setCycles(String(this._cycles + delta));
  }

  private async _stepMinutes(delta: number): Promise<void> {
    await this._setMinutes(String(this._minutes + delta));
  }

  private async _stepCustomPhase(idx: number, delta: number): Promise<void> {
    if (idx < 0 || idx >= this._customPhases.length) return;
    const current = this._customPhases[idx].duration;
    await this._setCustomPhase(idx, String(Math.max(0, Math.min(99, current + delta))));
  }

  private async _startEditingSavedPreset(preset: BreathingPreset): Promise<void> {
    this._editSnapshot = {
      selectedId: this._selectedId,
      phases: this._customPhases.map((phase) => ({ ...phase })),
      cycles: this._cycles,
      minutes: this._minutes,
      saveName: this._saveName,
      saveDescription: this._saveDescription,
      saveFormOpen: this._saveFormOpen,
    };
    this._editingSavedPresetId = preset.id;
    this._saveName = preset.name;
    this._saveDescription = preset.tip ?? '';
    this._saveFormOpen = true;
    this._customPhases = preset.phases.map((phase) => ({ ...phase }));
    this._cycles = preset.defaultCycles;
    this._minutes = preset.defaultMinutes;
    this._selectedId = 'custom';
    await saveSettings({
      breathingCustomPhases: this._customPhases,
      breathingCycles: this._cycles,
      breathingMinutes: this._minutes,
      breathingLastPresetId: 'custom',
    });
  }

  private async _cancelEditingSavedPreset(nextSelectedId?: string): Promise<void> {
    const snapshot = this._editSnapshot;
    this._editingSavedPresetId = null;
    this._editSnapshot = null;
    if (!snapshot) return;

    this._customPhases = snapshot.phases.map((phase) => ({ ...phase }));
    this._saveName = snapshot.saveName;
    this._saveDescription = snapshot.saveDescription;
    this._saveFormOpen = snapshot.saveFormOpen;

    const selectedId = nextSelectedId ?? snapshot.selectedId;
    this._selectedId = selectedId;

    await saveSettings({
      breathingCustomPhases: this._customPhases,
      breathingCycles: snapshot.cycles,
      breathingMinutes: snapshot.minutes,
      breathingLastPresetId: selectedId,
    });

    if (selectedId === 'custom') {
      this._cycles = snapshot.cycles;
      this._minutes = snapshot.minutes;
      return;
    }

    const preset = this._getPresetById(selectedId);
    if (preset) {
      this._cycles = preset.defaultCycles;
      this._minutes = preset.defaultMinutes;
    }
  }

  private async _saveCurrentPreset(): Promise<void> {
    const name = this._saveName.trim();
    if (!name) return;

    const preset: BreathingPreset = {
      id: this._editingSavedPresetId ?? crypto.randomUUID(),
      name,
      tip: this._saveDescription.trim() || undefined,
      phases: this._customPhases.map((phase) => ({ ...phase })),
      defaultCycles: this._cycles,
      defaultMinutes: this._minutes,
    };

    await saveBreathingPreset(preset);
    this._editingSavedPresetId = null;
    this._editSnapshot = null;
    this._saveFormOpen = false;
    this._saveName = '';
    this._saveDescription = '';
    await this._load(preset.id);
  }

  private async _deleteSavedPreset(id: string): Promise<void> {
    await deleteBreathingPreset(id);
    const preferredId = this._selectedId === id ? 'custom' : this._selectedId;
    if (this._editingSavedPresetId === id) {
      this._editingSavedPresetId = null;
      this._editSnapshot = null;
      this._saveFormOpen = false;
      this._saveName = '';
      this._saveDescription = '';
    }
    await this._load(preferredId);
  }

  private _openSaveForm(): void {
    this._saveFormOpen = true;
  }

  private _closeSaveForm(): void {
    this._saveFormOpen = false;
    if (this._editingSavedPresetId !== null) return;
    this._saveName = '';
    this._saveDescription = '';
  }

  private _buildEffectivePreset(): BreathingPreset {
    if (this._selectedId === 'custom') {
      return {
        id: 'custom',
        name: 'Custom',
        phases: this._customPhases,
        defaultCycles: this._cycles,
        defaultMinutes: this._minutes,
      };
    }
    return this._getPresetById(this._selectedId) ?? BREATHING_PRESETS[0];
  }

  private _start(): void {
    const preset = this._buildEffectivePreset();
    const phases = activePhases(preset);
    if (phases.length === 0) return;

    navigate('/breathing-timer', {
      preset,
      durationMode: this._durationMode,
      totalCycles: this._cycles,
      totalMinutes: this._minutes,
    });
  }

  private _presetDisplayName(preset: BreathingPreset): string {
    if (!isBuiltInBreathingPresetId(preset.id)) return preset.name;

    switch (preset.id) {
      case 'coherence':  return msg('Coherent Breathing');
      case 'box':        return msg('Box Breathing');
      case '4-7-8':      return msg('4-7-8 Breath');
      case 'apnea-prep': return msg('Freediving Prep');
      case 'custom':     return msg('Custom');
    }
  }

  private _phaseSymbol(label: BreathingPhase['label']) {
    switch (label) {
      case 'inhale':   return symbolInhale;
      case 'hold-in':  return symbolHoldIn;
      case 'exhale':   return symbolExhale;
      case 'hold-out': return symbolHoldOut;
    }
  }

  private _phaseLabelText(label: BreathingPhase['label']): string {
    switch (label) {
      case 'inhale': return msg('Inhale');
      case 'hold-in': return msg('Hold', { id: 'breathing-hold' });
      case 'exhale': return msg('Exhale');
      case 'hold-out': return msg('Hold', { id: 'breathing-hold' });
    }
  }

  private _presetCycleDuration(preset: BreathingPreset): number {
    const phases = preset.id === 'custom' ? this._customPhases : preset.phases;
    return phases.reduce((sum, phase) => sum + phase.duration, 0);
  }

  private _renderPresetPills(preset: BreathingPreset) {
    const phases = preset.id === 'custom' ? this._customPhases : preset.phases;
    return html`
      <div class="phase-pills">
        ${phases.filter((phase) => phase.duration > 0).map(
          (phase) => html`
            <span class="phase-pill ${phase.label}">
              ${this._phaseSymbol(phase.label)}
              ${this._phaseLabelText(phase.label)} <span class="phase-pill-duration">${phase.duration}s</span>
            </span>`,
        )}
      </div>
    `;
  }

  private _renderCustomEditor() {
    const phaseOrder: BreathingPhase['label'][] = ['inhale', 'hold-in', 'exhale', 'hold-out'];
    return html`
      <div class="custom-phases">
        ${phaseOrder.map((label, i) => {
          const phase = this._customPhases.find((entry) => entry.label === label) ?? { label, duration: 0 };
          const idx = this._customPhases.findIndex((entry) => entry.label === label);
          return html`
            <div class="custom-phase-row">
              <span class="custom-phase-label ${label}">
                ${this._phaseSymbol(label)}
                ${this._phaseLabelText(label)}
              </span>
              <div class="custom-stepper">
                <button
                  class="stepper-btn"
                  @click=${() => this._stepCustomPhase(idx >= 0 ? idx : i, -1)}
                  ?disabled=${phase.duration <= 0}
                >−</button>
                <input
                  class="stepper-input"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  max="99"
                  .value=${String(phase.duration)}
                  @change=${(event: Event) => this._setCustomPhase(idx >= 0 ? idx : i, (event.target as HTMLInputElement).value)}
                />
                <button
                  class="stepper-btn"
                  @click=${() => this._stepCustomPhase(idx >= 0 ? idx : i, 1)}
                  ?disabled=${phase.duration >= 99}
                >+</button>
              </div>
              <span class="custom-phase-unit">s</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderSaveForm() {
    const canSave = this._saveName.trim().length > 0 && activePhases(this._buildEffectivePreset()).length > 0;
    const isEditing = this._editingSavedPresetId !== null;

    if (!this._saveFormOpen && !isEditing) {
      return html`
        <button class="btn btn-secondary save-trigger" @click=${this._openSaveForm}>
          ${msg('Save preset')}
        </button>
      `;
    }

    return html`
      <div class="save-card">
        <div class="save-title">
          ${isEditing
            ? msg('Edit saved exercise')
            : msg('Save custom exercise')}
        </div>
        <div class="save-hint">
          ${isEditing
            ? msg('Update the name, description, or timing, then save your changes.')
            : msg('Give this breathing pattern a name to add it to your exercise list.')}
        </div>
        <input
          class="save-input"
          type="text"
          maxlength="40"
          .value=${this._saveName}
          placeholder=${msg('Exercise name')}
          @input=${(event: Event) => { this._saveName = (event.target as HTMLInputElement).value; }}
        />
        <textarea
          class="save-textarea"
          maxlength="120"
          .value=${this._saveDescription}
          placeholder=${msg('Short description (optional)')}
          @input=${(event: Event) => { this._saveDescription = (event.target as HTMLTextAreaElement).value; }}
        ></textarea>
        <div class="save-actions">
          <button class="btn btn-primary" ?disabled=${!canSave} @click=${() => this._saveCurrentPreset()}>
            ${isEditing ? msg('Update preset') : msg('Save preset')}
          </button>
          <button
            class="btn btn-secondary"
            @click=${() => isEditing ? this._cancelEditingSavedPreset() : this._closeSaveForm()}
          >
            ${msg('Cancel')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderSavedIndicator() {
    return html`
      <span
        class="saved-indicator"
        title=${msg('Saved custom exercise')}
        aria-label=${msg('Saved custom exercise')}
      >
        ${iconBookmark}
        ${msg('Saved')}
      </span>
    `;
  }

  private _renderPresetCard(preset: BreathingPreset) {
    const isSavedPreset = !isBuiltInBreathingPresetId(preset.id);
    const isSelected = this._selectedId === preset.id;

    return html`
      <div
        class="preset-card ${isSelected ? 'active' : ''}"
        role="button"
        tabindex="0"
        @click=${() => this._selectPreset(preset.id)}
        @keydown=${(event: KeyboardEvent) => this._handlePresetKeydown(event, preset.id)}
      >
        <div class="preset-header">
          <div class="preset-name-row">
            <span class="preset-name">${this._presetDisplayName(preset)}</span>
            ${isSavedPreset ? this._renderSavedIndicator() : ''}
          </div>
          <span class="preset-duration">${this._presetCycleDuration(preset)}s / ${msg('cycle')}</span>
        </div>
        ${preset.tip ? html`<div class="preset-tip">${preset.tip}</div>` : ''}
        ${this._renderPresetPills(preset)}
        ${isSelected && preset.id === 'custom' ? html`
          ${this._renderCustomEditor()}
          ${this._renderSaveForm()}
        ` : ''}
        ${isSelected && isSavedPreset ? html`
          <div class="preset-card-actions">
            <button class="btn btn-secondary" @click=${(event: Event) => { event.stopPropagation(); void this._startEditingSavedPreset(preset); }}>
              ${iconEdit} ${msg('Edit')}
            </button>
            <button class="btn btn-danger" @click=${(event: Event) => { event.stopPropagation(); void this._deleteSavedPreset(preset.id); }}>
              ${iconX} ${msg('Delete')}
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  render() {
    const selectedPreset = this._buildEffectivePreset();

    return html`
      <div class="page">
        <h1 class="page-title">${msg('Breathing Exercises')}</h1>

        <div class="section-label">${msg('Program')}</div>
        <div class="preset-list">
          ${this._allPresets().map((preset) => this._renderPresetCard(preset))}
        </div>

        <div class="duration-section">
          <div class="section-label">${msg('Duration')}</div>
          <div class="mode-toggle">
            <button
              class="mode-btn ${this._durationMode === 'cycles' ? 'active' : ''}"
              @click=${() => this._setDurationMode('cycles')}
            >${msg('Cycles')}</button>
            <button
              class="mode-btn ${this._durationMode === 'minutes' ? 'active' : ''}"
              @click=${() => this._setDurationMode('minutes')}
            >${msg('Minutes')}</button>
          </div>
          ${this._durationMode === 'cycles' ? html`
            <div class="stepper">
              <button
                class="stepper-btn"
                @click=${() => this._stepCycles(-1)}
                ?disabled=${this._cycles <= 1}
                aria-label="Fewer cycles"
              >−</button>
              <div class="stepper-center">
                <input
                  class="stepper-input"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="99"
                  .value=${String(this._cycles)}
                  @change=${(event: Event) => this._setCycles((event.target as HTMLInputElement).value)}
                />
                <span class="stepper-unit">${msg('cycles')}</span>
              </div>
              <button
                class="stepper-btn"
                @click=${() => this._stepCycles(1)}
                ?disabled=${this._cycles >= 99}
                aria-label="More cycles"
              >+</button>
            </div>
            <div class="stepper-hint">
              ~${Math.round(cycleDuration(selectedPreset) * this._cycles / 60)} min
            </div>
          ` : html`
            <div class="stepper">
              <button
                class="stepper-btn"
                @click=${() => this._stepMinutes(-1)}
                ?disabled=${this._minutes <= 1}
                aria-label="Fewer minutes"
              >−</button>
              <div class="stepper-center">
                <input
                  class="stepper-input"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="60"
                  .value=${String(this._minutes)}
                  @change=${(event: Event) => this._setMinutes((event.target as HTMLInputElement).value)}
                />
                <span class="stepper-unit">${msg('minutes')}</span>
              </div>
              <button
                class="stepper-btn"
                @click=${() => this._stepMinutes(1)}
                ?disabled=${this._minutes >= 60}
                aria-label="More minutes"
              >+</button>
            </div>
          `}
        </div>

        <div class="action-bar">
          <button class="btn btn-primary btn-large" @click=${this._start}>
            ${msg('Start')}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-breathing-setup': AppBreathingSetup;
  }
}
