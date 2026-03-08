import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import { getSettings, saveSettings } from '../services/db.js';
import { iconInfo, iconWind, symbolBreathe, symbolHoldIn } from '../components/icons.js';
import {
  generateCO2Table,
  generateO2Table,
  formatTime,
  totalDuration,
  CO2_PRESETS,
  O2_PRESETS,
} from '../services/tables.js';
import { navigate } from '../navigation.js';
import type { TableRound, Difficulty, TableType, RoundCount } from '../types.js';
import './app-breathing-setup.js';

type TrainingTab = 'breathing' | TableType;

@localized()
@customElement('app-table-setup')
export class AppTableSetup extends LitElement {
  @property() mode: TableType | '' = '';

  /** Active tab when accessed via /training (no fixed mode prop). Defaults to 'breathing'. */
  @state() private _activeTab: TrainingTab = 'breathing';
  @state() private _mode: TableType = 'co2';
  @state() private _pb = 0;
  @state() private _difficulty: Difficulty = 'normal';
  /** Number of rounds (2–8). Loaded from settings and saved on each change. */
  @state() private _rounds = 8;
  @state() private _table: TableRound[] = [];
  @state() private _showTooltip = false;
  @state() private _showBreathingTooltip = false;
  @state() private _showDiffTooltip = false;

