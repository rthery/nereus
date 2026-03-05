import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import { getSettings, saveSettings } from '../services/db.js';
import { iconInfo } from '../components/icons.js';
import {
  generateCO2Table,
  generateO2Table,
  formatTime,
  totalDuration,
} from '../services/tables.js';
import { navigate } from '../navigation.js';
import type { TableRound, Difficulty, TableType, RoundCount } from '../types.js';

@localized()
@customElement('app-table-setup')
export class AppTableSetup extends LitElement {
  @property() mode: TableType = 'co2';

  @state() private _pb = 0;
  @state() private _difficulty: Difficulty = 'normal';
  @state() private _roundCount: RoundCount = 8;
  @state() private _customRounds = 6;
  @state() private _table: TableRound[] = [];
  @state() private _editedTable: TableRound[] = [];
  @state() private _isEdited = false;
  @state() private _showTooltip = false;

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

      .page-title.co2 { color: var(--color-hold); }
      .page-title.o2 { color: var(--color-breathe); }

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

      .section-label {
        font-size: var(--font-xs);
        font-weight: 600;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: var(--spacing-xs);
      }

      .custom-rounds-input {
        width: 64px;
        padding: var(--spacing-xs) var(--spacing-sm);
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        color: var(--color-text-primary);
        font-size: var(--font-sm);
        font-weight: 600;
        text-align: center;
        font-family: inherit;
        margin-left: var(--spacing-sm);
      }

      .custom-rounds-input:focus {
        outline: none;
        border-color: var(--color-accent);
      }

      .table-container {
        margin-bottom: var(--spacing-lg);
      }

