import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import { getSettings, saveSettings, savePB } from '../services/db.js';
import { formatTime } from '../services/tables.js';
import {
  playHoldStart,
  playBreatheStart,
  playCompleteChime,
  ensureAudioContext,
} from '../services/audio.js';
import { vibratePhaseChange, vibrateComplete } from '../services/vibration.js';
import { navigate } from '../app-shell.js';

type Step = 'intro' | 'relaxation' | 'warmup' | 'rest-before-max' | 'max-hold' | 'result';

const WARMUP_COUNT = 3;
const WARMUP_REST = 120; // 2 minutes

@localized()
@customElement('app-pb-test')
export class AppPbTest extends LitElement {
  @state() private _step: Step = 'intro';
  @state() private _oldPb = 0;
  @state() private _estimatedMax = 120;
  @state() private _currentWarmup = 0;
  @state() private _elapsed = 0;
  @state() private _remaining = 0;
  @state() private _running = false;
  @state() private _newPb = 0;
  @state() private _soundEnabled = true;
  @state() private _vibrationEnabled = true;

  private _intervalId: ReturnType<typeof setInterval> | null = null;
  private _startTime = 0;
  private _wakeLock: WakeLockSentinel | null = null;

  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      .page {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        min-height: 100dvh;
        padding: var(--spacing-xl);
        text-align: center;
        max-width: 500px;
        margin: 0 auto;
        padding-bottom: calc(var(--nav-height) + var(--spacing-xl));
      }

      h2 {
        font-size: var(--font-xl);
        font-weight: 800;
        color: var(--color-text-primary);
        margin-bottom: var(--spacing-md);
      }

      p {
        color: var(--color-text-secondary);
        line-height: 1.6;
        margin-bottom: var(--spacing-md);
      }

      .step-indicator {
        display: flex;
        gap: var(--spacing-xs);
        margin-bottom: var(--spacing-xl);
      }