  static styles = [
    sharedStyles,
    css`
      .page {
        padding: var(--spacing-lg);
        max-width: 600px;
        margin: 0 auto;
        padding-bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0) + 80px);
      }

      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--spacing-lg);
      }

      .page-title {
        font-size: var(--font-xl);
        font-weight: 800;
        margin: 0;
      }

      /* Semantic title colors: phase/exercise type, not navigation */
      .page-title.co2 { color: var(--color-hold); }
      .page-title.o2 { color: var(--color-breathe); }
      .page-title.breathing { color: var(--color-rest); }

      .tabs {
        display: flex;
        gap: var(--spacing-xs);
        background: var(--color-bg-surface);
        border-radius: var(--radius-full);
        padding: 3px;
        border: 1px solid var(--color-border);
        margin-bottom: var(--spacing-lg);
      }

      .tab-btn {
        flex: 1;
        padding: var(--spacing-sm) var(--spacing-md);
        border: none;
        border-radius: var(--radius-full);
        background: transparent;
        color: var(--color-text-secondary);
        font-size: var(--font-sm);
        font-weight: 700;
        cursor: pointer;
        transition: all var(--transition-fast);
        font-family: inherit;
        letter-spacing: 0.03em;
      }

      /* All active tabs use the primary accent — tab = navigation, not content type */
      .tab-btn.active {
        background: var(--color-accent);
        color: #fff;
      }

      /* Container for the tabs row when the breathing tab is active */
      .tabs-header {
        padding: var(--spacing-lg) var(--spacing-lg) 0;
        max-width: 600px;
        margin: 0 auto;
      }

      .info-btn {
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        border-radius: var(--radius-sm);
        -webkit-tap-highlight-color: transparent;
        transition: color var(--transition-fast);
      }

      .info-btn:hover, .info-btn.active {
        color: var(--color-accent);
      }

      .info-tooltip {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
        font-size: var(--font-sm);
        color: var(--color-text-secondary);
        line-height: 1.5;
      }

      .no-pb {
        text-align: center;
        padding: var(--spacing-2xl) var(--spacing-lg);
      }

      .no-pb p {
        color: var(--color-text-secondary);
        margin-bottom: var(--spacing-lg);
      }

      /* Section label with optional inline info button */
      .section-label-row {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        margin-bottom: var(--spacing-xs);
      }

      .section-label-row .section-label { line-height: 1; }
      .section-label-row .info-btn {
        padding: 0;
        display: inline-flex;
        align-items: center;
        translate: 0 -5px;
      }
      .section-label-row .info-btn svg {
        width: 13px;
        height: 13px;
      }

      .section-label {
        font-size: var(--font-xs);
        font-weight: 600;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      /* Difficulty info tooltip — structured as labelled rows from preset constants */
      .diff-tooltip-lines {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
      }

      .diff-tooltip-line {
        display: flex;
        gap: var(--spacing-sm);
        align-items: baseline;
      }

      .diff-tooltip-name {
        font-weight: 700;
        color: var(--color-text-primary);
        min-width: 60px;
      }

      .diff-tooltip-note {
        margin-top: var(--spacing-xs);
        color: var(--color-text-muted);
        font-size: var(--font-xs);
      }

      .difficulty-row {
        display: flex;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-lg);
      }

      .diff-btn {
        flex: 1;
        padding: var(--spacing-sm) var(--spacing-md);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        background: var(--color-bg-surface);
        color: var(--color-text-secondary);
        font-size: var(--font-sm);
        font-weight: 600;
        cursor: pointer;
        transition: all var(--transition-fast);
        font-family: inherit;
        text-transform: capitalize;
      }

      .diff-btn.active {
        background: var(--color-accent);
        color: #fff;
        border-color: var(--color-accent);
      }

      /* ---- Rounds slider ---- */
      .rounds-slider-row {
        margin-bottom: var(--spacing-lg);
      }

      .rounds-slider-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: var(--spacing-sm);
      }

      .rounds-current {
        font-size: var(--font-sm);
        font-weight: 700;
        color: var(--color-accent);
      }

      .rounds-ends {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
      }

      .rounds-slider {
        width: 100%;
        height: 6px;
        -webkit-appearance: none;
        appearance: none;
        background: var(--color-border);
        border-radius: var(--radius-full);
        outline: none;
        cursor: pointer;
      }

      .rounds-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: var(--color-accent);
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0,0,0,0.2);
      }

      .rounds-slider::-moz-range-thumb {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: var(--color-accent);
        cursor: pointer;
        border: none;
        box-shadow: 0 1px 4px rgba(0,0,0,0.2);
      }

      .table-container {
        margin-bottom: var(--spacing-lg);
      }

      /* Shared grid for header + data rows: [round-num] [breathe-col] [hold-col] */
      .table-header,
      .round-row {
        display: grid;
        grid-template-columns: 28px 1fr 1fr;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm) var(--spacing-md);
      }

      /* Header row — plain labels, no background */
      .table-header {
        padding-bottom: var(--spacing-xs);
      }

      /* Data rows — surface card */
      .round-row {
        background: var(--color-bg-surface);
        border-radius: var(--radius-sm);
        margin-bottom: 2px;
        border: 1px solid var(--color-border);
      }

      .round-num {
        font-size: var(--font-sm);
        font-weight: 700;
        color: var(--color-text-muted);
        text-align: center;
      }

      /* Column cells: header labels and data pills share the same column width */
      .col-breathe,
      .col-hold {
        display: flex;
        justify-content: center;
      }

      /* Phase pills — mirrors the breathing preset pills style */
      .round-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: var(--font-sm);
        font-weight: 700;
        padding: var(--spacing-xs) var(--spacing-sm);
        border-radius: var(--radius-full);
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.01em;
      }

      .round-pill svg { width: 10px; height: 10px; flex-shrink: 0; }

      .round-pill.breathe {
        background: color-mix(in srgb, var(--color-rest) 18%, transparent);
        color: var(--color-rest);
      }

      .round-pill.hold {
        background: color-mix(in srgb, var(--color-breathe) 18%, transparent);
        color: var(--color-breathe);
      }

      .total-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-md);
        margin-top: var(--spacing-md);
        border-radius: var(--radius-sm);
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
      }

      .total-label {
        font-size: var(--font-sm);
        color: var(--color-text-muted);
      }

      .total-value {
        font-size: var(--font-lg);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
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
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    if (this.mode) {
      this._mode = this.mode;
      this._activeTab = this.mode;
    }
    // else: _activeTab stays 'breathing' — default for /training
    void this._load();
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('mode') && this.mode) {
      this._mode = this.mode;
      this._activeTab = this.mode;
      void this._load();
    }
  }

  /** Switch between Breathing / CO2 / O2 tabs (only on /training without mode prop). */
  private _switchTab(tab: TrainingTab): void {
    this._activeTab = tab;
    this._showTooltip = false;
    this._showBreathingTooltip = false;
    this._showDiffTooltip = false;
    if (tab !== 'breathing') {
      this._mode = tab;
      void this._load();
    }
  }

  private async _load(): Promise<void> {
    const settings = await getSettings();
    this._pb = settings.personalBest;
    this._difficulty =
      this._mode === 'co2' ? settings.co2Difficulty : settings.o2Difficulty;
    // Resolve stored round count to a plain number (2–8).
    this._rounds =
      settings.roundCount === 'custom' ? settings.customRounds : settings.roundCount;
    this._regenerate();
  }

  private _regenerate(): void {
    if (this._pb <= 0) {
      this._table = [];
      return;
    }
    this._table =
      this._mode === 'co2'
        ? generateCO2Table(this._pb, this._difficulty, this._rounds)
        : generateO2Table(this._pb, this._difficulty, this._rounds);
  }

  private async _setDifficulty(d: Difficulty): Promise<void> {
    this._difficulty = d;
    const key = this._mode === 'co2' ? 'co2Difficulty' : 'o2Difficulty';
    await saveSettings({ [key]: d });
    this._regenerate();
  }

  private async _setRounds(n: number): Promise<void> {
    this._rounds = n;
    // Map exact preset values back to named keys so that sliding to 8 gives
    // roundCount:8 on the next load (not 'custom'), keeping the default clean.
    const roundCount: RoundCount = (n === 4 || n === 8) ? n as (4 | 8) : 'custom';
    await saveSettings({ roundCount, customRounds: n });
    this._regenerate();
  }

  private _startExercise(): void {
    navigate('/timer', {
      table: this._table,
      type: this._mode,
    });
  }

  /**
   * Builds the difficulty info tooltip content directly from CO2_PRESETS / O2_PRESETS.
   * Any change to the preset constants is automatically reflected here.
   */
  private _renderDiffTooltip() {
    const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
    const diffLabel = (d: Difficulty) =>
      d === 'easy' ? msg('Easy') : d === 'normal' ? msg('Normal') : msg('Hard');

    if (this._mode === 'co2') {
      return html`
        <div class="diff-tooltip-lines">
          ${difficulties.map(d => html`
            <div class="diff-tooltip-line">
              <span class="diff-tooltip-name">${diffLabel(d)}:</span>
              <!-- holdFactor from CO2_PRESETS — update the preset to auto-update this display -->
              <span>${Math.round(CO2_PRESETS[d].holdFactor * 100)}% PB</span>
            </div>
          `)}
          <div class="diff-tooltip-note">
            ${msg('Rest decreases by 10 s each round.')}
          </div>
        </div>
      `;
    } else {
      return html`
        <div class="diff-tooltip-lines">
          ${difficulties.map(d => html`
            <div class="diff-tooltip-line">
              <span class="diff-tooltip-name">${diffLabel(d)}:</span>
              <!-- startFactor & increment from O2_PRESETS — auto-synced with logic -->
              <span>${Math.round(O2_PRESETS[d].startFactor * 100)}% PB, +${O2_PRESETS[d].increment}s/${msg('round')}</span>
            </div>
          `)}
          <div class="diff-tooltip-note">
            ${msg('Hold increases each round. Rest is constant per level.')}
          </div>
        </div>
      `;
    }
  }

  private _renderModeTabs() {
    // Only show tabs when accessed via /training (no fixed mode prop)
    if (this.mode) return '';
    return html`
      <div class="tabs" style="margin-bottom:var(--spacing-lg)">
        <button
          class="tab-btn ${this._activeTab === 'breathing' ? 'active' : ''}"
          @click=${() => this._switchTab('breathing')}
        >${msg('Breathing')}</button>
        <button
          class="tab-btn ${this._activeTab === 'co2' ? 'active' : ''}"
          @click=${() => this._switchTab('co2')}
        >CO2</button>
        <button
          class="tab-btn ${this._activeTab === 'o2' ? 'active' : ''}"
          @click=${() => this._switchTab('o2')}
        >O2</button>
      </div>
    `;
  }

  private _renderPageHeader() {
    if (this.mode) return '';
    return html`
      <div style="display:flex;align-items:center;gap:var(--spacing-sm);margin-bottom:var(--spacing-lg)">
        <span style="color:var(--color-accent);display:flex;align-items:center">${iconWind}</span>
        <h1 class="page-title" style="margin:0">${msg('Training')}</h1>
      </div>
    `;
  }

  render() {
    // Breathing tab — inline setup, no /breathing navigation
    if (this._activeTab === 'breathing' && !this.mode) {
      return html`
        <div class="tabs-header">
          ${this._renderPageHeader()}
          ${this._renderModeTabs()}
          <div class="page-header">
            <h1 class="page-title breathing">${msg('Breathing')}</h1>
            <button
              class="info-btn ${this._showBreathingTooltip ? 'active' : ''}"
              @click=${() => { this._showBreathingTooltip = !this._showBreathingTooltip; }}
              aria-label="Info"
            >${iconInfo}</button>
          </div>
          ${this._showBreathingTooltip ? html`
            <div class="info-tooltip">
              ${msg('Guided breathing exercises for relaxation and freediving preparation. Choose a preset pattern and let the animated timer pace your breath.')}
            </div>
          ` : ''}
        </div>
        <app-breathing-setup embedded></app-breathing-setup>
      `;
    }

    if (this._pb <= 0) {
      return html`
        <div class="page">
          ${this._renderPageHeader()}
          ${this._renderModeTabs()}
          <h1 class="page-title ${this._mode}" style="margin-bottom:var(--spacing-lg)">${msg(str`${this._mode.toUpperCase()} Table`)}</h1>
          <div class="no-pb">
            <p>${msg('You need to set your Personal Best before generating tables.')}</p>
            <button class="btn btn-primary btn-large" @click=${() => navigate('/pb-test')}>
              ${msg('Take PB Test')}
            </button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="page">
        ${this._renderPageHeader()}
        ${this._renderModeTabs()}
        <div class="page-header">
          <h1 class="page-title ${this._mode}">${msg(str`${this._mode.toUpperCase()} Table`)}</h1>
          <div style="display:flex;align-items:center;gap:var(--spacing-sm)">
            <button
              class="info-btn ${this._showTooltip ? 'active' : ''}"
              @click=${() => { this._showTooltip = !this._showTooltip; }}
              aria-label="Info"
            >${iconInfo}</button>
            <span style="font-size: var(--font-sm); color: var(--color-text-muted)">
              ${msg(str`PB: ${formatTime(this._pb)}`)}
            </span>
          </div>
        </div>

        ${this._showTooltip ? html`
          <div class="info-tooltip">
            ${this._mode === 'co2'
              ? msg('Constant hold time with decreasing rest. Builds CO2 tolerance by preventing full recovery between holds.')
              : msg('Increasing hold time with constant rest. Trains your body to function with progressively lower oxygen levels.')}
          </div>
        ` : ''}

        <!-- DIFFICULTY — values come directly from CO2_PRESETS / O2_PRESETS -->
        <div class="section-label-row">
          <span class="section-label">${msg('Difficulty')}</span>
          <button
            class="info-btn ${this._showDiffTooltip ? 'active' : ''}"
            @click=${() => { this._showDiffTooltip = !this._showDiffTooltip; }}
            aria-label="Difficulty info"
          >${iconInfo}</button>
        </div>
        ${this._showDiffTooltip ? html`
          <div class="info-tooltip">${this._renderDiffTooltip()}</div>
        ` : ''}
        <div class="difficulty-row">
          ${(['easy', 'normal', 'hard'] as Difficulty[]).map(
            (d) => html`
              <button
                class="diff-btn ${this._difficulty === d ? 'active' : ''}"
                @click=${() => this._setDifficulty(d)}
              >
                ${d === 'easy' ? msg('easy') : d === 'normal' ? msg('normal') : msg('hard')}
              </button>
            `,
          )}
        </div>

        <!-- ROUNDS — single slider from 2 to 8 -->
        <div class="section-label" style="margin-bottom:var(--spacing-xs)">${msg('Rounds')}</div>
        <div class="rounds-slider-row">
          <div class="rounds-slider-header">
            <span class="rounds-ends">2</span>
            <span class="rounds-current">${this._rounds} ${msg('rounds')}</span>
            <span class="rounds-ends">8</span>
          </div>
          <input
            class="rounds-slider"
            type="range"
            min="2"
            max="8"
            step="1"
            .value=${String(this._rounds)}
            @input=${(e: Event) =>
              this._setRounds(parseInt((e.target as HTMLInputElement).value, 10))}
          />
        </div>

        <!-- TABLE — header shows symbol + label per column; data rows show time only.
             Both use the same 3-column grid so values align perfectly under their labels. -->
        <div class="table-container">
          <div class="table-header">
            <span class="round-num"></span>
            <div class="col-breathe">
              <span class="round-pill breathe">${symbolBreathe} ${msg('Breathe')}</span>
            </div>
            <div class="col-hold">
              <span class="round-pill hold">${symbolHoldIn} ${msg('Hold')}</span>
            </div>
          </div>

          ${this._table.map(
            (round, i) => html`
              <div class="round-row">
                <span class="round-num">${i + 1}</span>
                <div class="col-breathe">
                  <span class="round-pill breathe">${formatTime(round.rest)}</span>
                </div>
                <div class="col-hold">
                  <span class="round-pill hold">${formatTime(round.hold)}</span>
                </div>
              </div>
            `,
          )}

          <div class="total-row">
            <span class="total-label">${msg('Total Duration')}</span>
            <span class="total-value">${formatTime(totalDuration(this._table))}</span>
          </div>
        </div>

        <div class="action-bar">
          <button class="btn btn-primary btn-large" @click=${this._startExercise}>
            ${msg('Start')}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-table-setup': AppTableSetup;
  }
}
