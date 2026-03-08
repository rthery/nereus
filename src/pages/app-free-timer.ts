import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import { getSettings, saveFreeSession } from '../services/db.js';
import {
  playHoldStart,
  playBreatheStart,
  playCompleteChime,
  ensureAudioContext,
} from '../services/audio.js';
import {
  vibratePhaseChange,
  vibrateComplete,
} from '../services/vibration.js';
import { navigate } from '../navigation.js';
import {
  iconCheckCircle,
  symbolActivity,
  symbolBreathe,
  symbolExhale,
  symbolHoldIn,
  symbolHoldOut,
  symbolInhale,
} from '../components/icons.js';
import { FreeEngine } from '../services/free-engine.js';
import type { FreeTimerState } from '../services/free-engine.js';
import type { FreePhaseType, FreePreset } from '../types.js';
import { formatTime } from '../services/tables.js';

function phaseColor(type: FreePhaseType): string {
  switch (type) {
    case 'breathing':   return 'var(--color-rest)';
    case 'inhale':      return 'var(--color-breathe)';
    case 'apnea-full':  return 'var(--color-breathe)';
    case 'exhale':      return 'var(--color-hold)';
    case 'apnea-empty': return 'var(--color-hold)';
    case 'activity':    return 'var(--color-activity)';
  }
}

function phaseTypeName(type: FreePhaseType): string {
  switch (type) {
    case 'breathing':   return msg('Breathing', { id: 'free-type-breathing' });
    case 'inhale':      return msg('Inhale', { id: 'free-type-inhale' });
    case 'apnea-full':  return msg('Apnea (full)', { id: 'free-type-apnea-full' });
    case 'exhale':      return msg('Exhale', { id: 'free-type-exhale' });
    case 'apnea-empty': return msg('Apnea (empty)', { id: 'free-type-apnea-empty' });
    case 'activity':    return msg('Activity', { id: 'free-type-activity' });
  }
}

function phaseTypeIcon(type: FreePhaseType) {
  switch (type) {
    case 'breathing':   return symbolBreathe;
    case 'inhale':      return symbolInhale;
    case 'apnea-full':  return symbolHoldIn;
    case 'exhale':      return symbolExhale;
    case 'apnea-empty': return symbolHoldOut;
    case 'activity':    return symbolActivity;
  }
}

@localized()
@customElement('app-free-timer')
export class AppFreeTimer extends LitElement {
  @property({ attribute: false }) sessionData: { preset: FreePreset } | null = null;

  @state() private _started = false;
  @state() private _completed = false;
  @state() private _running = false;
  @state() private _soundEnabled = true;
  @state() private _vibrationEnabled = true;
  @state() private _elapsedWallSeconds = 0;
  @state() private _developerMode = false;

  private _state: FreeTimerState | null = null;
  private _engine: FreeEngine | null = null;
  private _wakeLock: WakeLockSentinel | null = null;
  private _sessionStartTime = 0;
  private _wallInterval: ReturnType<typeof setInterval> | null = null;
  private _rafId: number | null = null;
  private _ringElement: SVGCircleElement | null = null;

  // SVG ring constants
  private static readonly RING_R = 110;
  private static readonly CIRCUMFERENCE = 2 * Math.PI * 110;

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

      .timer-page.breathing   { background: var(--color-rest-bg); }
      .timer-page.inhale      { background: var(--color-breathe-bg); }
      .timer-page.apnea-full  { background: var(--color-breathe-bg); }
      .timer-page.exhale      { background: var(--color-hold-bg); }
      .timer-page.apnea-empty { background: var(--color-hold-bg); }
      .timer-page.activity    { background: var(--color-activity-bg); }
      .timer-page.completed   { background: var(--color-bg-primary); }

      .top-bar {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: var(--spacing-md) var(--spacing-lg);
        padding-top: max(var(--spacing-md), env(safe-area-inset-top, 0));
      }

      .round-info {
        font-size: var(--font-sm);
        font-weight: 600;
        color: var(--color-text-secondary);
        text-align: center;
      }