      .step-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--color-border);
      }

      .step-dot.active {
        background: var(--color-accent);
        width: 24px;
        border-radius: 4px;
      }

      .step-dot.done {
        background: var(--color-success);
      }

      .timer-large {
        font-size: var(--font-timer);
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        color: var(--color-text-primary);
        margin: var(--spacing-xl) 0;
      }

      .timer-label {
        font-size: var(--font-sm);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: var(--spacing-sm);
      }

      .warmup-counter {
        font-size: var(--font-sm);
        color: var(--color-text-muted);
        margin-bottom: var(--spacing-md);
      }

      .actions {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-md);
        width: 100%;
        max-width: 300px;
        margin-top: var(--spacing-lg);
      }

      .estimate-input {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
        margin: var(--spacing-lg) 0;
        width: 100%;
        max-width: 300px;
      }

      .estimate-input label {
        font-size: var(--font-sm);
        color: var(--color-text-secondary);
      }

      .estimate-input input {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        color: var(--color-text-primary);
        font-size: var(--font-xl);
        font-weight: 700;
        text-align: center;
        font-family: inherit;
        font-variant-numeric: tabular-nums;
      }

      .estimate-input input:focus {
        outline: none;
        border-color: var(--color-accent);
      }

      .result-card {
        background: var(--color-bg-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--spacing-xl);
        width: 100%;
        max-width: 350px;
        margin: var(--spacing-lg) 0;
      }

      .result-pb {
        font-size: var(--font-3xl);
        font-weight: 800;
        color: var(--color-accent);
        margin: var(--spacing-md) 0;
      }

      .result-comparison {
        font-size: var(--font-sm);
        color: var(--color-text-secondary);
      }

      .result-improvement {
        color: var(--color-success);
        font-weight: 600;
      }

      .hold-phase {
        color: var(--color-hold);
      }

      .breathe-phase {
        color: var(--color-breathe);
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this._loadSettings();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopTimer();
    this._releaseWakeLock();
  }

  private async _loadSettings(): Promise<void> {
    const settings = await getSettings();
    this._oldPb = settings.personalBest;
    this._soundEnabled = settings.soundEnabled;
    this._vibrationEnabled = settings.vibrationEnabled;
    if (this._oldPb > 0) {
      this._estimatedMax = this._oldPb;
    }
  }

  private async _acquireWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this._wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch { /* not available */ }
  }

  private _releaseWakeLock(): void {
    this._wakeLock?.release();
    this._wakeLock = null;
  }

  private _startCountUp(): void {
    this._startTime = performance.now();
    this._elapsed = 0;
    this._running = true;
    this._intervalId = setInterval(() => {
      this._elapsed = Math.floor((performance.now() - this._startTime) / 1000);
    }, 100);
  }

  private _startCountDown(duration: number): void {
    this._remaining = duration;
    this._startTime = performance.now();
    this._running = true;
    this._intervalId = setInterval(() => {
      const elapsed = (performance.now() - this._startTime) / 1000;
      this._remaining = Math.max(Math.ceil(duration - elapsed), 0);
      if (this._remaining <= 0) {
        this._stopTimer();
        this._onCountdownEnd();
      }
    }, 100);
  }

  private _stopTimer(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._running = false;
  }

  private _onCountdownEnd(): void {
    if (this._step === 'relaxation') {
      this._step = 'warmup';
      this._currentWarmup = 0;
    } else if (this._step === 'warmup') {
      // Rest between warmups or move to max
      this._currentWarmup++;
      if (this._currentWarmup >= WARMUP_COUNT) {
        this._step = 'rest-before-max';
        this._startCountDown(WARMUP_REST);
        if (this._soundEnabled) playBreatheStart();
        if (this._vibrationEnabled) vibratePhaseChange();
      }
    } else if (this._step === 'rest-before-max') {
      this._step = 'max-hold';
    }
  }

  private _goToRelaxation(): void {
    ensureAudioContext();
    this._acquireWakeLock();
    this._step = 'relaxation';
    this._startCountDown(120); // 2 minutes relaxation
  }

  private _startWarmupHold(): void {
    if (this._soundEnabled) playHoldStart();
    if (this._vibrationEnabled) vibratePhaseChange();
    const warmupDuration = Math.round(this._estimatedMax * 0.5);
    this._startCountDown(warmupDuration);
  }

  private _endWarmupHold(): void {
    this._stopTimer();
    if (this._soundEnabled) playBreatheStart();

    this._currentWarmup++;
    if (this._currentWarmup >= WARMUP_COUNT) {
      this._step = 'rest-before-max';
      this._startCountDown(WARMUP_REST);
    } else {
      // Start rest countdown between warmups
      this._startCountDown(WARMUP_REST);
    }
  }

  private _startMaxHold(): void {
    if (this._soundEnabled) playHoldStart();
    if (this._vibrationEnabled) vibratePhaseChange();
    this._step = 'max-hold';
    this._startCountUp();
  }

  private _endMaxHold(): void {
    this._stopTimer();
    this._newPb = this._elapsed;
    if (this._soundEnabled) playCompleteChime();
    if (this._vibrationEnabled) vibrateComplete();
    this._releaseWakeLock();
    this._step = 'result';
  }

  private async _savePb(): Promise<void> {
    await saveSettings({ personalBest: this._newPb });
    await savePB({ date: Date.now(), value: this._newPb, source: 'test' });
    await import('../services/db.js').then((db) =>
      db.saveSession({
        id: crypto.randomUUID(),
        type: 'pb-test',
        date: Date.now(),
        completed: true,
        rounds: [],
        personalBest: this._newPb,
      }),
    );
    navigate('/');
  }

  private _getStepIndex(): number {
    const steps: Step[] = ['intro', 'relaxation', 'warmup', 'rest-before-max', 'max-hold', 'result'];
    return steps.indexOf(this._step);
  }

  render() {
    const stepIdx = this._getStepIndex();

    return html`
      <div class="page">
        <div class="step-indicator">
          ${[0, 1, 2, 3, 4, 5].map(
            (i) => html`
              <div
                class="step-dot ${i === stepIdx ? 'active' : ''} ${i < stepIdx ? 'done' : ''}"
              ></div>
            `,
          )}
        </div>

        ${this._renderStep()}
      </div>
    `;
  }

  private _renderStep() {
    switch (this._step) {
      case 'intro':
        return html`
          <h2>${msg('PB Test')}</h2>
          <p>
            ${msg('This guided test will determine your maximum breath-hold time. The result is used to generate your CO2 and O2 training tables.')}
          </p>
          <p>
            ${msg('The test consists of:')}
          </p>
          <p>
            ${msg(html`1. 2-minute relaxation phase<br />
            2. ${WARMUP_COUNT} warm-up holds at 50% estimated max<br />
            3. Final maximum breath hold`)}
          </p>
          <div class="estimate-input">
            <label>${msg('Estimated max hold (seconds)')}</label>
            <input
              type="number"
              inputmode="numeric"
              min="30"
              max="600"
              .value=${String(this._estimatedMax)}
              @input=${(e: Event) => {
                this._estimatedMax = parseInt((e.target as HTMLInputElement).value, 10) || 120;
              }}
            />
            <span style="font-size: var(--font-sm); color: var(--color-text-muted)">
              = ${formatTime(this._estimatedMax)}
            </span>
          </div>
          <div class="actions">
            <button class="btn btn-primary btn-large" @click=${this._goToRelaxation}>
              ${msg('Start Test')}
            </button>
            <button class="btn btn-secondary" @click=${() => navigate('/')}>${msg('Cancel')}</button>
          </div>
        `;

      case 'relaxation':
        return html`
          <h2 class="breathe-phase">${msg('Relax & Breathe')}</h2>
          <p>
            ${msg('Breathe calmly and naturally. Focus on slowing your heart rate. Inhale for 4 seconds, exhale for 8 seconds.')}
          </p>
          <div class="timer-label">${msg('Relaxation')}</div>
          <div class="timer-large">${this._formatTime(this._remaining)}</div>
          <div class="actions">
            <button class="btn btn-secondary" @click=${() => { this._stopTimer(); this._step = 'warmup'; this._currentWarmup = 0; }}>
              ${msg('Skip')}
            </button>
          </div>
        `;

      case 'warmup':
        return html`
          <h2>${msg('Warm-up Hold')}</h2>
          <div class="warmup-counter">
            ${msg(str`${this._currentWarmup + 1} of ${WARMUP_COUNT}`)}
          </div>
          ${this._running
            ? html`
                <div class="timer-label">
                  ${this._remaining > 0 ? msg('Rest') : msg('Hold')}
                </div>
                <div class="timer-large">${this._formatTime(this._remaining)}</div>
                ${this._remaining > 0
                  ? html`<p>${msg('Breathe calmly...')}</p>`
                  : html``}
              `
            : html`
                <p>
                  ${msg(str`Hold for ~${formatTime(Math.round(this._estimatedMax * 0.5))}. Don't push hard, this is just a warm-up.`)}
                </p>
                <div class="actions">
                  <button class="btn btn-primary btn-large" @click=${this._startWarmupHold}>
                    ${msg('Start Hold')}
                  </button>
                </div>
              `}
          ${this._running && this._remaining <= 0
            ? html`
                <div class="actions">
                  <button class="btn btn-secondary" @click=${this._endWarmupHold}>
                    ${msg('End Hold')}
                  </button>
                </div>
              `
            : ''}
        `;

      case 'rest-before-max':
        return html`
          <h2 class="breathe-phase">${msg('Final Preparation')}</h2>
          <p>
            ${msg('Breathe calmly for 2 minutes. Prepare for your maximum effort. Take a deep breath when ready.')}
          </p>
          <div class="timer-label">${msg('Rest')}</div>
          <div class="timer-large">${this._formatTime(this._remaining)}</div>
          <div class="actions">
            <button class="btn btn-primary btn-large" @click=${() => { this._stopTimer(); this._startMaxHold(); }}>
              ${msg("I'm Ready")}
            </button>
          </div>
        `;

      case 'max-hold':
        return html`
          <h2 class="hold-phase">${msg('Maximum Hold')}</h2>
          <p>${msg('Hold as long as you comfortably can.')}</p>
          <div class="timer-label">${msg('Elapsed')}</div>
          <div class="timer-large">${this._formatTime(this._elapsed)}</div>
          <div class="actions">
            <button class="btn btn-primary btn-large" @click=${this._endMaxHold}>
              ${msg("Stop - I'm Done")}
            </button>
          </div>
        `;

      case 'result':
        const improvement = this._oldPb > 0 ? this._newPb - this._oldPb : 0;

        return html`
          <h2>${msg('Result')}</h2>
          <div class="result-card">
            <div class="timer-label">${msg('Your Personal Best')}</div>
            <div class="result-pb">${this._formatTime(this._newPb)}</div>
            ${this._oldPb > 0
              ? html`
                  <div class="result-comparison">
                    ${msg(str`Previous: ${formatTime(this._oldPb)}`)}
                    ${improvement > 0
                      ? html`<span class="result-improvement">${msg(str`+${improvement}s`)}</span>`
                      : improvement < 0
                        ? html`<span style="color: var(--color-hold)">${msg(str`${improvement}s`)}</span>`
                        : html`<span>${msg(' (same)')}</span>`}
                  </div>
                `
              : ''}
          </div>
          <div class="actions">
            <button class="btn btn-primary btn-large" @click=${this._savePb}>
              ${msg('Save & Continue')}
            </button>
            <button class="btn btn-secondary" @click=${() => navigate('/')}>
              ${msg('Discard')}
            </button>
          </div>
        `;
    }
  }

  private _formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-pb-test': AppPbTest;
  }
}
