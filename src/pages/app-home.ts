import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import { getSettings, getSessions } from '../services/db.js';
import { formatTime } from '../services/tables.js';
import { navigate } from '../navigation.js';
import { getLocale } from '../localization.js';
import type { Session } from '../types.js';

@localized()
@customElement('app-home')
export class AppHome extends LitElement {
  @state() private _pb = 0;
  @state() private _recentSessions: Session[] = [];

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
        padding: var(--spacing-xl);
        text-align: center;
        margin-bottom: var(--spacing-lg);
        border: 1px solid var(--color-border);
      }

      .pb-label {
        font-size: var(--font-sm);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 600;
      }

      .pb-value {
        font-size: var(--font-3xl);
        font-weight: 800;
        color: var(--color-text-primary);
        margin: var(--spacing-sm) 0;
        font-variant-numeric: tabular-nums;
      }

      .pb-value.empty {
        font-size: var(--font-xl);
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
    const settings = await getSettings();
    this._pb = settings.personalBest;
    this._recentSessions = await getSessions(5);
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
          <div class="app-name">Nereus</div>
          <div class="app-subtitle">${msg('Freediving Breath-Hold Training')}</div>
        </div>

        <div class="pb-card">
          <div class="pb-label">${msg('Personal Best')}</div>
          ${this._pb > 0
            ? html`<div class="pb-value">${formatTime(this._pb)}</div>`
            : html`<div class="pb-value empty">${msg('Not set yet')}</div>`}
          <button class="pb-action" @click=${() => navigate('/pb-test')}>
            ${this._pb > 0 ? msg('Retest PB') : msg('Take PB Test')}
          </button>
        </div>

        <div class="actions">
          <div class="action-card co2" @click=${() => navigate('/co2')}>
            <div class="action-title">${msg('CO2 Table')}</div>
            <div class="action-desc">${msg('Build CO2 tolerance with decreasing rest intervals')}</div>
          </div>
          <div class="action-card o2" @click=${() => navigate('/o2')}>
            <div class="action-title">${msg('O2 Table')}</div>
            <div class="action-desc">${msg('Train hypoxia resistance with increasing hold times')}</div>
          </div>
          <div class="action-card pb" @click=${() => navigate('/pb-test')}>
            <div class="action-title">${msg('PB Test')}</div>
            <div class="action-desc">${msg('Guided determination exercise to measure your max breath hold')}</div>
          </div>
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
          : html`
              <div class="empty-state">
                ${msg('No sessions yet. Start your first training!')}
              </div>
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-home': AppHome;
  }
}
