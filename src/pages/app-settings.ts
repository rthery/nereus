import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { setLocale, detectLocale } from '../localization.js';
import { sharedStyles } from '../styles/theme.js';
import { iconSettings } from '../components/icons.js';
import { clearAllData, getSettings, saveSettings, savePB } from '../services/db.js';
import { formatTime } from '../services/tables.js';
import { exportAppData, downloadAppData, importAppData } from '../services/data-export.js';
import { iconDownload, iconUpload } from '../components/icons.js';
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
  @state() private _developerMode = false;

  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      .page {
        padding: var(--spacing-lg);
        max-width: 800px;
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


      .version {
        text-align: center;
        color: var(--color-text-muted);
        font-size: var(--font-xs);
        margin-top: var(--spacing-xl);
      }


      .danger-row {
        background: color-mix(in srgb, var(--color-danger) 6%, var(--color-bg-surface));
        border-color: color-mix(in srgb, var(--color-danger) 24%, var(--color-border));
      }

      .danger-row .setting-label {
        color: var(--color-danger);
      }

      .danger-row .setting-desc {
        color: var(--color-text-muted);
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
    this._developerMode = settings.developerMode ?? false;
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

  private async _toggleDeveloperMode(): Promise<void> {
    this._developerMode = !this._developerMode;
    await saveSettings({ developerMode: this._developerMode });
  }

  private async _exportAppData(): Promise<void> {
    try {
      const exportData = await exportAppData();
      downloadAppData(exportData);
    } catch (error) {
      console.error('Export failed:', error);
      window.alert('Export failed. Please try again.');
    }
  }

  private async _importAppData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;

    const confirmed = window.confirm(
      'Importing data will overwrite all current app data. Are you sure you want to continue?',
    );
    
    if (!confirmed) return;

    try {
      await importAppData(file);
    } catch (error) {
      console.error('Import failed:', error);
      window.alert('Import failed. Please check the file and try again.');
    } finally {
      // Reset the file input
      input.value = '';
    }
  }

  private async _deleteAppDataAndReload(): Promise<void> {
    const confirmed = window.confirm(
      'Delete all current app data, including settings and history, then reload?',
    );
    if (!confirmed) return;

    await clearAllData();
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  }

  private _startEditPb(): void {
    if (this._pb <= 0) this._pb = 120; // default 2:00 when not yet set
    this._editingPb = true;
  }

  private async _savePb(): Promise<void> {
    if (this._pb > 0) {
      await saveSettings({ personalBest: this._pb });
      await savePB({ date: Date.now(), value: this._pb, source: 'manual' });
    }
    this._editingPb = false;
  }

  render() {
    return html`
      <div class="page">
        <div style="display:flex;align-items:center;gap:var(--spacing-sm);margin-bottom:var(--spacing-xl)">
          <span style="color:var(--color-accent);display:flex;align-items:center">${iconSettings}</span>
          <h1 class="page-title" style="margin:0">${msg('Settings')}</h1>
        </div>

        <div class="section">
          <div class="section-label">${msg('Personal Best')}</div>
          <div class="setting-row">
            <div>
              <div class="setting-label">${msg('Current PB')}</div>
              <div class="setting-desc">${msg('Used to generate your training tables')}</div>
            </div>
            ${this._editingPb
              ? html`
                  <div class="pb-display">
                    <div class="time-picker">
                      <div class="time-picker-field">
                        <input
                          type="number"
                          inputmode="numeric"
                          min="0"
                          max="10"
                          .value=${String(Math.floor(this._pb / 60))}
                          @change=${(e: Event) => {
                            const mins = Math.max(0, Math.min(10, parseInt((e.target as HTMLInputElement).value, 10) || 0));
                            this._pb = Math.max(1, Math.min(600, mins * 60 + (this._pb % 60)));
                          }}
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
                          .value=${String(this._pb % 60).padStart(2, '0')}
                          @change=${(e: Event) => {
                            const secs = Math.max(0, Math.min(59, parseInt((e.target as HTMLInputElement).value, 10) || 0));
                            this._pb = Math.max(1, Math.min(600, Math.floor(this._pb / 60) * 60 + secs));
                          }}
                        />
                        <span class="time-picker-unit">${msg('sec')}</span>
                      </div>
                    </div>
                    <button class="btn btn-primary btn-compact" @click=${this._savePb}>${msg('Save')}</button>
                  </div>
                `
              : html`
                  <div class="pb-display">
                    <span class="pb-value">${this._pb > 0 ? formatTime(this._pb) : msg('Not set')}</span>
                    <button class="btn btn-ghost" @click=${this._startEditPb}>${msg('Edit')}</button>
                  </div>
                `}
          </div>
        </div>

        <div class="section">
          <div class="section-label">${msg('Appearance')}</div>
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
          <div class="section-label">${msg('Language')}</div>
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
          <div class="section-label">${msg('Feedback')}</div>
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

        <div class="section">
          <div class="section-label">${msg('Data Backup')}</div>
          <div class="setting-row">
            <div>
              <div class="setting-label">${msg('Export Data')}</div>
              <div class="setting-desc">${msg('Download all your app data as a backup file')}</div>
            </div>
            <button
              class="btn btn-secondary btn-compact"
              @click=${this._exportAppData}
            >
              ${iconDownload} ${msg('Export')}
            </button>
          </div>
          <div class="setting-row">
            <div>
              <div class="setting-label">${msg('Import Data')}</div>
              <div class="setting-desc">${msg('Restore your app data from a backup file')}</div>
            </div>
            <label class="btn btn-secondary btn-compact">
              ${iconUpload} ${msg('Import')}
              <input
                type="file"
                accept=".json"
                style="display: none;"
                @change=${this._importAppData}
              />
            </label>
          </div>
        </div>

        ${import.meta.env.DEV ? html`
          <div class="section">
            <div class="section-label">Developer</div>
            <div class="setting-row">
              <div>
                <div class="setting-label">Training debug</div>
                <div class="setting-desc">Show debug controls during training</div>
              </div>
              <button
                class="toggle ${this._developerMode ? 'on' : ''}"
                @click=${this._toggleDeveloperMode}
              ></button>
            </div>
            <div class="setting-row danger-row">
              <div>
                <div class="setting-label">Reset app data</div>
                <div class="setting-desc">Delete current app data and reload the app</div>
              </div>
              <button
                class="btn btn-danger btn-compact"
                @click=${this._deleteAppDataAndReload}
              >
                Reset
              </button>
            </div>
          </div>
        ` : ''}

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
