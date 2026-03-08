import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import { TimerEngine } from '../services/timer-engine.js';
import { getSettings, saveSession, getSessionsToday, getSessionsYesterday } from '../services/db.js';
import {
  playHoldStart,
  playBreatheStart,
  playCountdownBeep,
  playCompleteChime,
  ensureAudioContext,
} from '../services/audio.js';
import {
  vibratePhaseChange,
  vibrateCountdown,
  vibrateComplete,
} from '../services/vibration.js';
import { formatTime } from '../services/tables.js';
import { navigate } from '../navigation.js';
import { iconCheckCircle, iconAlertTriangle, symbolBreathe, symbolHoldIn } from '../components/icons.js';
import type { TableRound, Phase, TimerState, TableType } from '../types.js';

@localized()
@customElement('app-timer')
export class AppTimer extends LitElement {
  @property({ attribute: false }) tableData: { table: TableRound[]; type: TableType } | null = null;

  @state() private _phase: Phase = 'breathe';
  @state() private _round = 0;
  @state() private _totalRounds = 0;
  @state() private _remaining = 0;
  @state() private _running = false;
  @state() private _completed = false;
  @state() private _soundEnabled = true;
  @state() private _vibrationEnabled = true;
  @state() private _developerMode = false;
  @state() private _contractionCount = 0;
  @state() private _started = false;

  // Training-frequency warnings shown on the pre-start screen.
  @state() private _warnSameType = false;
  @state() private _warnOtherType = false;
  @state() private _warnYesterdayType: 'same' | 'other' | null = null;
  private _warningsLoaded = false;

  private _engine: TimerEngine | null = null;
  private _wakeLock: WakeLockSentinel | null = null;
  private _rafId: number | null = null;
  private static readonly _circumference = 2 * Math.PI * 120;

  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        min-height: 100dvh;
      }

      .timer-page {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        min-height: 100dvh;
        transition: background var(--transition-normal);
      }

      .timer-page.breathe {
        background: var(--color-breathe-bg);
      }

      .timer-page.hold {
        background: var(--color-hold-bg);
      }

      .timer-page.completed {
        background: var(--color-bg-primary);
      }

      .top-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-md) var(--spacing-lg);
        padding-top: max(var(--spacing-md), env(safe-area-inset-top, 0));
      }