      .timer-center {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-lg);
        gap: var(--spacing-md);
      }

      /* Phase name (user label) */
      .phase-name {
        font-size: var(--font-2xl);
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        text-align: center;
      }

      /* Phase type (semantic) */
      .phase-type {
        font-size: var(--font-sm);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        opacity: 0.7;
        margin-top: -8px;
        text-align: center;
      }

      /* SVG countdown ring */
      .timer-display {
        position: relative;
        width: 260px;
        height: 260px;
        flex-shrink: 0;
      }

      .ring-svg { width: 100%; height: 100%; transform: rotate(-90deg); }

      .ring-track {
        fill: none;
        stroke: var(--color-border);
        stroke-width: 6;
      }

      .ring-progress {
        fill: none;
        stroke-width: 6;
        stroke-linecap: round;
        transition: stroke var(--transition-normal);
      }

      .ring-progress.breathing   { stroke: var(--color-rest); }
      .ring-progress.inhale      { stroke: var(--color-breathe); }
      .ring-progress.apnea-full  { stroke: var(--color-breathe); }
      .ring-progress.exhale      { stroke: var(--color-hold); }
      .ring-progress.apnea-empty { stroke: var(--color-hold); }
      .ring-progress.activity    { stroke: var(--color-activity); }

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

      /* Count mode display */
      .count-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-md);
        padding: var(--spacing-xl) 0;
      }

      .count-remaining {
        font-size: 5rem;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        line-height: 1;
      }

      .count-total {
        font-size: var(--font-lg);
        color: var(--color-text-muted);
        font-variant-numeric: tabular-nums;
      }

      .tap-btn {
        width: 160px;
        height: 160px;
        border-radius: 50%;
        border: none;
        font-size: var(--font-xl);
        font-weight: 800;
        font-family: inherit;
        cursor: pointer;
        letter-spacing: 0.05em;
        transition: transform var(--transition-fast), opacity var(--transition-fast);
        -webkit-tap-highlight-color: transparent;
      }

      .tap-btn:active { transform: scale(0.93); }
      .tap-btn:disabled { opacity: 0.35; cursor: default; }

      .tap-btn.breathing   { background: var(--color-rest);    color: #fff; }
      .tap-btn.inhale      { background: var(--color-breathe); color: #fff; }
      .tap-btn.apnea-full  { background: var(--color-breathe); color: #fff; }
      .tap-btn.exhale      { background: var(--color-hold);    color: #fff; }
      .tap-btn.apnea-empty { background: var(--color-hold);    color: #fff; }
      .tap-btn.activity    { background: var(--color-activity); color: #fff; }

      /* Phase dots */
      .phase-dots {
        display: flex;
        gap: var(--spacing-md);
        align-items: center;
        flex-wrap: wrap;
        justify-content: center;
        max-width: 280px;
      }

      .phase-dot {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        transition: opacity var(--transition-fast);
        opacity: 0.2;
      }

      .phase-dot svg {
        width: 14px;
        height: 14px;
      }

      .phase-dot.done   { opacity: 0.45; }
      .phase-dot.active { opacity: 1; }

      .phase-dot.breathing   { color: var(--color-rest); }
      .phase-dot.inhale      { color: var(--color-breathe); }
      .phase-dot.apnea-full  { color: var(--color-breathe); }
      .phase-dot.exhale      { color: var(--color-hold); }
      .phase-dot.apnea-empty { color: var(--color-hold); }
      .phase-dot.activity    { color: var(--color-activity); }

      .bottom-area {
        padding: var(--spacing-lg);
        padding-bottom: max(var(--spacing-xl), env(safe-area-inset-bottom, 0));
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-md);
      }

      .control-btns {
        display: flex;
        gap: var(--spacing-md);
        width: 100%;
        max-width: 300px;
      }

      .control-btns .btn { flex: 1; }

      /* Pre-start */
      .pre-start {
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

      .pre-start h2 {
        font-size: var(--font-xl);
        font-weight: 800;
        color: var(--color-activity);
      }

      .pre-start p { color: var(--color-text-secondary); max-width: 400px; line-height: 1.5; }

      .pre-meta {
        font-size: var(--font-sm);
        color: var(--color-text-muted);
      }

      .phase-preview {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: var(--spacing-xs);
        max-width: 340px;
      }

      .phase-preview-item {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: var(--radius-full);
        font-size: var(--font-sm);
        font-weight: 700;
      }

      .phase-preview-item svg {
        width: 10px;
        height: 10px;
        flex-shrink: 0;
      }

      .phase-preview-item.breathing   { background: color-mix(in srgb, var(--color-rest) 18%, transparent); color: var(--color-rest); }
      .phase-preview-item.inhale      { background: color-mix(in srgb, var(--color-breathe) 18%, transparent); color: var(--color-breathe); }
      .phase-preview-item.apnea-full  { background: color-mix(in srgb, var(--color-breathe) 18%, transparent); color: var(--color-breathe); }
      .phase-preview-item.exhale      { background: color-mix(in srgb, var(--color-hold) 18%, transparent); color: var(--color-hold); }
      .phase-preview-item.apnea-empty { background: color-mix(in srgb, var(--color-hold) 18%, transparent); color: var(--color-hold); }
      .phase-preview-item.activity    { background: color-mix(in srgb, var(--color-activity) 18%, transparent); color: var(--color-activity); }

      .arrow { color: var(--color-text-muted); font-size: var(--font-xs); }

      /* Completed */
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

      .completed-icon svg { width: 64px; height: 64px; color: var(--color-success); }
      .completed-title { font-size: var(--font-2xl); font-weight: 800; color: var(--color-success); }

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

      .stat-label { font-size: var(--font-xs); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
      .stat-value { font-size: var(--font-xl); font-weight: 700; margin-top: var(--spacing-xs); }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this._loadSettings();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._engine?.destroy();
    this._releaseWakeLock();
    this._clearWallInterval();
    this._stopRaf();
    this._ringElement = null;
  }

  private async _loadSettings(): Promise<void> {
    const s = await getSettings();
    this._soundEnabled = s.soundEnabled;
    this._vibrationEnabled = s.vibrationEnabled;
    this._developerMode = s.developerMode ?? false;
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

  private _clearWallInterval(): void {
    if (this._wallInterval !== null) {
      clearInterval(this._wallInterval);
      this._wallInterval = null;
    }
  }

  // ---- rAF: update ring stroke-dashoffset each frame ----
  private _startRaf(): void {
    const C = AppFreeTimer.CIRCUMFERENCE;
    const frame = () => {
      if (!this._engine) { this._rafId = null; return; }
      if (!this._ringElement) {
        this._ringElement = this.shadowRoot?.querySelector<SVGCircleElement>('.ring-progress') ?? null;
      }
      const s = this._engine.state;
      if (this._ringElement && s.phase.mode === 'duration' && s.phaseDuration > 0) {
        const progress = Math.min(s.elapsed / s.phaseDuration, 1);
        const dashoffset = C * (1 - progress);
        this._ringElement.setAttribute('stroke-dashoffset', dashoffset.toFixed(1));
      }
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

  private _setState(next: FreeTimerState, force = false): void {
    const prev = this._state;
    this._state = next;
    if (
      force ||
      !prev ||
      prev.remaining !== next.remaining ||
      prev.running !== next.running ||
      prev.waitingForTap !== next.waitingForTap ||
      prev.round !== next.round ||
      prev.phaseIndex !== next.phaseIndex ||
      prev.phase !== next.phase ||
      prev.completed !== next.completed
    ) {
      this.requestUpdate();
    }
  }

  // ---- Timer control ----
  private _start(): void {
    if (!this.sessionData) return;
    ensureAudioContext();
    this._started = true;
    this._sessionStartTime = Date.now();
    this._ringElement = null;
    void this._acquireWakeLock();

    const { preset } = this.sessionData;

    this._engine = new FreeEngine({
      phases: preset.phases,
      totalRounds: preset.rounds,
      onTick: (s) => {
        this._setState(s);
        this._running = s.running;
      },
      onPhaseChange: (phase) => {
        if (this._soundEnabled) {
          if (phase.type === 'breathing' || phase.type === 'inhale') playBreatheStart();
          else playHoldStart();
        }
        if (this._vibrationEnabled) vibratePhaseChange();
      },
      onCountdown: () => { /* no countdown beep for free training */ },
      onComplete: () => {
        this._finishSession(true);
      },
    });

    this._setState(this._engine.state, true);
    this._running = true;
    this._engine.start();
    this._startRaf();

    this._wallInterval = setInterval(() => {
      this._elapsedWallSeconds = Math.floor((Date.now() - this._sessionStartTime) / 1000);
    }, 1000);
  }

  private _finishSession(completed: boolean): void {
    this._completed = true;
    this._running = false;
    this._releaseWakeLock();
    this._clearWallInterval();
    this._stopRaf();
    this._ringElement = null;
    if (this._soundEnabled) playCompleteChime();
    if (this._vibrationEnabled) vibrateComplete();
    void this._saveSession(completed);
  }

  private async _saveSession(completed: boolean): Promise<void> {
    if (!this.sessionData || !this._state) return;
    const elapsed = Math.floor((Date.now() - this._sessionStartTime) / 1000);
    const { preset } = this.sessionData;
    await saveFreeSession({
      id: crypto.randomUUID(),
      date: this._sessionStartTime,
      presetId: preset.id,
      presetName: preset.name,
      completedRounds: completed ? preset.rounds : Math.max(0, this._state.round - 1),
      totalRounds: preset.rounds,
      totalDuration: elapsed,
      completed,
    });
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
      this._ringElement = null;
      this._startRaf();
    }
  }

  private _tap(): void {
    this._engine?.advanceManual();
    if (this._engine) this._setState(this._engine.state, true);
  }

  private _abort(): void {
    this._engine?.abort();
    this._finishSession(false);
  }

  private _debugSkipPhase(): void {
    this._engine?.skipPhase();
    if (this._engine) this._setState(this._engine.state, true);
  }

  private _debugComplete(): void {
    this._engine?.abort();
    this._finishSession(true);
  }

  private _goBack(): void { navigate('/training'); }

  // ---- Render ----

  private _renderPhaseDots(preset: FreePreset, currentIndex: number) {
    // Show up to 10 dots; truncate beyond that
    const phases = preset.phases;
    const shown = phases.slice(0, 10);
    return html`
      <div class="phase-dots">
        ${shown.map((p, i) => {
          const cls = i < currentIndex ? 'done' : i === currentIndex ? 'active' : '';
          return html`<span class="phase-dot ${p.type} ${cls}">${phaseTypeIcon(p.type)}</span>`;
        })}
        ${phases.length > 10 ? html`<span style="font-size:10px;color:var(--color-text-muted)">…</span>` : ''}
      </div>
    `;
  }

  render() {
    if (!this.sessionData) {
      return html`
        <div class="pre-start">
          <h2>${msg('No session configured', { id: 'free-no-session' })}</h2>
          <button class="btn btn-primary" @click=${this._goBack}>${msg('Go back', { id: 'free-go-back' })}</button>
        </div>
      `;
    }

    const { preset } = this.sessionData;

    // ---- Pre-start screen ----
    if (!this._started) {
      const shown = preset.phases.slice(0, 5);
      const more = preset.phases.length - shown.length;

      return html`
        <div class="pre-start">
          <h2 style="color:var(--color-activity)">${preset.name}</h2>
          <p class="pre-meta">
            ${preset.rounds > 1
              ? msg(str`${preset.phases.length} phases × ${preset.rounds} rounds`, { id: 'free-pre-meta' })
              : msg(str`${preset.phases.length} phases`, { id: 'free-pre-meta-single' })}
          </p>

          <div class="phase-preview">
            ${shown.map((p, i) => html`
              ${i > 0 ? html`<span class="arrow">›</span>` : ''}
              <span class="phase-preview-item ${p.type}">
                <span>${phaseTypeIcon(p.type)}</span>
                ${p.label || phaseTypeName(p.type)}
                ${p.mode === 'duration' ? ` ${formatTime(p.duration ?? 0)}` : ` ×${p.count ?? 1}`}
              </span>
            `)}
            ${more > 0 ? html`<span class="arrow">+${more} more</span>` : ''}
          </div>

          <button class="btn btn-primary btn-large" @click=${this._start}>${msg('Begin', { id: 'free-begin' })}</button>
          <button class="btn btn-secondary" @click=${this._goBack}>${msg('Cancel', { id: 'free-cancel' })}</button>
        </div>
      `;
    }

    // ---- Completed screen ----
    if (this._completed && this._state) {
      const s = this._state;
      return html`
        <div class="completed-screen">
          <div class="completed-icon">${iconCheckCircle}</div>
          <div class="completed-title">${msg('Session Complete', { id: 'free-complete' })}</div>
          <div class="completed-stats">
            <div class="stat">
              <div class="stat-label">${msg('Duration', { id: 'free-stat-duration' })}</div>
              <div class="stat-value">${formatTime(this._elapsedWallSeconds)}</div>
            </div>
            <div class="stat">
              <div class="stat-label">${msg('Rounds', { id: 'free-stat-rounds' })}</div>
              <div class="stat-value">${s.totalRounds}</div>
            </div>
          </div>
          <div style="font-size:var(--font-sm);color:var(--color-text-muted)">${preset.name}</div>
          <button class="btn btn-primary btn-large" @click=${this._goBack}>${msg('Done', { id: 'free-done' })}</button>
        </div>
      `;
    }

    // ---- Active timer ----
    if (!this._state) return html``;
    const s = this._state;
    const phase = s.phase;
    const typeClass = phase.type;
    const color = phaseColor(phase.type);
    const circumference = AppFreeTimer.CIRCUMFERENCE;
    const progress = s.phaseDuration > 0 ? Math.min(s.elapsed / s.phaseDuration, 1) : 0;
    const dashoffset = (circumference * (1 - progress)).toFixed(1);
    const displayName = phase.label || phaseTypeName(phase.type);

    const roundInfo = s.totalRounds > 1
      ? msg(str`Round ${s.round} / ${s.totalRounds}  •  Phase ${s.phaseIndex + 1} / ${preset.phases.length}`, { id: 'free-round-info' })
      : msg(str`Phase ${s.phaseIndex + 1} / ${preset.phases.length}`, { id: 'free-phase-info' });

    return html`
      <div class="timer-page ${typeClass}">
        <div class="top-bar">
          <div class="round-info">${roundInfo}</div>
        </div>

        <div class="timer-center">
          <div class="phase-name" style="color:${color}">${displayName}</div>
          <div class="phase-type" style="color:${color}">${phaseTypeName(phase.type)}</div>

          ${phase.mode === 'duration' ? html`
            <div class="timer-display">
              <svg class="ring-svg" viewBox="0 0 260 260">
                <circle class="ring-track" cx="130" cy="130" r="${AppFreeTimer.RING_R}" />
                <circle
                  class="ring-progress ${typeClass}"
                  cx="130" cy="130"
                  r="${AppFreeTimer.RING_R}"
                  stroke-dasharray="${circumference.toFixed(1)}"
                  stroke-dashoffset="${dashoffset}"
                />
              </svg>
              <div class="timer-text">${s.remaining}</div>
            </div>
          ` : html`
            <div class="count-display">
              <div class="count-remaining" style="color:${color}">
                ×${phase.count ?? 1}
              </div>
              <button
                class="tap-btn ${typeClass}"
                ?disabled=${!s.waitingForTap}
                @click=${this._tap}
              >
                ${msg('TAP', { id: 'free-tap' })}
              </button>
            </div>
          `}

          ${this._renderPhaseDots(preset, s.phaseIndex)}
        </div>

        <div class="bottom-area">
          <div class="control-btns">
            ${phase.mode === 'duration' ? html`
              <button class="btn btn-secondary" @click=${this._togglePause}>
                ${this._running ? msg('Pause', { id: 'free-pause' }) : msg('Resume', { id: 'free-resume' })}
              </button>
            ` : ''}
            <button class="btn btn-danger" @click=${this._abort}>
              ${msg('Stop', { id: 'free-stop' })}
            </button>
          </div>
          ${import.meta.env.DEV && this._developerMode ? html`
            <div style="display:flex;gap:var(--spacing-xs)">
              <button
                class="btn btn-secondary"
                style="opacity:0.5;font-size:var(--font-xs);padding:var(--spacing-xs) var(--spacing-sm)"
                @click=${this._debugSkipPhase}
              >[DEV] Skip phase</button>
              <button
                class="btn btn-secondary"
                style="opacity:0.5;font-size:var(--font-xs);padding:var(--spacing-xs) var(--spacing-sm)"
                @click=${this._debugComplete}
              >[DEV] Complete</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-free-timer': AppFreeTimer;
  }
}
