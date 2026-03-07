import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import { getSettings, getSessions } from '../services/db.js';
import { formatTime } from '../services/tables.js';
import { navigate } from '../navigation.js';
import { getLocale } from '../localization.js';
import { iconNereus } from '../components/icons.js';
import type { Session } from '../types.js';

@localized()
@customElement('app-home')
export class AppHome extends LitElement {
  @state() private _pb = 0;
  @state() private _recentSessions: Session[] = [];
  @state() private _suggestedType: 'co2' | 'o2' | null = null;
  @state() private _trainedToday = false;

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

      .cta-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--spacing-md) var(--spacing-lg);
        background: var(--color-accent-subtle);
        border: 1px solid rgba(99, 179, 237, 0.4);
        border-radius: var(--radius-md);
        margin-bottom: var(--spacing-xl);
        cursor: pointer;
        transition: background var(--transition-fast), transform var(--transition-fast);
        -webkit-tap-highlight-color: transparent;
        gap: var(--spacing-md);
      }

      .cta-card:hover {
        background: rgba(99, 179, 237, 0.15);
      }

      .cta-card:active {
        transform: scale(0.98);
      }

      .cta-card.done {
        background: rgba(102, 187, 106, 0.08);
        border-color: rgba(102, 187, 106, 0.3);
        cursor: default;
      }

      .cta-card.done:hover,
      .cta-card.done:active {
        background: rgba(102, 187, 106, 0.08);
        transform: none;
      }

      .cta-title {
        font-size: var(--font-base);
        font-weight: 700;
        color: var(--color-accent);
        margin-bottom: 2px;
      }

      .cta-card.done .cta-title {
        color: var(--color-success);
      }

      .cta-sub {
        font-size: var(--font-sm);
        color: var(--color-text-secondary);
      }

      .cta-arrow {
        font-size: var(--font-lg);
        color: var(--color-accent);
        line-height: 1;
        flex-shrink: 0;
      }

      .cta-card.done .cta-arrow {
        color: var(--color-success);
      }

      .section-header {
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
        padding: var(--spacing-sm) var(--spacing-md);
        background: var(--color-bg-surface);
        border-radius: var(--radius-sm);
        margin-bottom: var(--spacing-xs);
        border: 1px solid var(--color-border);
      }

      .session-left {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }

      .session-type-dot {
        width: 8px;
        height: 8px;
        border-radius: var(--radius-full);
        flex-shrink: 0;
      }

      .session-type-dot.co2 { background: var(--color-hold); }
      .session-type-dot.o2 { background: var(--color-breathe); }
      .session-type-dot.pb-test { background: var(--color-accent); }

      .session-name {
        font-weight: 600;
        font-size: var(--font-sm);
        color: var(--color-text-primary);
      }

      .session-detail {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        margin-top: 1px;
      }

      .session-date {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        text-align: right;
        flex-shrink: 0;
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
    const [settings, sessions] = await Promise.all([
      getSettings(),
      getSessions(5),
    ]);
    this._pb = settings.personalBest;
    this._recentSessions = sessions;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    this._trainedToday = sessions.some(
      (s) => s.completed && (s.type === 'co2' || s.type === 'o2') && s.date >= todayStart.getTime(),
    );

    if (!this._trainedToday && settings.personalBest > 0) {
      const lastTraining = sessions.find(
        (s) => s.completed && (s.type === 'co2' || s.type === 'o2'),
      );
      if (lastTraining) {
        this._suggestedType = lastTraining.type === 'co2' ? 'o2' : 'co2';
      }
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

  private _renderCTA() {
    if (this._pb === 0) {
      return html`
        <div class="cta-card" @click=${() => navigate('/pb-test')}>
          <div>
            <div class="cta-title">${msg('Set your personal best')}</div>
            <div class="cta-sub">${msg('Required to calibrate your training tables')}</div>
          </div>
          <span class="cta-arrow">→</span>
        </div>
      `;
    }

    if (this._trainedToday) {
      return html`
        <div class="cta-card done" @click=${() => navigate('/history')}>
          <div>
            <div class="cta-title">${msg('Training done for today')}</div>
            <div class="cta-sub">${msg('View session history')}</div>
          </div>
          <span class="cta-arrow">→</span>
        </div>
      `;
    }

    if (this._suggestedType === 'co2') {
      return html`
        <div class="cta-card" @click=${() => navigate('/co2')}>
          <div>
            <div class="cta-title">${msg('CO2 session today')}</div>
            <div class="cta-sub">${msg('Decreasing rest to build CO2 tolerance')}</div>
          </div>
          <span class="cta-arrow">→</span>
        </div>
      `;
    }

    if (this._suggestedType === 'o2') {
      return html`
        <div class="cta-card" @click=${() => navigate('/o2')}>
          <div>
            <div class="cta-title">${msg('O2 session today')}</div>
            <div class="cta-sub">${msg('Increasing holds to push your hypoxia threshold')}</div>
          </div>
          <span class="cta-arrow">→</span>
        </div>
      `;
    }

    return html`
      <div class="cta-card" @click=${() => navigate('/training')}>
        <div>
          <div class="cta-title">${msg('Start training')}</div>
          <div class="cta-sub">${msg('CO2, O2 tables and breathwork')}</div>
        </div>
        <span class="cta-arrow">→</span>
      </div>
    `;
  }

  render() {
    return html`
      <div class="page">
        <div class="header">
          <div class="logo">
            <span class="logo-icon">${iconNereus}</span>
            <div class="app-name">Nereus</div>
          </div>
          <div class="app-subtitle">${msg('Track Your Freediving Journey')}</div>
        </div>

        <div class="pb-card">
          <div class="pb-card-left">
            <div class="pb-label">${msg('Personal Best')}</div>
            ${this._pb > 0
              ? html`<div class="pb-value">${formatTime(this._pb)}</div>`
              : html`<div class="pb-value empty">${msg('Not set yet')}</div>`}
          </div>
          <button class="pb-action" @click=${() => navigate('/pb-test')}>
            ${this._pb > 0 ? msg('Retest') : msg('Take test')}
          </button>
        </div>

        ${this._renderCTA()}

        ${this._recentSessions.length > 0
          ? html`
              <div class="section-header">${msg('Recent')}</div>
              ${this._recentSessions.slice(0, 3).map((s) => {
                const completedRounds = s.rounds.filter((r) => r.completed).length;
                const totalRounds = s.rounds.length;
                return html`
                  <div class="session-item">
                    <div class="session-left">
                      <span class="session-type-dot ${s.type}"></span>
                      <div>
                        <div class="session-name">
                          ${s.type === 'pb-test' ? msg('PB Test') : s.type.toUpperCase()}
                        </div>
                        ${s.type === 'pb-test' && s.personalBest
                          ? html`<div class="session-detail">${formatTime(s.personalBest)}</div>`
                          : totalRounds > 0
                            ? html`<div class="session-detail">${completedRounds}/${totalRounds} ${msg('rounds')}</div>`
                            : ''}
                      </div>
                    </div>
                    <div class="session-date">${this._formatDate(s.date)}</div>
                  </div>
                `;
              })}
            `
          : html`<div class="empty-state">${msg('No sessions yet. Start your first training!')}</div>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-home': AppHome;
  }
}
