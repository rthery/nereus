import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import { sharedStyles } from '../styles/theme.js';
import { getSettings, saveBreathingSession } from '../services/db.js';
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
import { iconCheckCircle, symbolInhale, symbolExhale, symbolHoldIn, symbolHoldOut } from '../components/icons.js';
import { BreathingEngine } from '../services/breathing-engine.js';
import { activePhases } from '../services/breathing-presets.js';
import type { BreathingPhase, BreathingSessionConfig, BreathingPresetId } from '../types.js';

@localized()
@customElement('app-breathing-timer')
export class AppBreathingTimer extends LitElement {
  @property({ attribute: false }) sessionConfig: BreathingSessionConfig | null = null;

  @state() private _phase: BreathingPhase = { label: 'inhale', duration: 0 };
  @state() private _phaseIndex = 0;
  @state() private _cycle = 1;
  @state() private _remaining = 0;
  @state() private _running = false;
  @state() private _completed = false;
  @state() private _started = false;
  @state() private _soundEnabled = true;
  @state() private _vibrationEnabled = true;
  @state() private _elapsedWallSeconds = 0;

  private _engine: BreathingEngine | null = null;
  private _wakeLock: WakeLockSentinel | null = null;
  private _sessionStartTime = 0;
  private _wallInterval: ReturnType<typeof setInterval> | null = null;
  private _rafId: number | null = null;
  private _fillCircle: SVGCircleElement | null = null;

  private static readonly MIN_R = 58;
  private static readonly MAX_R = 118;

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

      .timer-page.inhale,
      .timer-page.hold-in { background: var(--color-breathe-bg); }
      .timer-page.exhale,
      .timer-page.hold-out { background: var(--color-hold-bg); }
      .timer-page.completed { background: var(--color-bg-primary); }

      .top-bar {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: var(--spacing-md) var(--spacing-lg);
        padding-top: max(var(--spacing-md), env(safe-area-inset-top, 0));
      }

      .cycle-info {
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

      .phase-label.inhale,
      .phase-label.hold-in { color: var(--color-breathe); }
      .phase-label.exhale,
      .phase-label.hold-out { color: var(--color-hold); }

      .timer-display {
        position: relative;
        width: 260px;
        height: 260px;
      }

      .breath-svg { width: 100%; height: 100%; }

      .circle-track {
        fill: none;
        stroke: var(--color-border);
        stroke-width: 2;
      }

      /* Dashed guide ring at MIN_R — shows the exhale floor.
         Use white semi-transparent so it's visible on top of both the blue (breathe)
         and orange (hold) fill colors. --color-border is rgba(…,0.15) which is far
         too faint once the fill circle covers it, hence the explicit rgba here. */
      .circle-min-track {
        fill: none;
        stroke: rgba(255, 255, 255, 0.65);
        stroke-width: 1.5;
        stroke-dasharray: 4 5;
      }

      /* No CSS transition — rAF drives r directly for smooth 60fps */
      .breath-fill { opacity: 0.55; }
      .breath-fill.inhale,
      .breath-fill.hold-in { fill: var(--color-breathe); }
      .breath-fill.exhale,
      .breath-fill.hold-out { fill: var(--color-hold); }

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

      .phase-dots {
        display: flex;
        gap: var(--spacing-md);
        align-items: center;
      }

      /* Phase step indicator — shows each phase's symbol in its semantic color.
         Inactive phases are dimmed; active is fully visible; done phases are mid-opacity. */
      .phase-dot {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        opacity: 0.2;
        transition: opacity var(--transition-fast);
      }

      .phase-dot svg { width: 14px; height: 14px; }

      .phase-dot.inhale,
      .phase-dot.hold-in { color: var(--color-breathe); }
      .phase-dot.exhale,
      .phase-dot.hold-out { color: var(--color-hold); }
      .phase-dot.done { opacity: 0.45; }
      .phase-dot.active { opacity: 1; }

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
        gap: var(--spacing-xl);
        text-align: center;
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

      .phase-preview {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: var(--spacing-sm);
        align-items: center;
        max-width: 340px;
      }

      .phase-preview-item {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: var(--radius-full);
        font-size: var(--font-sm);
        font-weight: 600;
      }

      .phase-preview-item.inhale,
      .phase-preview-item.hold-in {
        background: color-mix(in srgb, var(--color-breathe) 18%, transparent);
        color: var(--color-breathe);
      }

      .phase-preview-item.exhale,
      .phase-preview-item.hold-out {
        background: color-mix(in srgb, var(--color-hold) 18%, transparent);
        color: var(--color-hold);
      }

      .phase-preview-item svg { width: 10px; height: 10px; }

      .arrow {
        color: var(--color-text-muted);
        font-size: var(--font-xs);
      }

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

      .completed-icon svg { width: 64px; height: 64px; }

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
    this._fillCircle = null;
  }

