import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import { getSessions, getPBHistory, deleteSession } from '../services/db.js';
import { formatTime } from '../services/tables.js';
import { iconX } from '../components/icons.js';
import { getLocale } from '../localization.js';
import type { Session, PBRecord } from '../types.js';

@localized()
@customElement('app-history')
export class AppHistory extends LitElement {
  @state() private _sessions: Session[] = [];
  @state() private _pbHistory: PBRecord[] = [];
  @state() private _tab: 'sessions' | 'pb' = 'sessions';

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

      .session-card {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        margin-bottom: var(--spacing-sm);
      }

      .session-top {
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

      .session-date {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
      }

      .session-details {
        display: flex;
        gap: var(--spacing-lg);
        font-size: var(--font-sm);
        color: var(--color-text-secondary);
      }

      .session-detail-label {
        color: var(--color-text-muted);
        font-size: var(--font-xs);
      }

      .session-detail-value {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }

      .session-status {
        font-size: var(--font-xs);
        padding: 2px 8px;
        border-radius: var(--radius-full);
        font-weight: 600;
      }

      .session-status.completed {
        background: rgba(102, 187, 106, 0.15);
        color: var(--color-success);
      }

      .session-status.incomplete {
        background: rgba(255, 152, 0, 0.15);
        color: var(--color-hold);
      }

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

      .delete-btn svg {
        width: 16px;
        height: 16px;
      }

      .delete-btn:hover {
        color: var(--color-danger);
      }

      .pb-timeline {
        position: relative;
        padding-left: var(--spacing-xl);
      }

      .pb-timeline::before {
        content: '';
        position: absolute;
        left: 8px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--color-border);
      }

      .pb-entry {
        position: relative;
        padding: var(--spacing-md);
        margin-bottom: var(--spacing-md);
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
      }

      .pb-entry::before {
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

      .pb-value {
        font-size: var(--font-xl);
        font-weight: 800;
        color: var(--color-accent);
        font-variant-numeric: tabular-nums;
      }

      .pb-date {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        margin-top: var(--spacing-xs);
      }

      .pb-source {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        text-transform: uppercase;
      }

      .empty-state {
        text-align: center;
        padding: var(--spacing-2xl);
        color: var(--color-text-muted);
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-xl);
      }

      .stat-card {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        text-align: center;
      }

      .stat-card .stat-value {
        font-size: var(--font-xl);
        font-weight: 800;
        color: var(--color-text-primary);
      }

      .stat-card .stat-label {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-top: var(--spacing-xs);
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this._load();
  }

  private async _load(): Promise<void> {
    this._sessions = await getSessions(50);
    this._pbHistory = await getPBHistory();
  }

  private async _deleteSession(id: string): Promise<void> {
    await deleteSession(id);
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

  render() {
    const co2Count = this._sessions.filter((s) => s.type === 'co2').length;
    const o2Count = this._sessions.filter((s) => s.type === 'o2').length;

    return html`
      <div class="page">
        <h1 class="page-title">${msg('History')}</h1>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${this._sessions.length}</div>
            <div class="stat-label">${msg('Total')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${co2Count}</div>
            <div class="stat-label">CO2</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${o2Count}</div>
            <div class="stat-label">O2</div>
          </div>
        </div>

        <div class="tabs">
          <button
            class="tab-btn ${this._tab === 'sessions' ? 'active' : ''}"
            @click=${() => (this._tab = 'sessions')}
          >
            ${msg('Sessions')}
          </button>
          <button
            class="tab-btn ${this._tab === 'pb' ? 'active' : ''}"
            @click=${() => (this._tab = 'pb')}
          >
            ${msg('PB Progress')}
          </button>
        </div>

        ${this._tab === 'sessions' ? this._renderSessions() : this._renderPBHistory()}
      </div>
    `;
  }

  private _renderSessions() {
    if (this._sessions.length === 0) {
      return html`<div class="empty-state">${msg('No sessions recorded yet.')}</div>`;
    }

    return html`
      ${this._sessions.map(
        (s) => html`
          <div class="session-card">
            <div class="session-top">
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
            <div class="session-date">${this._formatDate(s.date)}</div>
            <div class="session-details">
              ${s.type === 'pb-test' && s.personalBest
                ? html`
                    <div>
                      <div class="session-detail-label">${msg('PB Result')}</div>
                      <div class="session-detail-value">${formatTime(s.personalBest)}</div>
                    </div>
                  `
                : html`
                    <div>
                      <div class="session-detail-label">${msg('Rounds')}</div>
                      <div class="session-detail-value">
                        ${s.rounds.filter((r) => r.completed).length}/${s.rounds.length}
                      </div>
                    </div>
                    <div>
                      <div class="session-detail-label">${msg('Contractions')}</div>
                      <div class="session-detail-value">
                        ${s.rounds.reduce((sum, r) => sum + r.contractions.length, 0)}
                      </div>
                    </div>
                  `}
            </div>
          </div>
        `,
      )}
    `;
  }

  private _renderPBHistory() {
    if (this._pbHistory.length === 0) {
      return html`<div class="empty-state">${msg('No PB records yet. Take a PB test to get started.')}</div>`;
    }

    return html`
      <div class="pb-timeline">
        ${[...this._pbHistory].reverse().map(
          (pb) => html`
            <div class="pb-entry">
              <div class="pb-value">${formatTime(pb.value)}</div>
              <div class="pb-date">${this._formatDate(pb.date)}</div>
              <div class="pb-source">${pb.source}</div>
            </div>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-history': AppHistory;
  }
}
