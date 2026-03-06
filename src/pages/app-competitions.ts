import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import {
  getCompetitions,
  saveCompetition,
  deleteCompetition,
} from '../services/db.js';
import {
  ALL_DISCIPLINES,
  isDurationDiscipline,
  formatDisciplineValue,
  getDisciplineShortLabel,
} from '../services/disciplines.js';
import { formatTime } from '../services/tables.js';
import { iconX, iconTrophy, iconAward, iconPlus, iconChevronDown, iconChevronUp, iconEdit } from '../components/icons.js';
import { getLocale } from '../localization.js';
import type { Competition, DisciplineKey, DisciplineResult } from '../types.js';

const GOLD = '#FFD700';
const SILVER = '#C0C0C0';
const BRONZE = '#CD7F32';

const MAX_TEXT_LENGTH = 80;

/**
 * Strips characters that could be used for HTML/script injection and
 * enforces a maximum character length. Lit already escapes template
 * interpolations, but this adds a defence-in-depth layer before values
 * reach storage.
 */
function sanitizeText(raw: string, maxLen = MAX_TEXT_LENGTH): string {
  return raw
    .replace(/[<>&"'`]/g, '')
    .trim()
    .slice(0, maxLen);
}

function rankColor(rank: number): string {
  if (rank === 1) return GOLD;
  if (rank === 2) return SILVER;
  if (rank === 3) return BRONZE;
  return 'var(--color-text-muted)';
}

type FormResult = {
  enabled: boolean;
  // for duration disciplines (STA, 8x50m, 4x50m, 2x50m)
  valueMin: number;
  valueSec: number;
  // for distance disciplines (DYN, DYNB, DNF)
  valueM: string;
  rank: string;
};

@localized()
@customElement('app-competitions')
export class AppCompetitions extends LitElement {
  @state() private _competitions: Competition[] = [];
  @state() private _tab: 'list' | 'progress' = 'list';
  @state() private _showForm = false;
  @state() private _editingId: string | null = null;
  @state() private _expanded = new Set<string>();
  @state() private _selectedDiscipline: DisciplineKey = 'STA';

  // Form state
  @state() private _formName = '';
  @state() private _formDate = '';
  @state() private _formLocation = '';
  @state() private _formResults: Map<DisciplineKey, FormResult> = new Map();

  static styles = [
    sharedStyles,
    css`
      .page {
        padding: var(--spacing-lg);
        max-width: 800px;
        margin: 0 auto;
        padding-bottom: calc(var(--nav-height) + var(--spacing-xl));
      }

      .page-title {
        font-size: var(--font-xl);
        font-weight: 800;
        margin-bottom: var(--spacing-lg);
      }

      .tabs {
        display: flex;
        gap: var(--spacing-xs);
        margin-bottom: var(--spacing-lg);
        background: var(--color-bg-surface);
        border-radius: var(--radius-full);
        padding: 3px;
        border: 1px solid var(--color-border);
      }

      .tab-btn {
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

      .tab-btn.active {
        background: var(--color-accent);
        color: #fff;
      }

      .add-btn {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        padding: var(--spacing-sm) var(--spacing-md);
        background: var(--color-accent);
        color: #fff;
        border: none;
        border-radius: var(--radius-full);
        font-size: var(--font-sm);
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        margin-bottom: var(--spacing-lg);
        transition: opacity var(--transition-fast);
      }

      .add-btn svg { width: 18px; height: 18px; }
      .add-btn:hover { opacity: 0.85; }

      /* Form */
      .form-panel {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-lg);
        margin-bottom: var(--spacing-lg);
      }

      .form-title {
        font-size: var(--font-md);
        font-weight: 700;
        margin-bottom: var(--spacing-md);
        color: var(--color-accent);
      }

      .form-row {
        margin-bottom: var(--spacing-md);
      }

      .form-label {
        font-size: var(--font-xs);
        font-weight: 600;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: var(--spacing-xs);
        display: block;
      }

      .form-input {
        width: 100%;
        padding: var(--spacing-sm) var(--spacing-md);
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        color: var(--color-text-primary);
        font-size: var(--font-md);
        font-family: inherit;
        box-sizing: border-box;
      }

      .form-input:focus {
        outline: none;
        border-color: var(--color-accent);
      }

      /* Discipline rows */
      .discipline-rows {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
        margin-top: var(--spacing-xs);
      }

      .discipline-row {
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: var(--spacing-sm) var(--spacing-md);
        transition: border-color var(--transition-fast);
      }

      .discipline-row.enabled {
        border-color: var(--color-accent);
      }

      .discipline-header {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }

      .discipline-checkbox {
        width: 18px;
        height: 18px;
        cursor: pointer;
        accent-color: var(--color-accent);
        flex-shrink: 0;
      }

      .discipline-abbr {
        font-weight: 700;
        font-size: var(--font-sm);
        color: var(--color-accent);
        flex-shrink: 0;
      }

      .discipline-name {
        font-size: var(--font-sm);
        color: var(--color-text-secondary);
      }

      .discipline-row.enabled .discipline-name {
        color: var(--color-text-primary);
      }

      .discipline-inputs {
        display: flex;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-sm);
        align-items: flex-end;
      }

      /* Time picker (same style as PB test) */
      .time-picker {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: var(--spacing-xs) var(--spacing-sm);
        flex: 1;
      }

      .time-picker:focus-within {
        border-color: var(--color-accent);
      }

      .time-picker-field {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        flex: 1;
      }

      .time-picker-field input {
        background: transparent;
        border: none;
        color: var(--color-text-primary);
        font-size: var(--font-md);
        font-weight: 700;
        text-align: center;
        font-family: inherit;
        font-variant-numeric: tabular-nums;
        width: 100%;
        padding: 0;
        -moz-appearance: textfield;
      }

      .time-picker-field input:focus { outline: none; }

      .time-picker-field input::-webkit-outer-spin-button,
      .time-picker-field input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      .time-picker-unit {
        font-size: 9px;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .time-picker-sep {
        font-size: var(--font-md);
        font-weight: 700;
        color: var(--color-text-secondary);
        padding-bottom: 1.2em;
        flex-shrink: 0;
      }

      /* Meters input */
      .meters-input {
        flex: 1;
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: var(--spacing-xs) var(--spacing-sm);
      }

      .meters-input:focus-within {
        border-color: var(--color-accent);
      }

      .meters-input input {
        background: transparent;
        border: none;
        color: var(--color-text-primary);
        font-size: var(--font-md);
        font-weight: 700;
        font-family: inherit;
        font-variant-numeric: tabular-nums;
        width: 100%;
        padding: 0;
        -moz-appearance: textfield;
        text-align: center;
      }

      .meters-input input:focus { outline: none; }
      .meters-input input::-webkit-outer-spin-button,
      .meters-input input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      .meters-unit {
        font-size: 9px;
        color: var(--color-text-muted);
        text-transform: uppercase;
        flex-shrink: 0;
      }

      /* Rank input */
      .rank-field {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        width: 52px;
        flex-shrink: 0;
      }

      .rank-field input {
        width: 100%;
        padding: var(--spacing-xs) var(--spacing-xs);
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        color: var(--color-text-primary);
        font-size: var(--font-md);
        font-weight: 700;
        font-family: inherit;
        text-align: center;
        -moz-appearance: textfield;
        font-variant-numeric: tabular-nums;
      }

      .rank-field input:focus {
        outline: none;
        border-color: var(--color-accent);
      }

      .rank-field input::-webkit-outer-spin-button,
      .rank-field input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      .rank-field .rank-label {
        font-size: 9px;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .form-actions {
        display: flex;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-lg);
      }

      /* Competition cards */
      .competition-card {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        margin-bottom: var(--spacing-sm);
        overflow: hidden;
      }

      .card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--spacing-md);
      }

      .card-title-group {
        flex: 1;
        min-width: 0;
      }

      .card-name {
        font-weight: 700;
        font-size: var(--font-md);
        color: var(--color-text-primary);
      }

      .card-meta {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        margin-top: 2px;
      }

      .card-actions {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
      }

      .icon-btn {
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        padding: var(--spacing-xs);
        display: flex;
        align-items: center;
        border-radius: var(--radius-sm);
        transition: color var(--transition-fast);
      }

      .icon-btn:hover { color: var(--color-text-primary); }
      .icon-btn.delete:hover { color: var(--color-danger); }
      .icon-btn svg { width: 18px; height: 18px; }

      .result-chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
        padding: 0 var(--spacing-md) var(--spacing-md);
      }

      .result-chip {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px var(--spacing-sm);
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        font-size: var(--font-xs);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--color-text-secondary);
      }

      .result-chip .award-icon svg {
        width: 14px;
        height: 14px;
        display: block;
      }

      .empty-state {
        text-align: center;
        padding: var(--spacing-2xl);
        color: var(--color-text-muted);
      }

      /* Progress chart */
      .chart-section { margin-top: var(--spacing-lg); }

      .discipline-selector {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
        margin-bottom: var(--spacing-lg);
      }

      .disc-btn {
        padding: var(--spacing-xs) var(--spacing-md);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        background: var(--color-bg-surface);
        color: var(--color-text-secondary);
        font-size: var(--font-xs);
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: all var(--transition-fast);
      }

      .disc-btn.active {
        background: var(--color-accent);
        border-color: var(--color-accent);
        color: #fff;
      }

      .chart-container {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        overflow-x: auto;
      }

      .chart-svg { display: block; width: 100%; overflow: visible; }

      .chart-dot-group:hover .chart-tooltip { display: block; }
      .chart-tooltip { display: none; pointer-events: none; }

      .no-chart-data {
        text-align: center;
        padding: var(--spacing-xl);
        color: var(--color-text-muted);
        font-size: var(--font-sm);
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this._initFormResults();
    this._formDate = new Date().toISOString().split('T')[0];
    this._load().then(() => {
      // Check if we should open edit form for a specific competition
      const editId = sessionStorage.getItem('competitions:editId');
      if (editId) {
        sessionStorage.removeItem('competitions:editId');
        const comp = this._competitions.find((c) => c.id === editId);
        if (comp) this._openEditForm(comp);
      }
    });
  }

  private async _load(): Promise<void> {
    this._competitions = await getCompetitions();
    if (this._tab === 'progress') this._autoSelectDiscipline();
  }

  private _autoSelectDiscipline(): void {
    const found = ALL_DISCIPLINES.find((d) =>
      this._competitions.some((c) => c.results.some((r) => r.discipline === d)),
    );
    if (found) this._selectedDiscipline = found;
  }

  private _initFormResults(): void {
    const map = new Map<DisciplineKey, FormResult>();
    for (const d of ALL_DISCIPLINES) {
      map.set(d, { enabled: false, valueMin: 0, valueSec: 0, valueM: '', rank: '' });
    }
    this._formResults = map;
  }

  private _resetForm(): void {
    this._editingId = null;
    this._formName = '';
    this._formDate = new Date().toISOString().split('T')[0];
    this._formLocation = '';
    this._initFormResults();
  }

  private _openNewForm(): void {
    this._resetForm();
    this._showForm = true;
  }

  private _openEditForm(comp: Competition): void {
    this._editingId = comp.id;
    this._formName = comp.name;
    this._formDate = new Date(comp.date).toISOString().split('T')[0];
    this._formLocation = comp.location ?? '';

    const map = new Map<DisciplineKey, FormResult>();
    for (const d of ALL_DISCIPLINES) {
      const existing = comp.results.find((r) => r.discipline === d);
      if (existing) {
        const rank = existing.rank != null ? String(existing.rank) : '';
        if (isDurationDiscipline(d)) {
          map.set(d, {
            enabled: true,
            valueMin: Math.floor(existing.value / 60),
            valueSec: existing.value % 60,
            valueM: '',
            rank,
          });
        } else {
          map.set(d, {
            enabled: true,
            valueMin: 0,
            valueSec: 0,
            valueM: String(existing.value),
            rank,
          });
        }
      } else {
        map.set(d, { enabled: false, valueMin: 0, valueSec: 0, valueM: '', rank: '' });
      }
    }
    this._formResults = map;
    this._showForm = true;
  }

  private _toggleExpand(id: string): void {
    const next = new Set(this._expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this._expanded = next;
  }

  private _updateResult<K extends keyof FormResult>(
    disc: DisciplineKey,
    field: K,
    val: FormResult[K],
  ): void {
    const current = this._formResults.get(disc)!;
    const next = new Map(this._formResults);
    next.set(disc, { ...current, [field]: val });
    this._formResults = next;
  }

  private async _saveForm(): Promise<void> {
    if (!this._formName.trim() || !this._formDate) return;

    const results: DisciplineResult[] = [];
    for (const [disc, fr] of this._formResults) {
      if (!fr.enabled) continue;
      let value: number;
      if (isDurationDiscipline(disc)) {
        value = fr.valueMin * 60 + Math.max(0, Math.min(59, fr.valueSec));
        if (value <= 0) continue;
      } else {
        const m = parseFloat(fr.valueM);
        if (isNaN(m) || m <= 0) continue;
        value = m;
      }
      const rankNum = parseInt(fr.rank, 10);
      const result: DisciplineResult = { discipline: disc, value };
      if (!isNaN(rankNum) && rankNum > 0) result.rank = rankNum;
      results.push(result);
    }

    const id = this._editingId ?? `comp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const safeName = sanitizeText(this._formName);
    const safeLocation = sanitizeText(this._formLocation);
    const competition: Competition = {
      id,
      date: new Date(this._formDate).getTime(),
      name: safeName,
      results,
    };
    if (safeLocation) competition.location = safeLocation;

    await saveCompetition(competition);
    this._showForm = false;
    this._editingId = null;
    await this._load();
  }

  private async _delete(id: string): Promise<void> {
    await deleteCompetition(id);
    await this._load();
  }

  private _formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(getLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private _renderRankBadge(rank: number) {
    const color = rankColor(rank);
    if (rank <= 3) {
      return html`<span style="color:${color};display:flex;align-items:center" class="award-icon">${iconAward}</span>`;
    }
    return html`<span style="font-size:10px;color:var(--color-text-muted);font-weight:700">#${rank}</span>`;
  }

  private _renderDisciplineInput(disc: DisciplineKey, fr: FormResult) {
    if (!fr.enabled) return '';
    if (isDurationDiscipline(disc)) {
      return html`
        <div class="discipline-inputs">
          <div class="time-picker">
            <div class="time-picker-field">
              <input
                type="number"
                inputmode="numeric"
                min="0"
                max="99"
                .value=${String(fr.valueMin)}
                @change=${(e: Event) =>
                  this._updateResult(disc, 'valueMin', Math.max(0, parseInt((e.target as HTMLInputElement).value, 10) || 0))}
              />
              <span class="time-picker-unit">${msg('min')}</span>
            </div>
            <div class="time-picker-sep">:</div>
            <div class="time-picker-field">
              <input
                type="number"
                inputmode="numeric"
                min="0"
                max="59"
                .value=${String(fr.valueSec).padStart(2, '0')}
                @change=${(e: Event) =>
                  this._updateResult(disc, 'valueSec', Math.max(0, Math.min(59, parseInt((e.target as HTMLInputElement).value, 10) || 0)))}
              />
              <span class="time-picker-unit">${msg('sec')}</span>
            </div>
          </div>
          <div class="rank-field">
            <input
              type="number"
              inputmode="numeric"
              min="1"
              .value=${fr.rank}
              placeholder="—"
              @input=${(e: Event) =>
                this._updateResult(disc, 'rank', (e.target as HTMLInputElement).value)}
            />
            <span class="rank-label">${msg('Rank')}</span>
          </div>
        </div>
      `;
    }
    return html`
      <div class="discipline-inputs">
        <div class="meters-input">
          <input
            type="number"
            inputmode="decimal"
            min="0"
            step="0.5"
            .value=${fr.valueM}
            placeholder="0"
            @input=${(e: Event) =>
              this._updateResult(disc, 'valueM', (e.target as HTMLInputElement).value)}
          />
          <span class="meters-unit">m</span>
        </div>
        <div class="rank-field">
          <input
            type="number"
            inputmode="numeric"
            min="1"
            .value=${fr.rank}
            placeholder="—"
            @input=${(e: Event) =>
              this._updateResult(disc, 'rank', (e.target as HTMLInputElement).value)}
          />
          <span class="rank-label">${msg('Rank')}</span>
        </div>
      </div>
    `;
  }

  private _renderForm() {
    const isEdit = this._editingId !== null;
    return html`
      <div class="form-panel">
        <div class="form-title">
          ${isEdit ? msg('Edit Competition') : msg('New Competition')}
        </div>

        <div class="form-row">
          <label class="form-label">${msg('Competition Name')} *</label>
          <input
            class="form-input"
            type="text"
            maxlength=${MAX_TEXT_LENGTH}
            .value=${this._formName}
            placeholder=${msg('e.g. French Open 2025')}
            @input=${(e: Event) => { this._formName = (e.target as HTMLInputElement).value; }}
          />
        </div>

        <div class="form-row">
          <label class="form-label">${msg('Date')} *</label>
          <input
            class="form-input"
            type="date"
            .value=${this._formDate}
            @input=${(e: Event) => { this._formDate = (e.target as HTMLInputElement).value; }}
          />
        </div>

        <div class="form-row">
          <label class="form-label">${msg('Location')}</label>
          <input
            class="form-input"
            type="text"
            maxlength=${MAX_TEXT_LENGTH}
            .value=${this._formLocation}
            placeholder=${msg('e.g. Paris, France')}
            @input=${(e: Event) => { this._formLocation = (e.target as HTMLInputElement).value; }}
          />
        </div>

        <div class="form-row">
          <label class="form-label">${msg('Results')}</label>
          <div class="discipline-rows">
            ${ALL_DISCIPLINES.map((disc) => {
              const fr = this._formResults.get(disc)!;
              return html`
                <div class="discipline-row ${fr.enabled ? 'enabled' : ''}">
                  <div class="discipline-header">
                    <input
                      type="checkbox"
                      class="discipline-checkbox"
                      .checked=${fr.enabled}
                      @change=${(e: Event) =>
                        this._updateResult(disc, 'enabled', (e.target as HTMLInputElement).checked as FormResult['enabled'])}
                    />
                    <span class="discipline-abbr">${disc}</span>
                    <span class="discipline-name">${getDisciplineShortLabel(disc)}</span>
                  </div>
                  ${this._renderDisciplineInput(disc, fr)}
                </div>
              `;
            })}
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-secondary" @click=${() => { this._showForm = false; this._editingId = null; }}>
            ${msg('Cancel')}
          </button>
          <button
            class="btn btn-primary"
            @click=${this._saveForm}
            ?disabled=${!this._formName.trim() || !this._formDate}
          >
            ${isEdit ? msg('Save Changes') : msg('Save Competition')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderList() {
    return html`
      <button class="add-btn" @click=${this._openNewForm}>
        ${iconPlus} ${msg('Add Competition')}
      </button>

      ${this._showForm ? this._renderForm() : ''}

      ${this._competitions.length === 0 && !this._showForm
        ? html`<div class="empty-state">${msg('No competitions recorded yet.')}</div>`
        : this._competitions.map((c) => this._renderCard(c))}
    `;
  }

  private _renderCard(c: Competition) {
    const expanded = this._expanded.has(c.id);
    const visibleResults = expanded ? c.results : c.results.slice(0, 4);
    return html`
      <div class="competition-card">
        <div class="card-top">
          <div class="card-title-group">
            <div class="card-name">${c.name}</div>
            <div class="card-meta">
              ${this._formatDate(c.date)}${c.location ? html` · ${c.location}` : ''}
              · ${c.results.length} ${msg('disciplines')}
            </div>
          </div>
          <div class="card-actions">
            <button
              class="icon-btn"
              @click=${() => { this._openEditForm(c); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              aria-label=${msg('Edit')}
            >${iconEdit}</button>
            <button
              class="icon-btn"
              @click=${() => this._toggleExpand(c.id)}
              aria-label=${expanded ? msg('Collapse') : msg('Expand')}
            >${expanded ? iconChevronUp : iconChevronDown}</button>
            <button
              class="icon-btn delete"
              @click=${() => this._delete(c.id)}
              aria-label=${msg('Delete')}
            >${iconX}</button>
          </div>
        </div>

        <div class="result-chips">
          ${visibleResults.map((r) => html`
            <div class="result-chip">
              <span style="font-weight:700;color:var(--color-accent)">${r.discipline}</span>
              <span>${formatDisciplineValue(r.discipline, r.value)}</span>
              ${r.rank != null ? this._renderRankBadge(r.rank) : ''}
            </div>
          `)}
          ${!expanded && c.results.length > 4
            ? html`<div class="result-chip">+${c.results.length - 4}</div>`
            : ''}
        </div>
      </div>
    `;
  }

  private _renderProgress() {
    const disciplinesWithData = ALL_DISCIPLINES.filter((d) =>
      this._competitions.some((c) => c.results.some((r) => r.discipline === d)),
    );

    if (disciplinesWithData.length === 0) {
      return html`<div class="empty-state">${msg('Add competitions to see progress charts.')}</div>`;
    }

    if (!disciplinesWithData.includes(this._selectedDiscipline)) {
      this._selectedDiscipline = disciplinesWithData[0];
    }

    const points = this._competitions
      .filter((c) => c.results.some((r) => r.discipline === this._selectedDiscipline))
      .map((c) => {
        const result = c.results.find((r) => r.discipline === this._selectedDiscipline)!;
        return { date: c.date, value: result.value, name: c.name };
      })
      .sort((a, b) => a.date - b.date);

    return html`
      <div class="chart-section">
        <div class="discipline-selector">
          ${disciplinesWithData.map((d) => html`
            <button
              class="disc-btn ${this._selectedDiscipline === d ? 'active' : ''}"
              @click=${() => { this._selectedDiscipline = d; }}
            >${getDisciplineShortLabel(d)}</button>
          `)}
        </div>
        ${points.length < 2
          ? html`<div class="no-chart-data">${msg('Need at least 2 data points to show chart.')}</div>`
          : this._renderChart(points)}
      </div>
    `;
  }

  private _renderChart(points: Array<{ date: number; value: number; name: string }>) {
    const isDuration = isDurationDiscipline(this._selectedDiscipline);
    const W = 340, H = 160, padL = 54, padR = 16, padT = 16, padB = 36;
    const chartW = W - padL - padR, chartH = H - padT - padB;

    const values = points.map((p) => p.value);
    const minV = Math.min(...values), maxV = Math.max(...values);
    const rangeV = maxV - minV || 1;

    const dates = points.map((p) => p.date);
    const minD = Math.min(...dates), maxD = Math.max(...dates);
    const rangeD = maxD - minD || 1;

    const toX = (d: number) => padL + ((d - minD) / rangeD) * chartW;
    const toY = (v: number) => padT + chartH - ((v - minV) / rangeV) * chartH;

    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.date).toFixed(1)} ${toY(p.value).toFixed(1)}`)
      .join(' ');

    const yTicks = 4;
    const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => minV + (rangeV / yTicks) * i);
    const xTickCount = Math.min(points.length, 5);
    const xTickIndices = points.length <= 5
      ? points.map((_, i) => i)
      : Array.from({ length: xTickCount }, (_, i) =>
          Math.round((i / (xTickCount - 1)) * (points.length - 1)));
    const locale = getLocale();

    return html`
      <div class="chart-container">
        <svg class="chart-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
          ${yTickValues.map((v) => {
            const y = toY(v);
            return html`
              <line x1=${padL} y1=${y.toFixed(1)} x2=${W - padR} y2=${y.toFixed(1)}
                stroke="var(--color-border)" stroke-width="1" stroke-dasharray="4,3"/>
              <text x=${padL - 6} y=${y.toFixed(1)} text-anchor="end" dominant-baseline="middle"
                font-size="9" fill="var(--color-text-muted)" font-family="system-ui,sans-serif">
                ${isDuration ? formatTime(Math.round(v)) : `${Math.round(v)}m`}
              </text>
            `;
          })}
          ${xTickIndices.map((idx) => {
            const p = points[idx];
            const label = new Date(p.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
            return html`
              <text x=${toX(p.date).toFixed(1)} y=${H - 6} text-anchor="middle"
                font-size="9" fill="var(--color-text-muted)" font-family="system-ui,sans-serif">
                ${label}
              </text>
            `;
          })}
          <path d=${pathD} fill="none" stroke="var(--color-accent)" stroke-width="2"
            stroke-linejoin="round" stroke-linecap="round"/>
          ${points.map((p) => {
            const cx = toX(p.date).toFixed(1), cy = toY(p.value).toFixed(1);
            const label = `${p.name}: ${formatDisciplineValue(this._selectedDiscipline, p.value)}`;
            return html`
              <g class="chart-dot-group">
                <circle cx=${cx} cy=${cy} r="5" fill="var(--color-bg-primary)"
                  stroke="var(--color-accent)" stroke-width="2"/>
                <circle cx=${cx} cy=${cy} r="10" fill="transparent"/>
                <g class="chart-tooltip">
                  <rect x=${parseFloat(cx) - label.length * 3} y=${parseFloat(cy) - 30}
                    width=${label.length * 6 + 8} height="18" rx="4"
                    fill="var(--color-bg-surface)" stroke="var(--color-border)" stroke-width="1"/>
                  <text x=${cx} y=${parseFloat(cy) - 18} text-anchor="middle" font-size="9"
                    fill="var(--color-text-primary)" font-family="system-ui,sans-serif">
                    ${label}
                  </text>
                </g>
              </g>
            `;
          })}
        </svg>
      </div>
    `;
  }

  render() {
    return html`
      <div class="page">
        <div style="display:flex;align-items:center;gap:var(--spacing-sm);margin-bottom:var(--spacing-lg)">
          <span style="color:var(--color-accent);display:flex;align-items:center">${iconTrophy}</span>
          <h1 class="page-title" style="margin:0">${msg('Competitions')}</h1>
        </div>

        <div class="tabs">
          <button class="tab-btn ${this._tab === 'list' ? 'active' : ''}"
            @click=${() => { this._tab = 'list'; }}>
            ${msg('My Competitions')}
          </button>
          <button class="tab-btn ${this._tab === 'progress' ? 'active' : ''}"
            @click=${() => { this._tab = 'progress'; this._autoSelectDiscipline(); }}>
            ${msg('Progress')}
          </button>
        </div>

        ${this._tab === 'list' ? this._renderList() : this._renderProgress()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-competitions': AppCompetitions;
  }
}
