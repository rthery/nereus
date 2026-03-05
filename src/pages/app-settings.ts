import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { setLocale, detectLocale } from '../localization.js';
import { sharedStyles } from '../styles/theme.js';
import { getSettings, saveSettings, savePB } from '../services/db.js';
import { formatTime, parseTime } from '../services/tables.js';
import type { ThemePreference, LocalePreference } from '../types.js';

@localized()
@customElement('app-settings')
export class AppSettings extends LitElement {
  @property() currentTheme: ThemePreference = 'system';

  @state() private _soundEnabled = true;
  @state() private _vibrationEnabled = true;
  @state() private _locale: LocalePreference = 'auto';
  @state() private _pb = 0;
  @state() private _editingPb = false;
  @state() private _pbInput = '';

  static styles = [
    sharedStyles,
    css`
      .page {
        padding: var(--spacing-lg);
        max-width: 600px;
        margin: 0 auto;
        padding-bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0) + var(--spacing-xl));
      }

      .page-title {
        font-size: var(--font-xl);
        font-weight: 800;
        margin-bottom: var(--spacing-xl);
      }

      .section {
        margin-bottom: var(--spacing-xl);
      }

      .section-title {
        font-size: var(--font-sm);
        font-weight: 600;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: var(--spacing-md);
      }

      .setting-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--spacing-sm);
        padding: var(--spacing-md);
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        margin-bottom: var(--spacing-sm);
      }

      .setting-label {
        font-size: var(--font-md);
        color: var(--color-text-primary);
      }

      .setting-desc {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        margin-top: 2px;
      }

      .theme-options {
        display: flex;
        gap: var(--spacing-xs);
        flex-wrap: wrap;
      }

      .theme-btn {
        padding: var(--spacing-xs) var(--spacing-md);
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

      .theme-btn.active {
        background: var(--color-accent);
        color: #fff;
        border-color: var(--color-accent);
      }

      .toggle {
        position: relative;
        width: 48px;
        height: 28px;
        background: var(--color-border);
        border-radius: 14px;
        cursor: pointer;
        transition: background var(--transition-fast);
        border: none;
        padding: 0;
      }

      .toggle.on {
        background: var(--color-accent);
      }

      .toggle::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #fff;
        transition: transform var(--transition-fast);
      }

      .toggle.on::after {
        transform: translateX(20px);
      }

      .pb-display {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }

      .pb-value {
        font-size: var(--font-lg);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--color-accent);
      }

      .pb-edit-btn {
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        font-size: var(--font-sm);
        font-family: inherit;
      }

      .pb-input {
        background: var(--color-bg-primary);
        border: 1px solid var(--color-accent);
        border-radius: var(--radius-sm);
        padding: var(--spacing-xs) var(--spacing-sm);
        color: var(--color-text-primary);
        font-size: var(--font-md);
        font-weight: 600;
        text-align: center;
        width: 80px;
        font-family: inherit;
      }

      .pb-input:focus {
        outline: none;
      }

      .save-btn {
        padding: var(--spacing-xs) var(--spacing-md);
        background: var(--color-accent);
        color: #fff;
        border: none;
        border-radius: var(--radius-full);
        font-size: var(--font-sm);
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
      }

      .version {
        text-align: center;
        color: var(--color-text-muted);
        font-size: var(--font-xs);
        margin-top: var(--spacing-xl);
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this._load();
  }

  private async _load(): Promise<void> {
    const settings = await getSettings();
    this._soundEnabled = settings.soundEnabled;
    this._vibrationEnabled = settings.vibrationEnabled;
    this._pb = settings.personalBest;
    this._locale = settings.locale;
  }

  private _setTheme(theme: ThemePreference): void {
    this.dispatchEvent(new CustomEvent('theme-change', { detail: theme }));
  }

  private async _setLocale(locale: LocalePreference): Promise<void> {
    this._locale = locale;
    await saveSettings({ locale });
    const resolved = locale === 'auto' ? detectLocale() : locale;
    await setLocale(resolved);
    document.documentElement.lang = resolved;
  }

  private async _toggleSound(): Promise<void> {
    this._soundEnabled = !this._soundEnabled;
    await saveSettings({ soundEnabled: this._soundEnabled });
  }

  private async _toggleVibration(): Promise<void> {
    this._vibrationEnabled = !this._vibrationEnabled;
    await saveSettings({ vibrationEnabled: this._vibrationEnabled });
  }

  private _startEditPb(): void {
    this._editingPb = true;
    this._pbInput = this._pb > 0 ? formatTime(this._pb) : '2:00';
  }

  private async _savePb(): Promise<void> {
    const seconds = parseTime(this._pbInput);
    if (seconds > 0) {
      this._pb = seconds;
      await saveSettings({ personalBest: seconds });
      await savePB({ date: Date.now(), value: seconds, source: 'manual' });
    }
    this._editingPb = false;
  }

  render() {
    return html`
      <div class="page">
        <h1 class="page-title">${msg('Settings')}</h1>

        <div class="section">
          <div class="section-title">${msg('Personal Best')}</div>
          <div class="setting-row">
            <div>
              <div class="setting-label">${msg('Current PB')}</div>
              <div class="setting-desc">${msg('Used to generate your training tables')}</div>
            </div>
            ${this._editingPb
              ? html`
                  <div class="pb-display">
                    <input
                      class="pb-input"
                      type="text"
                      inputmode="numeric"
                      .value=${this._pbInput}
                      @input=${(e: Event) => {
                        this._pbInput = (e.target as HTMLInputElement).value;
                      }}
                      @keydown=${(e: KeyboardEvent) => {
                        if (e.key === 'Enter') this._savePb();
                      }}
                    />
                    <button class="save-btn" @click=${this._savePb}>${msg('Save')}</button>
                  </div>
                `
              : html`
                  <div class="pb-display">
                    <span class="pb-value">${this._pb > 0 ? formatTime(this._pb) : msg('Not set')}</span>
                    <button class="pb-edit-btn" @click=${this._startEditPb}>${msg('Edit')}</button>
                  </div>
                `}
          </div>
        </div>

        <div class="section">
          <div class="section-title">${msg('Appearance')}</div>
          <div class="setting-row">
            <div class="setting-label">${msg('Theme')}</div>
            <div class="theme-options">
              ${(['system', 'light', 'dark'] as ThemePreference[]).map(
                (t) => html`
                  <button
                    class="theme-btn ${this.currentTheme === t ? 'active' : ''}"
                    @click=${() => this._setTheme(t)}
                  >
                    ${t === 'system' ? msg('system') : t === 'light' ? msg('light') : msg('dark')}
                  </button>
                `,
              )}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">${msg('Language')}</div>
          <div class="setting-row">
            <div class="setting-label">${msg('Language')}</div>
            <div class="theme-options">
              <button class="theme-btn ${this._locale === 'auto' ? 'active' : ''}" @click=${() => this._setLocale('auto')}>Auto</button>
              <button class="theme-btn ${this._locale === 'en' ? 'active' : ''}" @click=${() => this._setLocale('en')}>English</button>
              <button class="theme-btn ${this._locale === 'fr' ? 'active' : ''}" @click=${() => this._setLocale('fr')}>Français</button>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">${msg('Feedback')}</div>
          <div class="setting-row">
            <div>
              <div class="setting-label">${msg('Sound')}</div>
              <div class="setting-desc">${msg('Beeps during phase transitions')}</div>
            </div>
            <button
              class="toggle ${this._soundEnabled ? 'on' : ''}"
              @click=${this._toggleSound}
            ></button>
          </div>
          <div class="setting-row">
            <div>
              <div class="setting-label">${msg('Vibration')}</div>
              <div class="setting-desc">${msg('Haptic feedback on mobile')}</div>
            </div>
            <button
              class="toggle ${this._vibrationEnabled ? 'on' : ''}"
              @click=${this._toggleVibration}
            ></button>
          </div>
        </div>

        <div class="version">Nereus v0.1.0</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-settings': AppSettings;
  }
}
