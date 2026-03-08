import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import {
  getSessions,
  getPBHistory,
  getCompetitions,
  getBreathingSessions,
  getFreeSessions,
  deleteSession,
  deletePBRecord,
  deleteCompetition,
  deleteBreathingSession,
  deleteFreeSession,
} from '../services/db.js';
import { formatTime } from '../services/tables.js';
import { formatDisciplineValue } from '../services/disciplines.js';
import { iconTrash, iconTrophy, iconEdit, iconBarChart2 } from '../components/icons.js';
import { getLocale } from '../localization.js';
import { navigate } from '../navigation.js';
import type { Session, PBRecord, Competition, BreathingSession, FreeSession } from '../types.js';

type FilterType = 'all' | 'training' | 'competitions' | 'pb';
type TrainingFilterType = 'all' | 'breathing' | 'co2' | 'o2' | 'free';

type TimelineEntry =
  | { kind: 'session'; date: number; data: Session }
  | { kind: 'pb'; date: number; data: PBRecord }
  | { kind: 'competition'; date: number; data: Competition }
  | { kind: 'breathing'; date: number; data: BreathingSession }
  | { kind: 'free'; date: number; data: FreeSession };

type TimelineGroup = {
  dayKey: number;
  label: string;
  entries: TimelineEntry[];
};

@localized()
@customElement('app-history')
export class AppHistory extends LitElement {
  @state() private _sessions: Session[] = [];
  @state() private _pbHistory: PBRecord[] = [];
  @state() private _competitions: Competition[] = [];
  @state() private _breathingSessions: BreathingSession[] = [];
  @state() private _freeSessions: FreeSession[] = [];
  @state() private _timelineEntries: TimelineEntry[] = [];
  @state() private _filter: FilterType = 'all';
  @state() private _trainingFilter: TrainingFilterType = 'all';
  @state() private _selectedEntryKey: string | null = null;

  private _formatLocale = '';
  private _dateFormatter: Intl.DateTimeFormat | null = null;
  private _dateCache = new Map<number, string>();

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

      .stat-card.training {
        grid-column: 1 / -1;
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

      .subfilters {
        display: flex;
        gap: var(--spacing-xs);
        margin: calc(-1 * var(--spacing-sm)) 0 var(--spacing-lg);
        overflow-x: auto;
        padding-bottom: 2px;
      }

      .subfilter-btn {
        padding: 6px 10px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        background: var(--color-bg-surface);
        color: var(--color-text-secondary);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        white-space: nowrap;
      }

      .subfilter-btn.active {
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 14%, var(--color-bg-surface));
        color: var(--color-accent);
      }

      /* Timeline */
      .timeline {
        position: relative;
        padding-left: var(--spacing-xl);
        display: grid;
        gap: var(--spacing-lg);
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

      .timeline-group {
        position: relative;
      }

      .timeline-date {
        position: relative;
        margin-bottom: var(--spacing-sm);
        font-size: var(--font-xs);
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-text-muted);
      }

      .timeline-date::before {
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

      .timeline-group-items {
        display: grid;
        gap: var(--spacing-sm);
      }

      /* Session card */
      .session-card {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        cursor: pointer;
        transition: border-color var(--transition-fast), background var(--transition-fast);
      }

      .session-card.selected,
      .pb-card.selected,
      .competition-card.selected {
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 10%, var(--color-bg-surface));
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
      .session-type.free { color: var(--color-accent); }
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
        cursor: pointer;
        transition: border-color var(--transition-fast), background var(--transition-fast);
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

      /* Competition card */
      .competition-card {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        cursor: pointer;
        transition: border-color var(--transition-fast), background var(--transition-fast);
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

      .entry-actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-md);
      }

