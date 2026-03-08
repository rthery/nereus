import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import { getSettings, saveSettings } from '../services/db.js';
import { navigate } from '../navigation.js';
import {
  BREATHING_PRESETS,
  cycleDuration,
  activePhases,
} from '../services/breathing-presets.js';
import { symbolInhale, symbolExhale, symbolHoldIn, symbolHoldOut } from '../components/icons.js';
import type { BreathingPhase, BreathingPreset, BreathingPresetId } from '../types.js';

@localized()
@customElement('app-breathing-setup')
export class AppBreathingSetup extends LitElement {
  /** When true (embedded in training page tabs), hides the page title and removes top padding. */
  @property({ type: Boolean }) embedded = false;

  @state() private _selectedId: BreathingPresetId = 'coherence';
  @state() private _customPhases: BreathingPhase[] = [
    { label: 'inhale', duration: 4 },
    { label: 'hold-in', duration: 0 },
    { label: 'exhale', duration: 4 },
    { label: 'hold-out', duration: 0 },
  ];
  @state() private _durationMode: 'cycles' | 'minutes' = 'cycles';
  @state() private _cycles = 15;
  @state() private _minutes = 5;

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
        font-family: inherit;
        color: var(--color-text-primary);
      }

      .preset-card:hover {
        border-color: var(--color-accent);
      }

      .preset-card.active {
        border-color: var(--color-accent);
        background: var(--color-accent-subtle);
      }

      .preset-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--spacing-xs);
      }

      .preset-name {
        font-size: var(--font-md);
        font-weight: 700;
      }

      .preset-duration {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
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

      .custom-phase-input {
        width: 64px;
        padding: var(--spacing-xs) var(--spacing-sm);
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        color: var(--color-text-primary);
        font-size: var(--font-md);
        font-weight: 600;
        text-align: center;
        font-family: inherit;
      }

      .custom-phase-input:focus {
        outline: none;
        border-color: var(--color-accent);
      }

      .custom-phase-input.disabled {
        opacity: 0.4;
      }

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

      /* Stepper control: [−] value [+] */
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

      /* Stepper center: editable number input + small unit label stacked */
      .stepper-center {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-sm) 0;
        gap: 1px;
      }

      /* Input looks like plain text — tap to edit directly */
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

      /* Hint shown below the stepper (estimated session length) */
      .stepper-hint {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        text-align: center;
        margin-top: var(--spacing-xs);
      }

      /* Compact stepper used inside the custom phase editor */
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

      /* Embedded in training page tab — outer tabs header provides the top spacing */
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

  private async _load(): Promise<void> {
    const s = await getSettings();
    if (s.breathingCustomPhases) {
      this._customPhases = s.breathingCustomPhases;
    }
    if (s.breathingDurationMode) this._durationMode = s.breathingDurationMode;
    if (s.breathingCycles) this._cycles = s.breathingCycles;
    if (s.breathingMinutes) this._minutes = s.breathingMinutes;
  }

  private async _selectPreset(id: BreathingPresetId): Promise<void> {
    this._selectedId = id;
    const preset = BREATHING_PRESETS.find((p) => p.id === id)!;
    if (id !== 'custom') {
      this._cycles = preset.defaultCycles;
      this._minutes = preset.defaultMinutes;
    }
  }

  private async _setCustomPhase(index: number, value: string): Promise<void> {
    const n = parseInt(value, 10);
    const duration = isNaN(n) || n < 0 ? 0 : Math.min(n, 99);
    this._customPhases = this._customPhases.map((p, i) =>
      i === index ? { ...p, duration } : p,
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
    return BREATHING_PRESETS.find((p) => p.id === this._selectedId)!;
  }

  private _start(): void {
    const preset = this._buildEffectivePreset();
    const phases = activePhases(preset);
    if (phases.length === 0) return; // nothing to run

    navigate('/breathing-timer', {
      preset,
      durationMode: this._durationMode,
      totalCycles: this._cycles,
      totalMinutes: this._minutes,
    });
  }

  private _presetDisplayName(id: BreathingPresetId): string {
    switch (id) {
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
        ${phases.filter((p) => p.duration > 0).map(
          (p) => html`
            <span class="phase-pill ${p.label}">
              ${this._phaseSymbol(p.label)}
              ${this._phaseLabelText(p.label)} <span class="phase-pill-duration">${p.duration}s</span>
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
          const phase = this._customPhases.find((p) => p.label === label) ?? { label, duration: 0 };
          const idx = this._customPhases.findIndex((p) => p.label === label);
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
                  @change=${(e: Event) => this._setCustomPhase(idx >= 0 ? idx : i, (e.target as HTMLInputElement).value)}
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

  render() {
    const selectedPreset = BREATHING_PRESETS.find((p) => p.id === this._selectedId)!;

    return html`
      <div class="page">
        <h1 class="page-title">${msg('Breathing Exercises')}</h1>

        <div class="section-label">${msg('Program')}</div>
        <div class="preset-list">
          ${BREATHING_PRESETS.map((preset) => html`
            <button
              class="preset-card ${this._selectedId === preset.id ? 'active' : ''}"
              @click=${() => this._selectPreset(preset.id)}
            >
              <div class="preset-header">
                <span class="preset-name">${this._presetDisplayName(preset.id)}</span>
                <span class="preset-duration">${this._presetCycleDuration(preset)}s / ${msg('cycle')}</span>
              </div>
              ${preset.tip ? html`<div class="preset-tip">${preset.tip}</div>` : ''}
              ${this._renderPresetPills(preset)}
              ${this._selectedId === preset.id && preset.id === 'custom'
                ? this._renderCustomEditor()
                : ''}
            </button>
          `)}
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
                  @change=${(e: Event) => this._setCycles((e.target as HTMLInputElement).value)}
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
            ${selectedPreset.id !== 'custom' ? html`
              <div class="stepper-hint">
                ~${Math.round(cycleDuration(selectedPreset) * this._cycles / 60)} min
              </div>
            ` : ''}
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
                  @change=${(e: Event) => this._setMinutes((e.target as HTMLInputElement).value)}
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
