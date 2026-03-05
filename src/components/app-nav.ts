import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { navigate } from '../navigation.js';
import { iconHome, iconCloud, iconWind, iconBarChart2, iconSettings } from './icons.js';

@localized()
@customElement('app-nav')
export class AppNav extends LitElement {
  @property() currentRoute = '/';

  static styles = css`
    :host {
      display: block;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 100;
      background: var(--color-bg-secondary);
      border-top: 1px solid var(--color-border);
      -webkit-backdrop-filter: blur(12px);
      backdrop-filter: blur(12px);
      padding-bottom: env(safe-area-inset-bottom, 0);
    }

    nav {
      display: flex;
      justify-content: space-around;
      align-items: center;
      height: var(--nav-height);
      max-width: 600px;
      margin: 0 auto;
      padding: 0 var(--spacing-sm);
    }

    button {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      background: none;
      border: none;
      color: var(--color-text-muted);
      cursor: pointer;
      padding: var(--spacing-xs) var(--spacing-sm);
      border-radius: var(--radius-sm);
      transition: color var(--transition-fast);
      -webkit-tap-highlight-color: transparent;
      font-family: inherit;
    }

    button:hover {
      color: var(--color-text-secondary);
    }

    button.active {
      color: var(--color-accent);
    }

    .icon {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .icon svg {
      width: 100%;
      height: 100%;
    }

    .label {
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.02em;
    }

    @media (min-width: 769px) {
      :host {
        top: 0;
        bottom: auto;
        right: auto;
        width: 80px;
        height: 100vh;
        border-top: none;
        border-right: 1px solid var(--color-border);
      }

      nav {
        flex-direction: column;
        justify-content: flex-start;
        height: 100%;
        padding: var(--spacing-xl) 0;
        gap: var(--spacing-sm);
      }
    }
  `;

  private _nav(path: string): void {
    navigate(path);
  }

  private _isActive(path: string): boolean {
    return this.currentRoute === path;
  }

  render() {
    return html`
      <nav>
        <button
          class=${this._isActive('/') ? 'active' : ''}
          @click=${() => this._nav('/')}
        >
          <span class="icon">${iconHome}</span>
          <span class="label">${msg('Home')}</span>
        </button>
        <button
          class=${this._isActive('/co2') ? 'active' : ''}
          @click=${() => this._nav('/co2')}
        >
          <span class="icon">${iconCloud}</span>
          <span class="label">CO2</span>
        </button>
        <button
          class=${this._isActive('/o2') ? 'active' : ''}
          @click=${() => this._nav('/o2')}
        >
          <span class="icon">${iconWind}</span>
          <span class="label">O2</span>
        </button>
        <button
          class=${this._isActive('/history') ? 'active' : ''}
          @click=${() => this._nav('/history')}
        >
          <span class="icon">${iconBarChart2}</span>
          <span class="label">${msg('History')}</span>
        </button>
        <button
          class=${this._isActive('/settings') ? 'active' : ''}
          @click=${() => this._nav('/settings')}
        >
          <span class="icon">${iconSettings}</span>
          <span class="label">${msg('Settings')}</span>
        </button>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-nav': AppNav;
  }
}
