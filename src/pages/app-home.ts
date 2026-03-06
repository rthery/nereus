import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import { getSettings, getSessions, getCompetitions } from '../services/db.js';
import { formatTime } from '../services/tables.js';
import { navigate } from '../navigation.js';
import { getLocale } from '../localization.js';
import { iconTrophy, iconNereus } from '../components/icons.js';
import type { Session, Competition } from '../types.js';

@localized()
@customElement('app-home')
export class AppHome extends LitElement {
  @state() private _pb = 0;
  @state() private _recentSessions: Session[] = [];
  @state() private _recentCompetitions: Competition[] = [];
  @state() private _suggestedType: 'co2' | 'o2' | null = null;

  static styles = [
    sharedStyles,
    css`
      .page {
        padding: var(--spacing-lg);
        max-width: 800px;
        margin: 0 auto;
        padding-bottom: calc(var(--nav-height) + var(--spacing-xl));
      }

      .header {
        text-align: center;
        margin-bottom: var(--spacing-xl);
        padding-top: var(--spacing-lg);
      }

      .logo {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-xs);
      }

      .logo-icon {
        color: var(--color-accent);
        display: flex;
        align-items: center;
      }

      .logo-icon svg {
        width: 36px;
        height: 36px;
      }

      .app-name {
        font-size: var(--font-2xl);
        font-weight: 800;
        color: var(--color-accent);
        letter-spacing: -0.02em;
      }

      .app-subtitle {
        font-size: var(--font-sm);
        color: var(--color-text-muted);
        margin-top: var(--spacing-xs);
      }

      .pb-card {
        background: var(--color-bg-surface);
        border-radius: var(--radius-lg);
        padding: var(--spacing-md) var(--spacing-lg);
        text-align: center;
        margin-bottom: var(--spacing-md);
        border: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-md);
      }

      .pb-card-left {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
      }

      .pb-label {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 600;
      }

      .pb-value {
        font-size: var(--font-2xl);
        font-weight: 800;
        color: var(--color-text-primary);
        font-variant-numeric: tabular-nums;
        line-height: 1;
      }

      .pb-value.empty {
        font-size: var(--font-lg);
        color: var(--color-text-muted);
      }

      .pb-action {
        font-size: var(--font-sm);
        color: var(--color-accent);
        cursor: pointer;
        background: none;
        border: none;
        font-weight: 600;
        font-family: inherit;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .suggestion-chip {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--spacing-sm) var(--spacing-md);
        background: var(--color-accent-subtle);
        border: 1px solid rgba(99, 179, 237, 0.4);
        border-radius: var(--radius-md);
        margin-bottom: var(--spacing-md);
        cursor: pointer;
        font-size: var(--font-sm);
        font-weight: 600;
        color: var(--color-accent);
        transition: background var(--transition-fast);
        -webkit-tap-highlight-color: transparent;
      }

      .suggestion-chip:hover {
        background: rgba(99, 179, 237, 0.15);
      }

      .suggestion-arrow {
        font-size: var(--font-lg);
        line-height: 1;
      }

      .actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-xl);
      }

      .action-card {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-lg);
        cursor: pointer;
        transition: background var(--transition-fast), transform var(--transition-fast);
        -webkit-tap-highlight-color: transparent;
        text-align: left;
      }

      .action-card:hover {
        background: var(--color-bg-surface-hover);
      }

      .action-card:active {
        transform: scale(0.98);
      }

      .action-card.co2 {
        border-left: 3px solid var(--color-hold);
      }

      .action-card.o2 {
        border-left: 3px solid var(--color-breathe);
      }

      .action-card.pb {
        grid-column: 1 / -1;
        border-left: 3px solid var(--color-accent);
      }

      .action-card.competitions {
        grid-column: 1 / -1;
        border-left: 3px solid var(--color-accent);
      }

      .action-title {
        font-size: var(--font-lg);
        font-weight: 700;
        color: var(--color-text-primary);
        margin-bottom: var(--spacing-xs);
      }

      .action-desc {
        font-size: var(--font-sm);
        color: var(--color-text-secondary);
        line-height: 1.4;
      }

      .recent-header {
        font-size: var(--font-sm);
        font-weight: 600;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: var(--spacing-sm);
      }

      .session-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-md);
        background: var(--color-bg-surface);
        border-radius: var(--radius-sm);
        margin-bottom: var(--spacing-sm);
        border: 1px solid var(--color-border);
      }

      .session-type {
        font-weight: 600;
        font-size: var(--font-sm);
        text-transform: uppercase;
      }

      .session-type.co2 { color: var(--color-hold); }
      .session-type.o2 { color: var(--color-breathe); }
      .session-type.pb-test { color: var(--color-accent); }

      .session-date {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
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

      .comp-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-md);
        background: var(--color-bg-surface);
        border-radius: var(--radius-sm);
        margin-bottom: var(--spacing-sm);
        border: 1px solid var(--color-border);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      .comp-item:hover { background: var(--color-bg-surface-hover); }

      .comp-item-left {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        min-width: 0;
      }

      .comp-icon {
        color: var(--color-accent);
        flex-shrink: 0;
        display: flex;
        align-items: center;
      }

      .comp-icon svg { width: 16px; height: 16px; }

      .comp-name {
        font-weight: 600;
        font-size: var(--font-sm);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .comp-count {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        white-space: nowrap;
      }

      .empty-state {
        text-align: center;
        padding: var(--spacing-xl);
        color: var(--color-text-muted);
        font-size: var(--font-sm);
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this._load();
  }

  private async _load(): Promise<void> {
    const [settings, sessions, competitions] = await Promise.all([
      getSettings(),
      getSessions(5),
      getCompetitions(3),
    ]);
    this._pb = settings.personalBest;
    this._recentSessions = sessions;
    this._recentCompetitions = competitions;

    // Suggest the opposite of the most recent completed training session.
    const lastTraining = sessions.find(
      (s) => s.completed && (s.type === 'co2' || s.type === 'o2'),
    );
    if (lastTraining && settings.personalBest > 0) {
      this._suggestedType = lastTraining.type === 'co2' ? 'o2' : 'co2';
    }
  }

  private _formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(getLocale(), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  render() {
    return html`
      <div class="page">
        <div class="header">
          <div class="logo">
            <span class="logo-icon">${iconNereus}</span>
            <div class="app-name">Nereus</div>
          </div>
          <div class="app-subtitle">${msg('Freediving Breath-Hold Training')}</div>
        </div>

        <div class="pb-card">
          <div class="pb-card-left">
            <div class="pb-label">${msg('Personal Best')}</div>
            ${this._pb > 0
              ? html`<div class="pb-value">${formatTime(this._pb)}</div>`
              : html`<div class="pb-value empty">${msg('Not set yet')}</div>`}
          </div>
          <button class="pb-action" @click=${() => navigate('/pb-test')}>
            ${this._pb > 0 ? msg('Retest PB') : msg('Take PB Test')}
          </button>
        </div>

        ${this._suggestedType ? html`
          <div class="suggestion-chip" @click=${() => navigate(`/${this._suggestedType}`)}>
            <span>${msg(str`Try a ${this._suggestedType!.toUpperCase()} session today`)}</span>
            <span class="suggestion-arrow">→</span>
          </div>
        ` : ''}

        <div class="actions">
          <div class="action-card co2" @click=${() => navigate('/co2')}>
            <div class="action-title">${msg('CO2 Table')}</div>
            <div class="action-desc">${msg('Build hypercapnia tolerance with decreasing rest intervals')}</div>
          </div>
          <div class="action-card o2" @click=${() => navigate('/o2')}>
            <div class="action-title">${msg('O2 Table')}</div>
            <div class="action-desc">${msg('Train hypoxia resistance with increasing hold times')}</div>
          </div>
          <div class="action-card competitions" @click=${() => navigate('/competitions')}>
            <div class="action-title">${msg('Competitions')}</div>
            <div class="action-desc">${msg('Track your competition results and see your progress per discipline')}</div>
          </div>
          ${this._pb === 0 ? html`
            <div class="action-card pb" @click=${() => navigate('/pb-test')}>
              <div class="action-title">${msg('PB Test')}</div>
              <div class="action-desc">${msg('Guided determination exercise to measure your max breath hold')}</div>
            </div>
          ` : ''}
        </div>

        ${this._recentSessions.length > 0
          ? html`
              <div class="recent-header">${msg('Recent Sessions')}</div>
              ${this._recentSessions.map(
                (s) => html`
                  <div class="session-item">
                    <div>
                      <span class="session-type ${s.type}">${s.type.toUpperCase()}</span>
                      <div class="session-date">${this._formatDate(s.date)}</div>
                    </div>
                    <span class="session-status ${s.completed ? 'completed' : 'incomplete'}">
                      ${s.completed ? msg('Completed') : msg('Incomplete')}
                    </span>
                  </div>
                `,
              )}
            `
          : ''}

        ${this._recentCompetitions.length > 0
          ? html`
              <div class="recent-header">${msg('Recent Competitions')}</div>
              ${this._recentCompetitions.map(
                (c) => html`
                  <div class="comp-item" @click=${() => navigate('/competitions')}>
                    <div class="comp-item-left">
                      <span class="comp-icon">${iconTrophy}</span>
                      <span class="comp-name">${c.name}</span>
                    </div>
                    <span class="comp-count">${c.results.length} ${msg('disciplines')}</span>
                  </div>
                `,
              )}
            `
          : ''}

        ${this._recentSessions.length === 0 && this._recentCompetitions.length === 0
          ? html`<div class="empty-state">${msg('No sessions yet. Start your first training!')}</div>`
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-home': AppHome;
  }
}
