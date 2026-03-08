import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { registerSW } from 'virtual:pwa-register'

/**
 * PWA Badge element.
 */
@customElement('pwa-badge')
export class PwaBadge extends LitElement {
    private _period = 60 * 60 * 1000 // check for updates every hour
    private _swActivated = false
    private _updateIntervalId: ReturnType<typeof setInterval> | null = null
    @state()
    private _offlineReady = false
    @state()
    private _needRefresh = false
    private _updateServiceWorker: undefined | ((reloadPage?: boolean) => Promise<void>)

    firstUpdated() {
        this._updateServiceWorker = registerSW({
            immediate: true,
            onOfflineReady: () => (this._offlineReady = true),
            onNeedRefresh: () => (this._needRefresh = true),
            onRegisteredSW: this._onRegisteredSW
        })
    }

    disconnectedCallback() {
        super.disconnectedCallback()
        if (this._updateIntervalId !== null) {
            clearInterval(this._updateIntervalId)
            this._updateIntervalId = null
        }
    }

    render() {
        const classes: string[] = []
        if (this._offlineReady)
            classes.push('show')
        else if (this._needRefresh) {
            classes.push('show', 'refresh')
        }
        const message = this._offlineReady
            ? 'App ready to work offline'
            : this._needRefresh
                ? 'New content available, click on reload button to update'
                : ''
        return html`
            <div
                id="pwa-toast"
                role="alert"
                aria-labelledby="toast-message"
                class=${classes.join(' ')}
            >
                <div class="message">
                    <span id="toast-message">${message}</span>
                </div>
                <div class="buttons">
                    <button id="pwa-refresh" type="button" @click=${this._refreshApp}>
                        Reload
                    </button>
                    <button id="pwa-close" type="button" @click=${this._closeBadge}>
                        Close
                    </button>
                </div>
            </div>
    `
    }

    private _refreshApp() {
        if (this._updateServiceWorker && this._needRefresh)
            this._updateServiceWorker()
    }

    private _closeBadge() {
        this._offlineReady = false
        this._needRefresh = false
    }

    private _onRegisteredSW(swUrl: string, r?: ServiceWorkerRegistration) {
        if (this._period <= 0) return
        if (r?.active?.state === 'activated') {
            this._swActivated = true
            this._registerPeriodicSync(swUrl, r)
        }
        else if (r?.installing) {
            r.installing.addEventListener('statechange', (e) => {
                const sw = e.target as ServiceWorker
                this._swActivated = sw.state === 'activated'
                if (this._swActivated)
                    this._registerPeriodicSync(swUrl, r)
            })
        }
    }

    private _registerPeriodicSync(swUrl: string, r: ServiceWorkerRegistration) {
        if (this._period <= 0) return
        if (this._updateIntervalId !== null) return

        this._updateIntervalId = setInterval(async () => {
            if ('onLine' in navigator && !navigator.onLine)
                return

            const resp = await fetch(swUrl, {
                cache: 'no-store',
                headers: {
                    'cache': 'no-store',
                    'cache-control': 'no-cache',
                },
            })

            if (resp?.status === 200)
                await r.update()
        }, this._period)
    }

    static styles = css`
    :host {
      max-width: 0;
      margin: 0;
      padding: 0;
    }

    #pwa-toast {
        visibility: hidden;
        position: fixed;
        right: 0;
        bottom: 80px;
        margin: 16px;
        padding: 12px 16px;
        border: 1px solid var(--color-border, rgba(139, 159, 194, 0.15));
        border-radius: 12px;
        z-index: 200;
        text-align: left;
        background: var(--color-bg-surface, #162340);
        color: var(--color-text-primary, #e8edf5);
        box-shadow: 0 4px 12px var(--color-shadow, rgba(0, 0, 0, 0.3));
        display: grid;
        font-size: 14px;
    }
    #pwa-toast .message {
        margin-bottom: 8px;
    }
    #pwa-toast .buttons {
        display: flex;
        gap: 8px;
    }
    #pwa-toast button {
        border: 1px solid var(--color-border, rgba(139, 159, 194, 0.15));
        outline: none;
        border-radius: 999px;
        padding: 4px 14px;
        background: var(--color-bg-surface-hover, #1c2d52);
        color: var(--color-text-primary, #e8edf5);
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
    }
    #pwa-toast button#pwa-refresh {
        background: var(--color-accent, #22b8cf);
        color: #fff;
        border-color: var(--color-accent, #22b8cf);
    }
    #pwa-toast.show {
        visibility: visible;
    }
    button#pwa-refresh {
        display: none;
    }
    #pwa-toast.show.refresh button#pwa-refresh {
        display: block;
    }
  `
}

declare global {
    interface HTMLElementTagNameMap {
        'pwa-badge': PwaBadge
    }
}