      .table-header {
        display: grid;
        grid-template-columns: 50px 1fr 1fr;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm) var(--spacing-md);
        font-size: var(--font-xs);
        font-weight: 600;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .round-row {
        display: grid;
        grid-template-columns: 50px 1fr 1fr;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm) var(--spacing-md);
        background: var(--color-bg-surface);
        border-radius: var(--radius-sm);
        margin-bottom: 2px;
        align-items: center;
        border: 1px solid var(--color-border);
      }

      .round-num {
        font-size: var(--font-sm);
        font-weight: 700;
        color: var(--color-text-muted);
      }

      .time-input {
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: var(--spacing-xs) var(--spacing-sm);
        color: var(--color-text-primary);
        font-size: var(--font-md);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        text-align: center;
        width: 100%;
        font-family: inherit;
      }

      .time-input:focus {
        outline: none;
        border-color: var(--color-accent);
      }

      .time-input.rest { color: var(--color-breathe); }
      .time-input.hold { color: var(--color-hold); }

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
    this._load();
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('mode')) {
      this._load();
    }
  }

  private async _load(): Promise<void> {
    const settings = await getSettings();
    this._pb = settings.personalBest;
    this._difficulty =
      this.mode === 'co2' ? settings.co2Difficulty : settings.o2Difficulty;
    this._roundCount = settings.roundCount;
    this._customRounds = settings.customRounds;
    this._regenerate();
  }

  private get _resolvedRounds(): number {
    return this._roundCount === 'custom' ? this._customRounds : this._roundCount;
  }

  private _regenerate(): void {
    if (this._pb <= 0) {
      this._table = [];
      this._editedTable = [];
      return;
    }
    const rounds = this._resolvedRounds;
    this._table =
      this.mode === 'co2'
        ? generateCO2Table(this._pb, this._difficulty, rounds)
        : generateO2Table(this._pb, this._difficulty, rounds);
    this._editedTable = this._table.map((r) => ({ ...r }));
    this._isEdited = false;
  }

  private async _setDifficulty(d: Difficulty): Promise<void> {
    this._difficulty = d;
    const key = this.mode === 'co2' ? 'co2Difficulty' : 'o2Difficulty';
    await saveSettings({ [key]: d });
    this._regenerate();
  }

  private async _setRoundCount(rc: RoundCount): Promise<void> {
    this._roundCount = rc;
    await saveSettings({ roundCount: rc });
    this._regenerate();
  }

  private async _setCustomRounds(value: string): Promise<void> {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 2 || n > 12) return;
    this._customRounds = n;
    await saveSettings({ customRounds: n });
    this._regenerate();
  }

  private _onTimeChange(index: number, field: 'rest' | 'hold', value: string): void {
    const parts = value.split(':');
    if (parts.length !== 2) return;
    const seconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    if (isNaN(seconds) || seconds < 0) return;

    this._editedTable = this._editedTable.map((r, i) =>
      i === index ? { ...r, [field]: seconds } : r,
    );
    this._isEdited = true;
  }

  private _resetTable(): void {
    this._editedTable = this._table.map((r) => ({ ...r }));
    this._isEdited = false;
  }

  private _startExercise(): void {
    navigate('/timer', {
      table: this._editedTable,
      type: this.mode,
    });
  }

  render() {
    if (this._pb <= 0) {
      return html`
        <div class="page">
          <h1 class="page-title ${this.mode}">${msg(str`${this.mode.toUpperCase()} Table`)}</h1>
          <div class="no-pb">
            <p>${msg('You need to set your Personal Best before generating tables.')}</p>
            <button class="btn btn-primary btn-large" @click=${() => navigate('/pb-test')}>
              ${msg('Take PB Test')}
            </button>
          </div>
        </div>
      `;
    }

    const activeTable = this._editedTable;

    return html`
      <div class="page">
        <div class="page-header">
          <h1 class="page-title ${this.mode}">${msg(str`${this.mode.toUpperCase()} Table`)}</h1>
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
            ${this.mode === 'co2'
              ? msg('Constant hold time with decreasing rest. Builds CO2 tolerance by preventing full recovery between holds.')
              : msg('Increasing hold time with constant rest. Trains your body to function with progressively lower oxygen levels.')}
          </div>
        ` : ''}

        <div class="section-label">${msg('Difficulty')}</div>
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

        <div class="section-label">${msg('Rounds')}</div>
        <div class="difficulty-row">
          <button
            class="diff-btn ${this._roundCount === 4 ? 'active' : ''}"
            @click=${() => this._setRoundCount(4)}
          >
            ${msg('Quick (4)')}
          </button>
          <button
            class="diff-btn ${this._roundCount === 8 ? 'active' : ''}"
            @click=${() => this._setRoundCount(8)}
          >
            ${msg('Full (8)')}
          </button>
          <button
            class="diff-btn ${this._roundCount === 'custom' ? 'active' : ''}"
            @click=${() => this._setRoundCount('custom')}
          >
            ${msg('Custom')}${this._roundCount === 'custom'
              ? html`<input
                  class="custom-rounds-input"
                  type="number"
                  min="2"
                  max="12"
                  .value=${String(this._customRounds)}
                  @click=${(e: Event) => e.stopPropagation()}
                  @change=${(e: Event) =>
                    this._setCustomRounds((e.target as HTMLInputElement).value)}
                />`
              : ''}
          </button>
        </div>

        <div class="table-container">
          <div class="table-header">
            <span>#</span>
            <span>${msg('Breathe')}</span>
            <span>${msg('Hold')}</span>
          </div>
          ${activeTable.map(
            (round, i) => html`
              <div class="round-row">
                <span class="round-num">${i + 1}</span>
                <input
                  class="time-input rest"
                  type="text"
                  inputmode="numeric"
                  .value=${formatTime(round.rest)}
                  @change=${(e: Event) =>
                    this._onTimeChange(i, 'rest', (e.target as HTMLInputElement).value)}
                />
                <input
                  class="time-input hold"
                  type="text"
                  inputmode="numeric"
                  .value=${formatTime(round.hold)}
                  @change=${(e: Event) =>
                    this._onTimeChange(i, 'hold', (e.target as HTMLInputElement).value)}
                />
              </div>
            `,
          )}

          <div class="total-row">
            <span class="total-label">${msg('Total Duration')}</span>
            <span class="total-value">${formatTime(totalDuration(activeTable))}</span>
          </div>
        </div>

        <div class="action-bar">
          ${this._isEdited
            ? html`<button class="btn btn-secondary" @click=${this._resetTable}>${msg('Reset')}</button>`
            : ''}
          <button class="btn btn-primary btn-large" @click=${this._startExercise}>
            ${msg('Start Exercise')}
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
