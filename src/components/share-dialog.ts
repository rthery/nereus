import { LitElement, html, css } from 'lit';
import type { TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import { iconCopy, iconShare2, iconX } from './icons.js';
import { renderQrCodeSvg } from '../services/qr-code.js';

@localized()
@customElement('share-dialog')
export class ShareDialog extends LitElement {
  @property({ type: Boolean }) open = false;
  @property() title = '';
  @property() url = '';
  @property() presetName = '';
  @property({ type: Object }) presetCard: TemplateResult | null = null;

  @state() private _copyStatus: 'idle' | 'done' | 'error' = 'idle';

  static styles = [
    sharedStyles,
    css`
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 1200;
        background: rgba(0, 0, 0, 0.78);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-md);
      }

      .dialog {
        width: min(100%, 520px);
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: 0 20px 60px var(--color-shadow);
        padding: var(--spacing-lg);
      }

      .dialog-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-md);
      }

      .dialog-title {
        font-size: var(--font-base);
        font-weight: 800;
        line-height: 1.2;
      }

      .dialog-subtitle {
        margin-top: 4px;
        color: var(--color-text-secondary);
        font-size: var(--font-sm);
        line-height: 1.45;
      }

      .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
      }

      .qr-card {
        display: flex;
        align-items: center;
        justify-content: center;
        background: white;
        border-radius: var(--radius-md);
        padding: var(--spacing-lg);
        margin-bottom: var(--spacing-sm);
      }

      .qr-card svg {
        width: min(100%, 260px);
        height: auto;
        display: block;
      }

      .error-message {
        color: var(--color-hold);
        font-size: var(--font-sm);
        text-align: center;
        padding: var(--spacing-md);
        margin-bottom: var(--spacing-md);
      }

      .preset-name {
        color: var(--color-accent);
        font-weight: 600;
        font-size: var(--font-sm);
        margin-top: var(--spacing-xs);
      }

      .preset-card-container {
        margin-top: var(--spacing-sm);
        margin-bottom: var(--spacing-sm);
      }

      .preset-card-container .preset-card {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
        text-align: left;
        width: 100%;
        color: var(--color-text-primary);
      }

      .preset-card-container .preset-card.active {
        border-color: var(--color-accent);
        background: var(--color-accent-subtle);
      }

      .preset-card-container .preset-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-xs);
        margin-top: 0;
      }

      .preset-card-container .preset-name-row {
        display: flex;
        align-items: baseline;
        gap: var(--spacing-xs);
        min-width: 0;
      }

      .preset-card-container .preset-card-header {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        min-width: 0;
      }

      .preset-card-container .preset-duration,
      .preset-card-container .preset-meta {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        flex-shrink: 0;
        align-self: flex-start;
        padding-top: 2px;
      }

      .preset-card-container .preset-card-header {
        justify-content: space-between;
        margin-bottom: var(--spacing-xs);
      }

      .preset-card-container .preset-name {
        font-size: var(--font-md);
        font-weight: 700;
        min-width: 0;
        line-height: 1.2;
        margin: 0;
      }

      .preset-card-container .preset-duration,
      .preset-card-container .preset-meta {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        flex-shrink: 0;
        line-height: 1.2;
      }

      .preset-card-container .saved-indicator {
        display: none;
      }

      .preset-card-container .saved-indicator svg {
        width: 11px;
        height: 11px;
      }

      .preset-card-container .preset-tip {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        margin-top: 4px;
        font-style: italic;
      }

      .preset-card-container .phase-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: var(--spacing-xs);
      }

      .preset-card-container .phase-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: var(--radius-full);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .preset-card-container .phase-pill svg {
        width: 9px;
        height: 9px;
        flex-shrink: 0;
      }

      .preset-card-container .phase-pill-duration {
        text-transform: none;
      }

      .preset-card-container .phase-pill.inhale {
        background: color-mix(in srgb, var(--color-breathe) 20%, transparent);
        color: var(--color-breathe);
      }

      .preset-card-container .phase-pill.hold-in {
        background: color-mix(in srgb, var(--color-breathe) 12%, transparent);
        color: var(--color-breathe);
        opacity: 0.75;
      }

      .preset-card-container .phase-pill.exhale {
        background: color-mix(in srgb, var(--color-hold) 20%, transparent);
        color: var(--color-hold);
      }

      .preset-card-container .phase-pill.hold-out {
        background: color-mix(in srgb, var(--color-hold) 12%, transparent);
        color: var(--color-hold);
        opacity: 0.75;
      }

      .preset-card-container .phase-pill.breathing {
        background: color-mix(in srgb, var(--color-breathe) 20%, transparent);
        color: var(--color-breathe);
      }

      .preset-card-container .phase-pill.inhale {
        background: color-mix(in srgb, var(--color-breathe) 20%, transparent);
        color: var(--color-breathe);
      }

      .preset-card-container .phase-pill.apnea-full {
        background: color-mix(in srgb, var(--color-hold) 20%, transparent);
        color: var(--color-hold);
      }

      .preset-card-container .phase-pill.exhale {
        background: color-mix(in srgb, var(--color-hold) 20%, transparent);
        color: var(--color-hold);
      }

      .preset-card-container .phase-pill.apnea-empty {
        background: color-mix(in srgb, var(--color-hold) 12%, transparent);
        color: var(--color-hold);
        opacity: 0.75;
      }

      .preset-card-container .phase-pill.activity {
        background: color-mix(in srgb, var(--color-activity) 20%, transparent);
        color: var(--color-activity);
      }

      .preset-card-container .round-pill-meta {
        display: inline-flex;
        align-items: center;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: var(--radius-full);
        background: color-mix(in srgb, var(--color-text-muted) 12%, transparent);
        color: var(--color-text-muted);
      }

      .actions {
        display: flex;
        gap: var(--spacing-sm);
      }

      .actions .btn {
        flex: 1;
      }

      @media (min-width: 769px) {
        .overlay {
          align-items: center;
        }
      }
    `,
  ];

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('open') && this.open) {
      this._copyStatus = 'idle';
    }
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('close-request'));
  }

  private async _copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url);
      this._copyStatus = 'done';
    } catch {
      this._copyStatus = 'error';
    }
  }

  private async _share(): Promise<void> {
    if (!('share' in navigator)) return;
    try {
      await navigator.share({ title: this.title, url: this.url });
    } catch {
      // Ignore user cancellation.
    }
  }

  render() {
    if (!this.open) return html``;

    const length = this.url.length;
    let qrMarkup;
    let qrError: string | null = null;
    const loading = !this.url;

    if (this.url) {
      console.log('Share URL:', this.url);
      console.log('URL length:', length);
    }

    try {
      qrMarkup = this.url ? renderQrCodeSvg(this.url) : null;
    } catch (err) {
      console.error('QR code generation failed:', err);
      qrError = msg('This link is too long to render as a QR code.');
      qrMarkup = null;
    }

    if (!qrError && length > 2000) {
      qrError = msg('This link is too long to be reliably shared.');
    }

    return html`
      <div class="overlay" @click=${this._close}>
        <div class="dialog" @click=${(event: Event) => event.stopPropagation()}>
          <div class="dialog-header">
            <div>
              <div class="dialog-title">${this.title}</div>
              <div class="dialog-subtitle">${msg('Share this training with a link or scan it from another device.')}</div>
            </div>
            <button class="icon-btn" @click=${this._close} aria-label=${msg('Close')}>
              ${iconX}
            </button>
          </div>

          ${this.presetCard ? html`<div class="preset-card-container">${this.presetCard}</div>` : ''}

          <div class="qr-card" aria-label=${msg('QR code')}>
            ${loading
              ? html`<div class="dialog-subtitle">${msg('Preparing share link...')}</div>`
              : qrMarkup}
          </div>

          ${qrError ? html`<div class="error-message">${qrError}</div>` : ''}

          <div class="actions">
            <button class="btn btn-primary" ?disabled=${loading} @click=${() => void this._copy()}>
              ${iconCopy}
              ${this._copyStatus === 'done'
                ? msg('Copied')
                : this._copyStatus === 'error'
                  ? msg('Copy failed')
                  : msg('Copy link')}
            </button>
            ${'share' in navigator ? html`
              <button class="btn btn-primary" ?disabled=${loading} @click=${() => void this._share()}>
                ${iconShare2}
                ${msg('Share')}
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'share-dialog': ShareDialog;
  }
}
