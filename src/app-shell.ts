import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { themeStyles } from './styles/theme.js';
import { getSettings, saveSettings } from './services/db.js';
import { setLocale, detectLocale } from './localization.js';
import type { ThemePreference } from './types.js';
import './components/app-nav.js';
import './pwa-badge.js';

type AppRoute = '/' | '/co2' | '/o2' | '/timer' | '/pb-test' | '/history' | '/settings';

@localized()
@customElement('app-shell')
export class AppShell extends LitElement {
  @state() private _route: AppRoute = '/';
  @state() private _theme: ThemePreference = 'system';
  @state() private _resolvedTheme: 'light' | 'dark' = 'dark';
  @state() private _safetyAcknowledged = false;
  @state() private _ready = false;
  @state() private _timerData: unknown = null;

  private _mediaQuery?: MediaQueryList;

  static styles = [
    themeStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        min-height: 100dvh;
        background: var(--color-bg-primary);
        color: var(--color-text-primary);
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        transition: background var(--transition-normal), color var(--transition-normal);
      }

      .app-content {
        min-height: 100vh;
        min-height: 100dvh;
      }

      .safety-overlay {
        position: fixed;
        inset: 0;
        z-index: 1000;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-lg);
      }

      .safety-dialog {
        background: var(--color-bg-surface);
        border-radius: var(--radius-lg);
        padding: var(--spacing-xl);
        max-width: 480px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
      }

      .safety-dialog h2 {
        color: var(--color-danger);
        font-size: var(--font-xl);
        margin-bottom: var(--spacing-md);
      }

      .safety-dialog p {
        color: var(--color-text-secondary);
        line-height: 1.6;
        margin-bottom: var(--spacing-md);
      }

      .safety-dialog ul {
        color: var(--color-text-secondary);
        line-height: 1.8;
        margin-bottom: var(--spacing-lg);
        padding-left: var(--spacing-lg);
      }

      .safety-dialog .btn {
        width: 100%;
        padding: var(--spacing-md);
        background: var(--color-accent);
        color: #fff;
        border: none;
        border-radius: var(--radius-full);
        font-size: var(--font-md);
        font-weight: 600;
        cursor: pointer;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this._init();
    window.addEventListener('popstate', this._onPopState);
    window.addEventListener('navigate', this._onNavigate as EventListener);
    this._route = this._getRoute();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('popstate', this._onPopState);
    window.removeEventListener('navigate', this._onNavigate as EventListener);
    this._mediaQuery?.removeEventListener('change', this._onMediaChange);
  }

  private async _init(): Promise<void> {
    const settings = await getSettings();
    this._theme = settings.theme;
    this._safetyAcknowledged = settings.safetyAcknowledged;
    this._resolveTheme();
    const resolvedLocale = settings.locale === 'auto' ? detectLocale() : settings.locale;
    await setLocale(resolvedLocale);
    document.documentElement.lang = resolvedLocale;
    this._ready = true;
  }

  private _resolveTheme(): void {
    if (this._theme === 'system') {
      this._mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      this._mediaQuery.addEventListener('change', this._onMediaChange);
      this._resolvedTheme = this._mediaQuery.matches ? 'light' : 'dark';
    } else {
      this._resolvedTheme = this._theme;
    }
  }

  private _onMediaChange = (e: MediaQueryListEvent): void => {
    if (this._theme === 'system') {
      this._resolvedTheme = e.matches ? 'light' : 'dark';
    }
  };

  private _getRoute(): AppRoute {
    const path = window.location.hash.slice(1) || '/';
    return path as AppRoute;
  }

  private _onPopState = (): void => {
    this._route = this._getRoute();
  };

  private _onNavigate = (e: CustomEvent): void => {
    const { path, data } = e.detail;
    if (data) this._timerData = data;
    window.location.hash = path;
    this._route = path as AppRoute;
  };

  private async _acknowledgeSafety(): Promise<void> {
    this._safetyAcknowledged = true;
    await saveSettings({ safetyAcknowledged: true });
  }

  async setTheme(theme: ThemePreference): Promise<void> {
    this._theme = theme;
    this._resolveTheme();
    await saveSettings({ theme });
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('_resolvedTheme')) {
      if (this._resolvedTheme === 'light') {
        this.setAttribute('theme', 'light');
      } else {
        this.removeAttribute('theme');
      }
    }
  }

  private _renderPage() {
    switch (this._route) {
      case '/co2':
        import('./pages/app-table-setup.js');
        return html`<app-table-setup mode="co2"></app-table-setup>`;
      case '/o2':
        import('./pages/app-table-setup.js');
        return html`<app-table-setup mode="o2"></app-table-setup>`;
      case '/timer':
        import('./pages/app-timer.js');
        return html`<app-timer .tableData=${this._timerData}></app-timer>`;
      case '/pb-test':
        import('./pages/app-pb-test.js');
        return html`<app-pb-test></app-pb-test>`;
      case '/history':
        import('./pages/app-history.js');
        return html`<app-history></app-history>`;
      case '/settings':
        import('./pages/app-settings.js');
        return html`<app-settings
          .currentTheme=${this._theme}
          @theme-change=${(e: CustomEvent) => this.setTheme(e.detail)}
        ></app-settings>`;
      default:
        import('./pages/app-home.js');
        return html`<app-home></app-home>`;
    }
  }

  render() {
    if (!this._ready) return html``;

    const hideNav = this._route === '/timer';

    return html`
      ${!this._safetyAcknowledged
        ? html`
            <div class="safety-overlay">
              <div class="safety-dialog">
                <h2>${msg('Safety Notice')}</h2>
                <p>
                  ${msg(html`Breath-hold training carries inherent risks. Before using this app, please
                  be aware of the following:`)}
                </p>
                <ul>
                  <li>${msg(html`<strong>Never train in water alone</strong> - dry (on land) training is recommended for solo practice`)}</li>
                  <li>${msg(html`<strong>Never hyperventilate</strong> before breath holds`)}</li>
                  <li>${msg(html`<strong>Stop immediately</strong> if you feel dizzy, see spots, or experience strong involuntary contractions`)}</li>
                  <li>${msg(html`<strong>Do not train</strong> if fatigued, ill, or after consuming alcohol`)}</li>
                  <li>${msg(html`<strong>Consult a doctor</strong> if you have cardiovascular, respiratory, or neurological conditions`)}</li>
                </ul>
                <p>
                  ${msg('This app is designed for dry (land-based) static apnea training only.')}
                </p>
                <button class="btn" @click=${this._acknowledgeSafety}>
                  ${msg('I understand and accept')}
                </button>
              </div>
            </div>
          `
        : ''}
      <div class="app-content">
        ${this._renderPage()}
      </div>
      ${!hideNav ? html`<app-nav .currentRoute=${this._route}></app-nav>` : ''}
      <pwa-badge></pwa-badge>
    `;
  }
}

// Re-exported from navigation.ts to avoid importing app-shell in page/component
// modules (which would create a circular dep and double-register custom elements).
export { navigate } from './navigation.js';

declare global {
  interface HTMLElementTagNameMap {
    'app-shell': AppShell;
  }
}
