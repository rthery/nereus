import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import {
  getSessions,
  getPBHistory,
  getCompetitions,
  getBreathingSessions,
  deleteSession,
  deletePBRecord,
  deleteCompetition,
  deleteBreathingSession,
  savePB,
} from '../services/db.js';
import { formatTime } from '../services/tables.js';
import { formatDisciplineValue } from '../services/disciplines.js';
import { iconX, iconTrophy, iconEdit, iconBarChart2 } from '../components/icons.js';
import { getLocale } from '../localization.js';
import { navigate } from '../navigation.js';
import type { Session, PBRecord, Competition, BreathingSession } from '../types.js';

type FilterType = 'all' | 'training' | 'breathing' | 'competitions' | 'pb';

type TimelineEntry =
  | { kind: 'session'; date: number; data: Session }
  | { kind: 'pb'; date: number; data: PBRecord }
  | { kind: 'competition'; date: number; data: Competition }
  | { kind: 'breathing'; date: number; data: BreathingSession };

@localized()
@customElement('app-history')
export class AppHistory extends LitElement {
  @state() private _sessions: Session[] = [];
  @state() private _pbHistory: PBRecord[] = [];
  @state() private _competitions: Competition[] = [];
  @state() private _breathingSessions: BreathingSession[] = [];
  @state() private _filter: FilterType = 'all';
  @state() private _editingPBDate: number | null = null;
  @state() private _editPBMin = 0;
  @state() private _editPBSec = 0;