  private async _loadSettings(): Promise<void> {
    const s = await getSettings();
    this._soundEnabled = s.soundEnabled;
    this._vibrationEnabled = s.vibrationEnabled;
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

  // ---- rAF animation loop: directly updates SVG circle r at 60fps ----
  private _startRaf(): void {
    const { MIN_R, MAX_R } = AppBreathingTimer;
    const frame = () => {
      if (!this._engine) { this._rafId = null; return; }
      if (!this._fillCircle) {
        this._fillCircle = this.shadowRoot?.querySelector<SVGCircleElement>('.breath-fill') ?? null;
      }
      const s = this._engine.state;
      const progress = s.phaseDuration > 0 ? Math.min(s.elapsed / s.phaseDuration, 1) : 1;

      let r: number;
      switch (s.phase.label) {
        case 'inhale':   r = MIN_R + (MAX_R - MIN_R) * progress; break;
        case 'hold-in':  r = MAX_R; break;
        case 'exhale':   r = MAX_R - (MAX_R - MIN_R) * progress; break;
        case 'hold-out': r = MIN_R; break;
      }

      if (this._fillCircle) this._fillCircle.setAttribute('r', r.toFixed(1));

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

  // ---- Timer control ----
  private _start(): void {
    if (!this.sessionConfig) return;
    ensureAudioContext();
    this._started = true;
    this._sessionStartTime = Date.now();
    this._fillCircle = null;
    void this._acquireWakeLock();

    const { preset, durationMode, totalCycles, totalMinutes } = this.sessionConfig;
    const cycles = durationMode === 'cycles' ? totalCycles : 0;

    this._engine = new BreathingEngine({
      preset,
      totalCycles: cycles,
      onTick: (s) => {
        this._remaining = s.remaining;
        this._running = s.running;

        // Minutes mode: check wall time
        if (durationMode === 'minutes') {
          const elapsed = (Date.now() - this._sessionStartTime) / 1000;
          if (elapsed >= totalMinutes * 60) {
            this._engine?.abort();
            this._finishSession(true);
          }
        }
      },
      onPhaseChange: (phase, idx, cycle) => {
        this._phase = phase;
        this._phaseIndex = idx;
        this._cycle = cycle;
        if (this._soundEnabled) {
          if (phase.label === 'inhale') playBreatheStart();
          else if (phase.label === 'exhale') playHoldStart();
        }
        if (this._vibrationEnabled) vibratePhaseChange();
      },
      // No countdown sound — only phase-boundary sounds
      onComplete: () => {
        this._finishSession(true);
      },
    });

    const phases = activePhases(preset);
    if (phases.length > 0) {
      this._phase = phases[0];
      this._remaining = phases[0].duration;
    }
    this._engine.start();
    this._startRaf();

    if (durationMode === 'minutes') {
      this._wallInterval = setInterval(() => {
        this._elapsedWallSeconds = Math.floor((Date.now() - this._sessionStartTime) / 1000);
      }, 1000);
    }
  }

  private _finishSession(completed: boolean): void {
    this._completed = true;
    this._running = false;
    this._releaseWakeLock();
    this._clearWallInterval();
    this._stopRaf();
    this._fillCircle = null;
    if (this._soundEnabled) playCompleteChime();
    if (this._vibrationEnabled) vibrateComplete();
    void this._saveSession(completed);
  }

  private async _saveSession(completed: boolean): Promise<void> {
    if (!this.sessionConfig) return;
    const elapsed = Math.floor((Date.now() - this._sessionStartTime) / 1000);
    await saveBreathingSession({
      id: crypto.randomUUID(),
      date: this._sessionStartTime,
      presetId: this.sessionConfig.preset.id as BreathingPresetId,
      presetName: this.sessionConfig.preset.name,
      completedCycles: Math.max(0, this._cycle - 1),
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
      this._fillCircle = null;
      this._startRaf();
    }
  }

  private _abort(): void {
    this._engine?.abort();
    this._finishSession(false);
  }

  private _goBack(): void { navigate('/training'); }

  // ---- Helpers ----
  private _presetDisplayName(id: BreathingPresetId): string {
    switch (id) {
      case 'coherence':  return msg('Coherent Breathing');
      case 'box':        return msg('Box Breathing');
      case '4-7-8':      return msg('4-7-8 Breath');
      case 'apnea-prep': return msg('Freediving Prep');
      case 'custom':     return msg('Custom');
    }
  }

  private _phaseText(label: BreathingPhase['label']): string {
    switch (label) {
      case 'inhale':   return msg('Inhale');
      case 'hold-in':  return msg('Hold', { id: 'breathing-hold' });
      case 'exhale':   return msg('Exhale');
      case 'hold-out': return msg('Hold', { id: 'breathing-hold' });
    }
  }

  private _phaseSymbol(label: BreathingPhase['label']) {
    switch (label) {
      case 'inhale':   return symbolInhale;
      case 'hold-in':  return symbolHoldIn;
      case 'exhale':   return symbolExhale;
      case 'hold-out': return symbolHoldOut;
    }
  }

  private _formatSeconds(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  render() {
    if (!this.sessionConfig) {
      return html`
        <div class="pre-start">
          <h2>${msg('No session configured')}</h2>
          <button class="btn btn-primary" @click=${this._goBack}>${msg('Go back')}</button>
        </div>
      `;
    }

    // ---- Pre-start screen ----
    if (!this._started) {
      const { preset, durationMode, totalCycles, totalMinutes } = this.sessionConfig;
      const phases = activePhases(preset);
      const durationLabel = durationMode === 'cycles'
        ? msg(str`${totalCycles} cycles`)
        : msg(str`${totalMinutes} min`);

      return html`
        <div class="pre-start">
          <h2>${this._presetDisplayName(preset.id as BreathingPresetId)}</h2>
          <p>${durationLabel}</p>

          <div class="phase-preview">
            ${phases.map((p, i) => html`
              ${i > 0 ? html`<span class="arrow">›</span>` : ''}
              <span class="phase-preview-item ${p.label}">
                <span>${this._phaseSymbol(p.label)}</span>
                ${this._phaseText(p.label)} ${p.duration}s
              </span>
            `)}
          </div>

          <p>${msg('Find a comfortable position. Breathe naturally and relax.')}</p>
          <button class="btn btn-primary btn-large" @click=${this._start}>${msg('Begin')}</button>
          <button class="btn btn-secondary" @click=${this._goBack}>${msg('Cancel')}</button>
        </div>
      `;
    }

    // ---- Completed screen ----
    if (this._completed) {
      const { durationMode, totalCycles, totalMinutes, preset } = this.sessionConfig;
      const elapsed = Math.floor((Date.now() - this._sessionStartTime) / 1000);

      return html`
        <div class="completed-screen">
          <div class="completed-icon">${iconCheckCircle}</div>
          <div class="completed-title">${msg('Session Complete')}</div>
          <div class="completed-stats">
            <div class="stat">
              <div class="stat-label">${durationMode === 'cycles' ? msg('Cycles') : msg('Duration')}</div>
              <div class="stat-value">
                ${durationMode === 'cycles'
                  ? msg(str`${Math.max(0, this._cycle - 1)} / ${totalCycles}`)
                  : this._formatSeconds(Math.min(elapsed, totalMinutes * 60))}
              </div>
            </div>
            <div class="stat">
              <div class="stat-label">${msg('Program')}</div>
              <div class="stat-value" style="font-size:var(--font-sm)">
                ${this._presetDisplayName(preset.id as BreathingPresetId)}
              </div>
            </div>
          </div>
          <button class="btn btn-primary btn-large" @click=${this._goBack}>${msg('Done')}</button>
        </div>
      `;
    }

    // ---- Active timer screen ----
    const { durationMode, totalCycles, totalMinutes } = this.sessionConfig;
    const phases = activePhases(this.sessionConfig.preset);

    const cycleInfo = durationMode === 'cycles'
      ? msg(str`Cycle ${this._cycle} / ${totalCycles}`)
      : this._formatSeconds(Math.max(0, totalMinutes * 60 - this._elapsedWallSeconds));

    // Initial r value — rAF will update it each frame
    const { MIN_R } = AppBreathingTimer;

    return html`
      <div class="timer-page ${this._phase.label}">
        <div class="top-bar">
          <div class="cycle-info">${cycleInfo}</div>
        </div>

        <div class="timer-center">
          <div class="phase-label ${this._phase.label}">
            <span class="sym">${this._phaseSymbol(this._phase.label)}</span>
            ${this._phaseText(this._phase.label)}
          </div>

          <div class="timer-display">
            <svg class="breath-svg" viewBox="0 0 260 260">
              <circle class="circle-track" cx="130" cy="130" r="125" />
              <circle class="breath-fill ${this._phase.label}" cx="130" cy="130" r="${MIN_R}" />
              <!-- Dashed guide ring at MIN_R — always rendered on top of the fill so it
                   remains visible even when the circle shrinks to its minimum size -->
              <circle class="circle-min-track" cx="130" cy="130" r="58" />
            </svg>
            <div class="timer-text">${this._remaining}</div>
          </div>

          <div class="phase-dots">
            ${phases.map((p, i) => {
              const cls = i < this._phaseIndex ? 'done' : i === this._phaseIndex ? 'active' : '';
              return html`<span class="phase-dot ${p.label} ${cls}">${this._phaseSymbol(p.label)}</span>`;
            })}
          </div>
        </div>

        <div class="bottom-area">
          <div class="control-btns">
            <button class="btn btn-secondary" @click=${this._togglePause}>
              ${this._running ? msg('Pause') : msg('Resume')}
            </button>
            <button class="btn btn-danger" @click=${this._abort}>${msg('Stop')}</button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-breathing-timer': AppBreathingTimer;
  }
}