.round-info {
        font-size: var(--font-sm);
        font-weight: 600;
        color: var(--color-text-secondary);
      }

      .timer-center {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-lg);
        gap: var(--spacing-lg);
      }

      .phase-label {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        font-size: var(--font-xl);
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .phase-label .sym {
        display: flex;
        align-items: center;
        width: 20px;
        height: 20px;
      }

      .phase-label .sym svg { width: 100%; height: 100%; }

      .phase-label.breathe { color: var(--color-breathe); }
      .phase-label.hold { color: var(--color-hold); }

      .timer-display {
        position: relative;
        width: 260px;
        height: 260px;
      }

      .timer-ring {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }

      .timer-ring-bg {
        fill: none;
        stroke: var(--color-border);
        stroke-width: 6;
      }

      .timer-ring-progress {
        fill: none;
        stroke-width: 6;
        stroke-linecap: round;
        /* No CSS transition — rAF drives stroke-dashoffset directly for smooth 60fps */
      }

      .timer-ring-progress.breathe { stroke: var(--color-breathe); }
      .timer-ring-progress.hold { stroke: var(--color-hold); }

      .timer-text {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--font-timer);
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        color: var(--color-text-primary);
      }

      .round-dots {
        display: flex;
        gap: var(--spacing-sm);
      }

      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--color-border);
        transition: background var(--transition-fast);
      }

      .dot.done {
        background: var(--color-success);
      }

      .dot.current {
        background: var(--color-accent);
        box-shadow: 0 0 8px var(--color-accent);
      }

      .bottom-area {
        padding: var(--spacing-lg);
        padding-bottom: max(var(--spacing-xl), env(safe-area-inset-bottom, 0));
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-md);
      }

      .contraction-btn {
        width: 100%;
        max-width: 300px;
        padding: var(--spacing-md);
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        color: var(--color-text-secondary);
        font-size: var(--font-sm);
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: background var(--transition-fast);
      }

      .contraction-btn:active {
        background: rgba(255, 255, 255, 0.15);
      }

      .control-btns {
        display: flex;
        gap: var(--spacing-md);
        width: 100%;
        max-width: 300px;
      }

      .control-btns .btn {
        flex: 1;
      }

      .pre-start {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        min-height: 100dvh;
        padding: var(--spacing-xl);
        gap: var(--spacing-xl);
        text-align: center;
      }

      .warning-banner {
        width: 100%;
        max-width: 400px;
        padding: var(--spacing-sm) var(--spacing-md);
        background: rgba(245, 158, 11, 0.12);
        border: 1px solid rgba(245, 158, 11, 0.5);
        border-radius: var(--radius-md);
        color: var(--color-text-primary);
        font-size: var(--font-sm);
        line-height: 1.5;
        text-align: left;
      }

      .pre-start h2 {
        font-size: var(--font-xl);
        color: var(--color-text-primary);
      }

      .pre-start p {
        color: var(--color-text-secondary);
        max-width: 400px;
        line-height: 1.5;
      }

      .completed-screen {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        min-height: 100dvh;
        padding: var(--spacing-xl);
        gap: var(--spacing-lg);
        text-align: center;
      }

      .completed-icon {
        margin-bottom: var(--spacing-md);
      }

      .completed-icon svg {
        width: 64px;
        height: 64px;
      }

      .completed-title {
        font-size: var(--font-2xl);
        font-weight: 800;
        color: var(--color-success);
      }

      .completed-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--spacing-md);
        width: 100%;
        max-width: 300px;
      }

      .stat {
        background: var(--color-bg-surface);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        border: 1px solid var(--color-border);
      }

      .stat-label {
        font-size: var(--font-xs);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .stat-value {
        font-size: var(--font-xl);
        font-weight: 700;
        margin-top: var(--spacing-xs);
      }

      .table-sidebar {
        display: none;
      }

      @media (min-width: 900px) {
        .timer-page {
          flex-direction: row;
        }

        .timer-center {
          flex: 1;
        }

        .table-sidebar {
          display: flex;
          flex-direction: column;
          width: 280px;
          padding: var(--spacing-lg);
          background: var(--color-bg-surface);
          border-left: 1px solid var(--color-border);
          overflow-y: auto;
        }

        .sidebar-title {
          font-size: var(--font-sm);
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: var(--spacing-md);
          padding-top: var(--spacing-xl);
        }

        .sidebar-round {
          display: flex;
          justify-content: space-between;
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-sm);
          font-size: var(--font-sm);
          margin-bottom: 2px;
          color: var(--color-text-secondary);
        }

        .sidebar-round.current {
          background: var(--color-accent-subtle);
          color: var(--color-text-primary);
          font-weight: 600;
        }

        .sidebar-round.done {
          opacity: 0.5;
        }
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this._loadSettings();
  }

  protected override updated(changedProps: Map<string, unknown>): void {
    super.updated(changedProps);
    if (changedProps.has('tableData') && this.tableData && !this._warningsLoaded) {
      void this._loadWarnings();
    }
  }

  private async _loadWarnings(): Promise<void> {
    this._warningsLoaded = true;
    if (!this.tableData) return;
    const type = this.tableData.type;
    const otherType: TableType = type === 'co2' ? 'o2' : 'co2';

    const todaySessions = await getSessionsToday();
    const completedTrainingToday = todaySessions.filter(
      (s) => s.completed && (s.type === 'co2' || s.type === 'o2'),
    );
    const sameToday = completedTrainingToday.some((s) => s.type === type);
    const otherToday = completedTrainingToday.some((s) => s.type === otherType);

    if (sameToday) {
      this._warnSameType = true;
    } else if (otherToday) {
      this._warnOtherType = true;
    } else {
      const yesterdaySessions = await getSessionsYesterday();
      const completedYesterday = yesterdaySessions.filter(
        (s) => s.completed && (s.type === 'co2' || s.type === 'o2'),
      );
      if (completedYesterday.some((s) => s.type === type)) {
        this._warnYesterdayType = 'same';
      } else if (completedYesterday.some((s) => s.type === otherType)) {
        this._warnYesterdayType = 'other';
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._engine?.destroy();
    this._releaseWakeLock();
    this._stopRaf();
  }

  private async _loadSettings(): Promise<void> {
    const settings = await getSettings();
    this._soundEnabled = settings.soundEnabled;
    this._vibrationEnabled = settings.vibrationEnabled;
    this._developerMode = settings.developerMode ?? false;
  }

  private async _acquireWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this._wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch {
      // Wake lock not available
    }
  }

  private _releaseWakeLock(): void {
    this._wakeLock?.release();
    this._wakeLock = null;
  }

  // ---- rAF animation loop: directly updates ring stroke-dashoffset at 60fps ----
  private _startRaf(): void {
    const C = AppTimer._circumference;
    const frame = () => {
      if (!this._engine) { this._rafId = null; return; }
      const s = this._engine.state;
      const progress = s.phaseDuration > 0 ? Math.min(s.elapsed / s.phaseDuration, 1) : 0;
      const dashOffset = C * (1 - progress);
      const ring = this.shadowRoot?.querySelector<SVGCircleElement>('.timer-ring-progress');
      if (ring) ring.setAttribute('stroke-dashoffset', dashOffset.toFixed(1));
      this._rafId = requestAnimationFrame(frame);
    };
    this._rafId = requestAnimationFrame(frame);
  }

  private _stopRaf(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  private _start(): void {
    if (!this.tableData) return;

    ensureAudioContext();
    this._started = true;
    this._acquireWakeLock();

    this._engine = new TimerEngine({
      table: this.tableData.table,
      onTick: (s: TimerState) => {
        this._remaining = s.remaining;
        this._running = s.running;
      },
      onPhaseChange: (phase: Phase, round: number) => {
        this._phase = phase;
        this._round = round;
        this._contractionCount =
          this._engine?.results[round]?.contractions.length ?? 0;

        if (this._soundEnabled) {
          if (phase === 'hold') playHoldStart();
          else playBreatheStart();
        }
        if (this._vibrationEnabled) vibratePhaseChange();
      },
      onCountdown: (sec: number) => {
        if (this._soundEnabled) playCountdownBeep();
        if (this._vibrationEnabled && sec <= 1) vibrateCountdown();
      },
      onComplete: () => {
        this._completed = true;
        this._stopRaf();
        if (this._soundEnabled) playCompleteChime();
        if (this._vibrationEnabled) vibrateComplete();
        this._releaseWakeLock();
        this._saveSession(true);
      },
    });

    this._totalRounds = this.tableData.table.length;
    this._remaining = this.tableData.table[0].rest;
    this._engine.start();
    this._startRaf();
  }

  private _togglePause(): void {
    if (!this._engine) return;
    if (this._running) {
      this._engine.stop();
      this._running = false;
      this._stopRaf();
    } else {
      this._engine.resume();
      this._running = true;
      this._startRaf();
    }
  }

  private _abort(): void {
    this._engine?.abort();
    this._completed = true;
    this._running = false;
    this._releaseWakeLock();
    this._stopRaf();
    this._saveSession(false);
  }

  /** DEV only: instantly end the session and save it as completed. */
  private _debugComplete(): void {
    this._engine?.abort();
    this._completed = true;
    this._running = false;
    this._releaseWakeLock();
    this._stopRaf();
    void this._saveSession(true);
  }

  /** DEV only: skip the current phase (breathe→hold, or hold→next round / complete). */
  private _debugFinishPhase(): void {
    this._engine?.skipPhase();
  }

  private _markContraction(): void {
    this._engine?.markContraction();
    this._contractionCount =
      this._engine?.results[this._round]?.contractions.length ?? 0;
  }

  private async _saveSession(completed: boolean): Promise<void> {
    if (!this.tableData || !this._engine) return;
    await saveSession({
      id: crypto.randomUUID(),
      type: this.tableData.type,
      date: Date.now(),
      completed,
      rounds: this._engine.results,
      table: this.tableData.table,
    });
  }

  private _goHome(): void {
    navigate('/');
  }

  private _formatRemaining(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  render() {
    if (!this.tableData) {
      return html`
        <div class="pre-start">
          <h2>${msg('No table data')}</h2>
          <p>${msg('Please configure a table first.')}</p>
          <button class="btn btn-primary" @click=${this._goHome}>${msg('Go Home')}</button>
        </div>
      `;
    }

    if (!this._started) {
      const typeLabel = this.tableData.type.toUpperCase();
      const otherLabel = this.tableData.type === 'co2' ? 'O2' : 'CO2';
      return html`
        <div class="pre-start">
          <h2>${msg(str`${typeLabel} Table Exercise`)}</h2>
          <p>
            ${msg(str`${this.tableData.table.length} rounds. Total time: ~${formatTime(
              this.tableData.table.reduce((s, r) => s + r.rest + r.hold, 0),
            )}.`)}
          </p>
          <p>${msg('Find a comfortable position. Relax and breathe naturally.')}</p>

          ${this._warnSameType ? html`
            <div class="warning-banner">
              ${msg(str`You have already completed a ${typeLabel} session today. Training the same type twice in one day is counterproductive.`)}
            </div>
          ` : ''}
          ${this._warnOtherType ? html`
            <div class="warning-banner">
              ${msg(str`You already did a ${otherLabel} session today. Combining CO2 and O2 training on the same day is not recommended.`)}
            </div>
          ` : ''}
          ${this._warnYesterdayType === 'same' ? html`
            <div class="warning-banner">
              ${msg(str`You did a ${typeLabel} session yesterday. Alternate between CO2 and O2 training, and allow rest days between sessions.`)}
            </div>
          ` : ''}
          ${this._warnYesterdayType === 'other' ? html`
            <div class="warning-banner">
              ${msg('You trained yesterday. Allow at least one rest day between sessions for best recovery.')}
            </div>
          ` : ''}

          <button class="btn btn-primary btn-large" @click=${this._start}>
            ${msg('Begin')}
          </button>
          <button class="btn btn-secondary" @click=${this._goHome}>${msg('Cancel')}</button>
        </div>
      `;
    }

    if (this._completed) {
      const results = this._engine?.results ?? [];
      const completedRounds = results.filter((r) => r.completed).length;
      const totalContractions = results.reduce(
        (s, r) => s + r.contractions.length,
        0,
      );

      return html`
        <div class="completed-screen">
          <div class="completed-icon">${completedRounds === this._totalRounds ? iconCheckCircle : iconAlertTriangle}</div>
          <div class="completed-title">
            ${completedRounds === this._totalRounds ? msg('Exercise Complete') : msg('Exercise Stopped')}
          </div>
          <div class="completed-stats">
            <div class="stat">
              <div class="stat-label">${msg('Rounds')}</div>
              <div class="stat-value">${completedRounds}/${this._totalRounds}</div>
            </div>
            <div class="stat">
              <div class="stat-label">${msg('Contractions')}</div>
              <div class="stat-value">${totalContractions}</div>
            </div>
          </div>
          <button class="btn btn-primary btn-large" @click=${this._goHome}>
            ${msg('Done')}
          </button>
        </div>
      `;
    }

    const circumference = AppTimer._circumference;

    return html`
      <div class="timer-page ${this._phase}">
        <div class="top-bar">
          <div></div>
          <div class="round-info">
            ${msg(str`Round ${this._round + 1} of ${this._totalRounds}`)}
          </div>
          <div></div>
        </div>

        <div class="timer-center">
          <div class="phase-label ${this._phase}">
            <span class="sym">${this._phase === 'breathe' ? symbolBreathe : symbolHoldIn}</span>
            ${this._phase === 'breathe' ? msg('Breathe') : msg('Hold')}
          </div>

          <div class="timer-display">
            <svg class="timer-ring" viewBox="0 0 260 260">
              <circle class="timer-ring-bg" cx="130" cy="130" r="120" />
              <circle
                class="timer-ring-progress ${this._phase}"
                cx="130"
                cy="130"
                r="120"
                stroke-dasharray=${circumference}
                stroke-dashoffset=${circumference}
              />
            </svg>
            <div class="timer-text">${this._formatRemaining(this._remaining)}</div>
          </div>

          <div class="round-dots">
            ${Array.from({ length: this._totalRounds }, (_, i) => {
              let cls = '';
              if (i < this._round) cls = 'done';
              else if (i === this._round) cls = 'current';
              return html`<span class="dot ${cls}"></span>`;
            })}
          </div>
        </div>

        <div class="bottom-area">
          ${this._phase === 'hold'
            ? html`
                <button class="contraction-btn" @click=${this._markContraction}>
                  ${msg(str`Tap for contraction (${this._contractionCount})`)}
                </button>
              `
            : ''}
          <div class="control-btns">
            <button class="btn btn-secondary" @click=${this._togglePause}>
              ${this._running ? msg('Pause') : msg('Resume')}
            </button>
            <button class="btn btn-danger" @click=${this._abort}>${msg('Stop')}</button>
          </div>
          ${import.meta.env.DEV && this._developerMode ? html`
            <div style="display:flex;gap:var(--spacing-xs)">
              <button
                class="btn btn-secondary"
                style="opacity:0.5;font-size:var(--font-xs);padding:var(--spacing-xs) var(--spacing-sm)"
                @click=${this._debugFinishPhase}
              >
                [DEV] Complete timer
              </button>
              <button
                class="btn btn-secondary"
                style="opacity:0.5;font-size:var(--font-xs);padding:var(--spacing-xs) var(--spacing-sm)"
                @click=${this._debugComplete}
              >
                [DEV] Complete training
              </button>
            </div>
          ` : ''}
        </div>

        <div class="table-sidebar">
          <div class="sidebar-title">${msg('Table')}</div>
          ${this.tableData.table.map(
            (r, i) => html`
              <div
                class="sidebar-round ${i === this._round ? 'current' : ''} ${i < this._round ? 'done' : ''}"
              >
                <span>#${i + 1}</span>
                <span>${formatTime(r.rest)} / ${formatTime(r.hold)}</span>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-timer': AppTimer;
  }
}