  static styles = [
    sharedStyles,
    css`
      .page {
        padding: var(--spacing-lg);
        max-width: 800px;
        margin: 0 auto;
        padding-bottom: calc(var(--nav-height) + var(--spacing-xl));
        overflow-x: hidden;
      }

      .page-title {
        font-size: var(--font-xl);
        font-weight: 800;
        margin-bottom: var(--spacing-lg);
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
      }

      .stat-card {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-sm) var(--spacing-xs);
        text-align: center;
        min-width: 0;
      }

      .stat-card .stat-value {
        font-size: var(--font-lg);
        font-weight: 800;
        color: var(--color-text-primary);
      }

      .stat-card .stat-label {
        font-size: 10px;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-top: var(--spacing-xs);
        word-break: break-word;
      }

      .tabs {
        display: flex;
        gap: var(--spacing-xs);
        margin-bottom: var(--spacing-lg);
        background: var(--color-bg-surface);
        border-radius: var(--radius-full);
        padding: 3px;
        border: 1px solid var(--color-border);
        overflow-x: auto;
      }

      .tab-btn {
        flex: 1;
        padding: var(--spacing-sm) var(--spacing-sm);
        border: none;
        border-radius: var(--radius-full);
        background: transparent;
        color: var(--color-text-secondary);
        font-size: var(--font-xs);
        font-weight: 600;
        cursor: pointer;
        transition: all var(--transition-fast);
        font-family: inherit;
        white-space: nowrap;
      }

      .tab-btn.active {
        background: var(--color-accent);
        color: #fff;
      }

      /* Timeline */
      .timeline {
        position: relative;
        padding-left: var(--spacing-xl);
      }

      .timeline::before {
        content: '';
        position: absolute;
        left: 8px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--color-border);
      }

      .timeline-entry {
        position: relative;
        margin-bottom: var(--spacing-md);
      }

      .timeline-entry::before {
        content: '';
        position: absolute;
        left: calc(-1 * var(--spacing-xl) + 4px);
        top: 50%;
        transform: translateY(-50%);
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--color-accent);
        border: 2px solid var(--color-bg-primary);
      }

      .timeline-entry.session-co2::before { background: var(--color-hold); }
      .timeline-entry.session-o2::before { background: var(--color-breathe); }
      .timeline-entry.session-pb::before { background: var(--color-accent); }
      .timeline-entry.breathing::before { background: var(--color-rest); opacity: 0.7; }
      .timeline-entry.competition::before {
        background: var(--color-accent);
        width: 12px;
        height: 12px;
        left: calc(-1 * var(--spacing-xl) + 3px);
      }

      /* Session card */
      .session-card {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
      }

      .card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-sm);
      }

      .session-type {
        font-weight: 700;
        font-size: var(--font-sm);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .session-type.co2 { color: var(--color-hold); }
      .session-type.o2 { color: var(--color-breathe); }
      .session-type.pb-test { color: var(--color-accent); }

      .session-status {
        font-size: var(--font-xs);
        padding: 2px 8px;
        border-radius: var(--radius-full);
        font-weight: 600;
        margin-left: var(--spacing-xs);
      }

      .session-status.completed {
        background: rgba(102, 187, 106, 0.15);
        color: var(--color-success);
      }

      .session-status.incomplete {
        background: rgba(255, 152, 0, 0.15);
        color: var(--color-hold);
      }

      .card-date {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
      }

      .card-details {
        display: flex;
        gap: var(--spacing-lg);
        font-size: var(--font-sm);
        color: var(--color-text-secondary);
      }

      .detail-label {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
      }

      .detail-value {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }

      /* PB card */
      .pb-card {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-sm) var(--spacing-md);
      }

      .pb-row {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }

      .pb-value {
        font-size: var(--font-lg);
        font-weight: 800;
        color: var(--color-accent);
        font-variant-numeric: tabular-nums;
        flex: 1;
      }

      .pb-source {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        text-transform: uppercase;
      }

      .pb-edit-form {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-sm);
        padding-top: var(--spacing-sm);
        border-top: 1px solid var(--color-border);
      }

      .time-picker {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .time-picker input {
        width: 48px;
        padding: var(--spacing-xs);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: var(--color-bg-primary);
        color: var(--color-text-primary);
        font-size: var(--font-sm);
        font-weight: 600;
        text-align: center;
        font-variant-numeric: tabular-nums;
        font-family: inherit;
      }

      .time-sep {
        font-weight: 700;
        color: var(--color-text-secondary);
      }

      .time-unit {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
      }

      .save-btn {
        padding: var(--spacing-xs) var(--spacing-sm);
        background: var(--color-accent);
        color: #fff;
        border: none;
        border-radius: var(--radius-sm);
        font-size: var(--font-xs);
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        white-space: nowrap;
      }

      .cancel-btn {
        padding: var(--spacing-xs) var(--spacing-sm);
        background: transparent;
        color: var(--color-text-muted);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        font-size: var(--font-xs);
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
      }

      /* Competition card */
      .competition-card {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
      }

      .comp-header {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-xs);
      }

      .comp-icon {
        color: var(--color-accent);
        display: flex;
        align-items: center;
        flex-shrink: 0;
      }

      .comp-icon svg { width: 18px; height: 18px; }

      .comp-name {
        font-weight: 700;
        font-size: var(--font-md);
      }

      .comp-meta {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        margin-bottom: var(--spacing-sm);
      }

      .result-chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
      }

      .result-chip {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 3px var(--spacing-sm);
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        font-size: var(--font-xs);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--color-text-secondary);
      }

      /* Delete btn */
      .delete-btn {
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        padding: var(--spacing-xs);
        font-family: inherit;
        display: flex;
        align-items: center;
      }

      .delete-btn svg { width: 16px; height: 16px; }
      .delete-btn:hover { color: var(--color-danger); }

      .edit-btn {
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        padding: var(--spacing-xs);
        font-family: inherit;
        display: flex;
        align-items: center;
      }

      .edit-btn svg { width: 16px; height: 16px; }
      .edit-btn:hover { color: var(--color-accent); }

      .card-actions {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
      }

      .empty-state {
        text-align: center;
        padding: var(--spacing-2xl);
        color: var(--color-text-muted);
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this._load();
  }

  private async _load(): Promise<void> {
    const [sessions, pbHistory, competitions] = await Promise.all([
      getSessions(100),
      getPBHistory(),
      getCompetitions(100),
    ]);
    this._sessions = sessions;
    this._pbHistory = pbHistory;
    this._competitions = competitions;
    // Guard against old IndexedDB versions that don't have the breathing-sessions store yet
    try {
      this._breathingSessions = await getBreathingSessions(100);
    } catch {
      this._breathingSessions = [];
    }
  }

  private get _timeline(): TimelineEntry[] {
    const entries: TimelineEntry[] = [
      ...this._sessions.map((s): TimelineEntry => ({ kind: 'session', date: s.date, data: s })),
      ...this._pbHistory.map((p): TimelineEntry => ({ kind: 'pb', date: p.date, data: p })),
      ...this._competitions.map((c): TimelineEntry => ({ kind: 'competition', date: c.date, data: c })),
      ...this._breathingSessions.map((b): TimelineEntry => ({ kind: 'breathing', date: b.date, data: b })),
    ];
    return entries.sort((a, b) => b.date - a.date);
  }

  private get _filtered(): TimelineEntry[] {
    const all = this._timeline;
    if (this._filter === 'all') return all;
    if (this._filter === 'training') return all.filter((e) => e.kind === 'session');
    if (this._filter === 'breathing') return all.filter((e) => e.kind === 'breathing');
    if (this._filter === 'competitions') return all.filter((e) => e.kind === 'competition');
    if (this._filter === 'pb') return all.filter((e) => e.kind === 'pb');
    return all;
  }

  private async _deleteSession(id: string): Promise<void> {
    await deleteSession(id);
    await this._load();
  }

  private async _deleteCompetition(id: string): Promise<void> {
    await deleteCompetition(id);
    await this._load();
  }

  private _editCompetition(id: string): void {
    sessionStorage.setItem('competitions:editId', id);
    navigate('/competitions');
  }

  private async _deleteBreathingSession(id: string): Promise<void> {
    await deleteBreathingSession(id);
    await this._load();
  }

  private async _deletePB(date: number): Promise<void> {
    await deletePBRecord(date);
    await this._load();
  }

  private _startEditPB(pb: PBRecord): void {
    this._editingPBDate = pb.date;
    this._editPBMin = Math.floor(pb.value / 60);
    this._editPBSec = pb.value % 60;
  }

  private async _saveEditPB(pb: PBRecord): Promise<void> {
    const newValue = this._editPBMin * 60 + this._editPBSec;
    if (newValue > 0) {
      await savePB({ ...pb, value: newValue });
    }
    this._editingPBDate = null;
    await this._load();
  }

  private _formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(getLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private _formatDateShort(ts: number): string {
    return new Date(ts).toLocaleDateString(getLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private _renderSession(s: Session) {
    return html`
      <div class="session-card">
        <div class="card-top">
          <div>
            <span class="session-type ${s.type}">${s.type.toUpperCase()}</span>
            <span class="session-status ${s.completed ? 'completed' : 'incomplete'}">
              ${s.completed ? msg('Completed') : msg('Stopped')}
            </span>
          </div>
          <button class="delete-btn" @click=${() => this._deleteSession(s.id)}>
            ${iconX}
          </button>
        </div>
        <div class="card-date">${this._formatDate(s.date)}</div>
        <div class="card-details">
          ${s.type === 'pb-test' && s.personalBest
            ? html`
                <div>
                  <div class="detail-label">${msg('PB Result')}</div>
                  <div class="detail-value">${formatTime(s.personalBest)}</div>
                </div>
              `
            : html`
                <div>
                  <div class="detail-label">${msg('Rounds')}</div>
                  <div class="detail-value">
                    ${s.rounds.filter((r) => r.completed).length}/${s.rounds.length}
                  </div>
                </div>
                <div>
                  <div class="detail-label">${msg('Contractions')}</div>
                  <div class="detail-value">
                    ${s.rounds.reduce((sum, r) => sum + r.contractions.length, 0)}
                  </div>
                </div>
              `}
        </div>
      </div>
    `;
  }

  private _renderBreathingSession(b: BreathingSession) {
    return html`
      <div class="session-card">
        <div class="card-top">
          <div>
            <span class="session-type" style="color:var(--color-rest)">
              ${msg('Breathing')}
            </span>
            <span class="session-status ${b.completed ? 'completed' : 'incomplete'}">
              ${b.completed ? msg('Completed') : msg('Stopped')}
            </span>
          </div>
          <button class="delete-btn" @click=${() => this._deleteBreathingSession(b.id)}>
            ${iconX}
          </button>
        </div>
        <div class="card-date">${this._formatDate(b.date)}</div>
        <div class="card-details">
          <div>
            <div class="detail-label">${msg('Program')}</div>
            <div class="detail-value">${b.presetName}</div>
          </div>
          <div>
            <div class="detail-label">${msg('Cycles')}</div>
            <div class="detail-value">${b.completedCycles}</div>
          </div>
          <div>
            <div class="detail-label">${msg('Duration')}</div>
            <div class="detail-value">${formatTime(b.totalDuration)}</div>
          </div>
        </div>
      </div>
    `;
  }

  private _renderPB(pb: PBRecord) {
    const isEditing = this._editingPBDate === pb.date;
    return html`
      <div class="pb-card">
        <div class="pb-row">
          <span class="session-type pb-test">${msg('PB')}</span>
          <span class="pb-value">${formatTime(pb.value)}</span>
          <span class="pb-source">${pb.source}</span>
          <span class="card-date">${this._formatDate(pb.date)}</span>
          <div class="card-actions">
            ${pb.source === 'manual' && !isEditing
              ? html`<button class="edit-btn" @click=${() => this._startEditPB(pb)}>${iconEdit}</button>`
              : ''}
            <button class="delete-btn" @click=${() => this._deletePB(pb.date)}>${iconX}</button>
          </div>
        </div>
        ${isEditing
          ? html`
              <div class="pb-edit-form">
                <div class="time-picker">
                  <input
                    type="number" inputmode="numeric" min="0" max="59"
                    .value=${String(this._editPBMin)}
                    @input=${(e: Event) => { this._editPBMin = parseInt((e.target as HTMLInputElement).value, 10) || 0; }}
                  />
                  <span class="time-sep">:</span>
                  <input
                    type="number" inputmode="numeric" min="0" max="59"
                    .value=${String(this._editPBSec).padStart(2, '0')}
                    @input=${(e: Event) => { this._editPBSec = Math.max(0, Math.min(59, parseInt((e.target as HTMLInputElement).value, 10) || 0)); }}
                  />
                </div>
                <span class="time-unit">${msg('min : sec')}</span>
                <button class="save-btn" @click=${() => this._saveEditPB(pb)}>${msg('Save')}</button>
                <button class="cancel-btn" @click=${() => { this._editingPBDate = null; }}>${msg('Cancel')}</button>
              </div>
            `
          : ''}
      </div>
    `;
  }

  private _renderCompetition(c: Competition) {
    return html`
      <div class="competition-card">
        <div class="card-top">
          <div class="comp-header">
            <span class="comp-icon">${iconTrophy}</span>
            <span class="comp-name">${c.name}</span>
          </div>
          <div class="card-actions">
            <button class="edit-btn" @click=${() => this._editCompetition(c.id)}>
              ${iconEdit}
            </button>
            <button class="delete-btn" @click=${() => this._deleteCompetition(c.id)}>
              ${iconX}
            </button>
          </div>
        </div>
        <div class="comp-meta">
          ${this._formatDateShort(c.date)}${c.location ? html` · ${c.location}` : ''}
        </div>
        <div class="result-chips">
          ${c.results.map((r) => html`
            <div class="result-chip">
              <span style="font-weight:700;color:var(--color-accent)">${r.discipline}</span>
              <span>${formatDisciplineValue(r.discipline, r.value)}</span>
              ${r.rank != null ? html`<span style="color:var(--color-text-muted);font-size:10px">#${r.rank}</span>` : ''}
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private _renderEntry(entry: TimelineEntry) {
    let typeClass = '';
    if (entry.kind === 'session') {
      const s = entry.data as Session;
      typeClass = `session-${s.type}`;
    } else if (entry.kind === 'competition') {
      typeClass = 'competition';
    } else if (entry.kind === 'breathing') {
      typeClass = 'breathing';
    }

    return html`
      <div class="timeline-entry ${typeClass}">
        ${entry.kind === 'session'
          ? this._renderSession(entry.data as Session)
          : entry.kind === 'pb'
          ? this._renderPB(entry.data as PBRecord)
          : entry.kind === 'breathing'
          ? this._renderBreathingSession(entry.data as BreathingSession)
          : this._renderCompetition(entry.data as Competition)}
      </div>
    `;
  }

  render() {
    const entries = this._filtered;
    const totalSessions = this._sessions.length;
    const totalComps = this._competitions.length;

    return html`
      <div class="page">
        <div style="display:flex;align-items:center;gap:var(--spacing-sm);margin-bottom:var(--spacing-lg)">
          <span style="color:var(--color-accent);display:flex;align-items:center">${iconBarChart2}</span>
          <h1 class="page-title" style="margin:0">${msg('History')}</h1>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${totalSessions}</div>
            <div class="stat-label">${msg('Sessions')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${this._breathingSessions.length}</div>
            <div class="stat-label">${msg('Breathing')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${totalComps}</div>
            <div class="stat-label">${msg('Competitions')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${this._pbHistory.length}</div>
            <div class="stat-label">${msg('PB Records')}</div>
          </div>
        </div>

        <div class="tabs">
          <button
            class="tab-btn ${this._filter === 'all' ? 'active' : ''}"
            @click=${() => { this._filter = 'all'; }}
          >${msg('All')}</button>
          <button
            class="tab-btn ${this._filter === 'training' ? 'active' : ''}"
            @click=${() => { this._filter = 'training'; }}
          >${msg('Training')}</button>
          <button
            class="tab-btn ${this._filter === 'breathing' ? 'active' : ''}"
            @click=${() => { this._filter = 'breathing'; }}
          >${msg('Breathing')}</button>
          <button
            class="tab-btn ${this._filter === 'competitions' ? 'active' : ''}"
            @click=${() => { this._filter = 'competitions'; }}
          >${msg('Competitions')}</button>
          <button
            class="tab-btn ${this._filter === 'pb' ? 'active' : ''}"
            @click=${() => { this._filter = 'pb'; }}
          >${msg('PB')}</button>
        </div>

        ${entries.length === 0
          ? html`<div class="empty-state">${msg('Nothing here yet.')}</div>`
          : html`
              <div class="timeline">
                ${entries.map((e) => this._renderEntry(e))}
              </div>
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-history': AppHistory;
  }
}