      .entry-actions-main {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-sm);
      }

      .entry-actions .btn {
        min-height: 38px;
        padding: 9px 16px;
        font-size: var(--font-sm);
        white-space: nowrap;
      }

      .entry-actions .btn svg {
        width: 14px;
        height: 14px;
      }

      .entry-actions .btn-icon-only {
        padding: 9px 11px;
        min-width: 38px;
      }

      .entry-actions-delete {
        margin-left: auto;
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
    const [sessions, pbHistory, competitions, freeSessions] = await Promise.all([
      getSessions(100),
      getPBHistory(),
      getCompetitions(100),
      getFreeSessions(100),
    ]);
    this._sessions = sessions;
    this._pbHistory = pbHistory;
    this._competitions = competitions;
    this._freeSessions = freeSessions;
    // Guard against old IndexedDB versions that don't have the breathing-sessions store yet
    try {
      this._breathingSessions = await getBreathingSessions(100);
    } catch {
      this._breathingSessions = [];
    }
    this._rebuildTimeline();
  }

  private _rebuildTimeline(): void {
    const entries: TimelineEntry[] = [
      ...this._sessions.map((s): TimelineEntry => ({ kind: 'session', date: s.date, data: s })),
      ...this._pbHistory.map((p): TimelineEntry => ({ kind: 'pb', date: p.date, data: p })),
      ...this._competitions.map((c): TimelineEntry => ({ kind: 'competition', date: c.date, data: c })),
      ...this._breathingSessions.map((b): TimelineEntry => ({ kind: 'breathing', date: b.date, data: b })),
      ...this._freeSessions.map((f): TimelineEntry => ({ kind: 'free', date: f.date, data: f })),
    ];
    this._timelineEntries = entries.sort((a, b) => b.date - a.date);
  }

  private get _filtered(): TimelineEntry[] {
    const all = this._timelineEntries;
    if (this._filter === 'all') return all;
    if (this._filter === 'training') {
      return all.filter((entry) => this._isTrainingEntry(entry) && this._matchesTrainingFilter(entry));
    }
    if (this._filter === 'competitions') return all.filter((e) => e.kind === 'competition');
    if (this._filter === 'pb') {
      return all.filter((entry) => entry.kind === 'pb'
        || (entry.kind === 'session' && (entry.data as Session).type === 'pb-test'));
    }
    return all;
  }

  private _isTrainingEntry(entry: TimelineEntry): boolean {
    return entry.kind === 'breathing'
      || entry.kind === 'free'
      || (entry.kind === 'session' && (entry.data as Session).type !== 'pb-test');
  }

  private _matchesTrainingFilter(entry: TimelineEntry): boolean {
    if (this._trainingFilter === 'all') return true;
    if (this._trainingFilter === 'breathing') return entry.kind === 'breathing';
    if (this._trainingFilter === 'free') return entry.kind === 'free';
    return entry.kind === 'session' && (entry.data as Session).type === this._trainingFilter;
  }

  private _entryKey(entry: TimelineEntry): string {
    switch (entry.kind) {
      case 'session': return `session:${entry.data.id}`;
      case 'pb': return `pb:${entry.data.date}`;
      case 'competition': return `competition:${entry.data.id}`;
      case 'breathing': return `breathing:${entry.data.id}`;
      case 'free': return `free:${entry.data.id}`;
    }
  }

  private _toggleEntrySelection(key: string): void {
    this._selectedEntryKey = this._selectedEntryKey === key ? null : key;
  }

  private _ensureFormatters(): void {
    const locale = getLocale();
    if (locale === this._formatLocale && this._dateFormatter) return;

    this._formatLocale = locale;
    this._dateFormatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    this._dateCache.clear();
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

  private async _deleteFreeSession(id: string): Promise<void> {
    await deleteFreeSession(id);
    await this._load();
  }

  private async _deletePB(date: number): Promise<void> {
    await deletePBRecord(date);
    await this._load();
  }

  private _formatDateShort(ts: number): string {
    this._ensureFormatters();
    const cached = this._dateCache.get(ts);
    if (cached) return cached;

    const formatted = this._dateFormatter!.format(new Date(ts));
    this._dateCache.set(ts, formatted);
    return formatted;
  }

  private _getDayKey(ts: number): number {
    const day = new Date(ts);
    day.setHours(0, 0, 0, 0);
    return day.getTime();
  }

  private _groupEntries(entries: TimelineEntry[]): TimelineGroup[] {
    const groups: TimelineGroup[] = [];

    for (const entry of entries) {
      const dayKey = this._getDayKey(entry.date);
      const currentGroup = groups.at(-1);

      if (!currentGroup || currentGroup.dayKey !== dayKey) {
        groups.push({
          dayKey,
          label: this._formatDateShort(entry.date),
          entries: [entry],
        });
        continue;
      }

      currentGroup.entries.push(entry);
    }

    return groups;
  }

  private _renderEntryActions(deleteAction: () => Promise<void>, editAction?: () => void) {
    return html`
      <div class="entry-actions">
        <div class="entry-actions-main">
          ${editAction ? html`
            <button class="btn btn-secondary" @click=${(event: Event) => { event.stopPropagation(); editAction(); }}>
              ${iconEdit} ${msg('Edit')}
            </button>
          ` : ''}
        </div>
        <button
          class="btn btn-danger btn-icon-only entry-actions-delete"
          title=${msg('Delete')}
          aria-label=${msg('Delete')}
          @click=${async (event: Event) => {
            event.stopPropagation();
            await deleteAction();
            this._selectedEntryKey = null;
          }}
        >
          ${iconTrash}
        </button>
      </div>
    `;
  }

  private _renderSession(s: Session, selected: boolean) {
    return html`
      <div class="session-card ${selected ? 'selected' : ''}">
        <div class="card-top">
          <div>
            <span class="session-type ${s.type}">${s.type.toUpperCase()}</span>
            <span class="session-status ${s.completed ? 'completed' : 'incomplete'}">
              ${s.completed ? msg('Completed') : msg('Stopped')}
            </span>
          </div>
        </div>
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
        ${selected ? this._renderEntryActions(() => this._deleteSession(s.id)) : ''}
      </div>
    `;
  }

  private _renderBreathingSession(b: BreathingSession, selected: boolean) {
    return html`
      <div class="session-card ${selected ? 'selected' : ''}">
        <div class="card-top">
          <div>
            <span class="session-type" style="color:var(--color-rest)">
              ${msg('Breathing')}
            </span>
            <span class="session-status ${b.completed ? 'completed' : 'incomplete'}">
              ${b.completed ? msg('Completed') : msg('Stopped')}
            </span>
          </div>
        </div>
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
        ${selected ? this._renderEntryActions(() => this._deleteBreathingSession(b.id)) : ''}
      </div>
    `;
  }

  private _renderFreeSession(s: FreeSession, selected: boolean) {
    return html`
      <div class="session-card ${selected ? 'selected' : ''}">
        <div class="card-top">
          <div>
            <span class="session-type free">${msg('Free', { id: 'free-tab' })}</span>
            <span class="session-status ${s.completed ? 'completed' : 'incomplete'}">
              ${s.completed ? msg('Completed') : msg('Stopped')}
            </span>
          </div>
        </div>
        <div class="card-details">
          <div>
            <div class="detail-label">${msg('Program')}</div>
            <div class="detail-value">${s.presetName}</div>
          </div>
          <div>
            <div class="detail-label">${msg('Rounds')}</div>
            <div class="detail-value">${s.completedRounds}/${s.totalRounds}</div>
          </div>
          <div>
            <div class="detail-label">${msg('Duration')}</div>
            <div class="detail-value">${formatTime(s.totalDuration)}</div>
          </div>
        </div>
        ${selected ? this._renderEntryActions(() => this._deleteFreeSession(s.id)) : ''}
      </div>
    `;
  }

  private _renderPB(pb: PBRecord, selected: boolean) {
    return html`
      <div class="pb-card ${selected ? 'selected' : ''}">
        <div class="pb-row">
          <span class="session-type pb-test">${msg('PB')}</span>
          <span class="pb-value">${formatTime(pb.value)}</span>
          <span class="pb-source">${pb.source}</span>
        </div>
        ${selected ? this._renderEntryActions(() => this._deletePB(pb.date)) : ''}
      </div>
    `;
  }

  private _renderCompetition(c: Competition, selected: boolean) {
    return html`
      <div class="competition-card ${selected ? 'selected' : ''}">
        <div class="card-top">
          <div class="comp-header">
            <span class="comp-icon">${iconTrophy}</span>
            <span class="comp-name">${c.name}</span>
          </div>
        </div>
        ${c.location ? html`<div class="comp-meta">${c.location}</div>` : ''}
        <div class="result-chips">
          ${c.results.map((r) => html`
            <div class="result-chip">
              <span style="font-weight:700;color:var(--color-accent)">${r.discipline}</span>
              <span>${formatDisciplineValue(r.discipline, r.value)}</span>
              ${r.rank != null ? html`<span style="color:var(--color-text-muted);font-size:10px">#${r.rank}</span>` : ''}
            </div>
          `)}
        </div>
        ${selected ? this._renderEntryActions(() => this._deleteCompetition(c.id), () => this._editCompetition(c.id)) : ''}
      </div>
    `;
  }

  private _renderEntry(entry: TimelineEntry) {
    const key = this._entryKey(entry);
    const selected = this._selectedEntryKey === key;
    return html`
      <div class="timeline-entry" @click=${() => this._toggleEntrySelection(key)}>
        ${entry.kind === 'session'
          ? this._renderSession(entry.data as Session, selected)
          : entry.kind === 'pb'
          ? this._renderPB(entry.data as PBRecord, selected)
          : entry.kind === 'breathing'
          ? this._renderBreathingSession(entry.data as BreathingSession, selected)
          : entry.kind === 'free'
          ? this._renderFreeSession(entry.data as FreeSession, selected)
          : this._renderCompetition(entry.data as Competition, selected)}
      </div>
    `;
  }

  render() {
    const entries = this._filtered;
    const groups = this._groupEntries(entries);
    const totalTraining = this._sessions.filter((session) => session.type !== 'pb-test').length
      + this._breathingSessions.length
      + this._freeSessions.length;
    const totalComps = this._competitions.length;
    const totalPB = this._pbHistory.length
      + this._sessions.filter((session) => session.type === 'pb-test').length;

    return html`
      <div class="page">
        <div style="display:flex;align-items:center;gap:var(--spacing-sm);margin-bottom:var(--spacing-lg)">
          <span style="color:var(--color-accent);display:flex;align-items:center">${iconBarChart2}</span>
          <h1 class="page-title" style="margin:0">${msg('History')}</h1>
        </div>

        <div class="stats-grid">
          <div class="stat-card training">
            <div class="stat-value">${totalTraining}</div>
            <div class="stat-label">${msg('Training')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${totalComps}</div>
            <div class="stat-label">${msg('Competitions')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${totalPB}</div>
            <div class="stat-label">${msg('PB')}</div>
          </div>
        </div>

        <div class="tabs">
          <button
            class="tab-btn ${this._filter === 'all' ? 'active' : ''}"
            @click=${() => { this._filter = 'all'; }}
          >${msg('All')}</button>
          <button
            class="tab-btn ${this._filter === 'training' ? 'active' : ''}"
            @click=${() => {
              this._filter = 'training';
              this._trainingFilter = 'all';
            }}
          >${msg('Training')}</button>
          <button
            class="tab-btn ${this._filter === 'competitions' ? 'active' : ''}"
            @click=${() => { this._filter = 'competitions'; }}
          >${msg('Competitions')}</button>
          <button
            class="tab-btn ${this._filter === 'pb' ? 'active' : ''}"
            @click=${() => { this._filter = 'pb'; }}
          >${msg('PB')}</button>
        </div>

        ${this._filter === 'training'
          ? html`
              <div class="subfilters">
                <button
                  class="subfilter-btn ${this._trainingFilter === 'all' ? 'active' : ''}"
                  @click=${() => { this._trainingFilter = 'all'; }}
                >${msg('All')}</button>
                <button
                  class="subfilter-btn ${this._trainingFilter === 'breathing' ? 'active' : ''}"
                  @click=${() => { this._trainingFilter = 'breathing'; }}
                >${msg('Breathing')}</button>
                <button
                  class="subfilter-btn ${this._trainingFilter === 'co2' ? 'active' : ''}"
                  @click=${() => { this._trainingFilter = 'co2'; }}
                >${msg('CO2')}</button>
                <button
                  class="subfilter-btn ${this._trainingFilter === 'o2' ? 'active' : ''}"
                  @click=${() => { this._trainingFilter = 'o2'; }}
                >${msg('O2')}</button>
                <button
                  class="subfilter-btn ${this._trainingFilter === 'free' ? 'active' : ''}"
                  @click=${() => { this._trainingFilter = 'free'; }}
                >${msg('Free', { id: 'free-tab' })}</button>
              </div>
            `
          : ''}

        ${entries.length === 0
          ? html`<div class="empty-state">${msg('Nothing here yet.')}</div>`
          : html`
              <div class="timeline">
                ${groups.map((group) => html`
                  <section class="timeline-group">
                    <div class="timeline-date">${group.label}</div>
                    <div class="timeline-group-items">
                      ${group.entries.map((entry) => this._renderEntry(entry))}
                    </div>
                  </section>
                `)}
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
