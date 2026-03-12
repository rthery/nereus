import { css } from 'lit';

export const themeStyles = css`
  :host {
    /* Dark theme (default) */
    --color-bg-primary: #0a1628;
    --color-bg-secondary: #111d33;
    --color-bg-surface: #162340;
    --color-bg-surface-hover: #1c2d52;
    --color-text-primary: #e8edf5;
    --color-text-secondary: #8b9fc2;
    --color-text-muted: #5a6f94;
    --color-accent: #22b8cf;
    --color-accent-hover: #1aa3b8;
    --color-accent-subtle: rgba(34, 184, 207, 0.15);
    --color-breathe: #2196f3;
    --color-breathe-bg: rgba(33, 150, 243, 0.12);
    --color-hold: #ff9800;
    --color-hold-bg: rgba(255, 152, 0, 0.12);
    --color-rest: #4caf50;
    --color-rest-bg: rgba(76, 175, 80, 0.12);
    --color-activity: #ab47bc;
    --color-activity-bg: rgba(171, 71, 188, 0.12);
    --color-danger: #ef5350;
    --color-success: #66bb6a;
    --color-border: rgba(139, 159, 194, 0.15);
    --color-shadow: rgba(0, 0, 0, 0.3);

    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 24px;
    --radius-full: 9999px;

    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 16px;
    --spacing-lg: 24px;
    --spacing-xl: 32px;
    --spacing-2xl: 48px;

    --font-xs: 0.75rem;
    --font-sm: 0.875rem;
    --font-md: 1rem;
    --font-lg: 1.25rem;
    --font-xl: 1.5rem;
    --font-2xl: 2rem;
    --font-3xl: 3rem;
    --font-timer: 4.5rem;

    --nav-height: 64px;
    --transition-fast: 150ms ease;
    --transition-normal: 250ms ease;
  }

  :host([theme='light']),
  :host(.light) {
    --color-bg-primary: #f0f4f8;
    --color-bg-secondary: #ffffff;
    --color-bg-surface: #ffffff;
    --color-bg-surface-hover: #e8edf5;
    --color-text-primary: #1a2332;
    --color-text-secondary: #4a5568;
    --color-text-muted: #8b9fc2;
    --color-accent: #0891b2;
    --color-accent-hover: #0e7490;
    --color-accent-subtle: rgba(8, 145, 178, 0.1);
    --color-breathe: #1976d2;
    --color-breathe-bg: rgba(25, 118, 210, 0.08);
    --color-hold: #e65100;
    --color-hold-bg: rgba(230, 81, 0, 0.08);
    --color-rest: #388e3c;
    --color-rest-bg: rgba(56, 142, 60, 0.08);
    --color-activity: #8e24aa;
    --color-activity-bg: rgba(142, 36, 170, 0.08);
    --color-danger: #d32f2f;
    --color-success: #388e3c;
    --color-border: rgba(0, 0, 0, 0.1);
    --color-shadow: rgba(0, 0, 0, 0.08);
  }
`;

export const sharedStyles = css`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .card {
    background: var(--color-bg-surface);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    border: 1px solid var(--color-border);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--radius-full);
    font-size: var(--font-md);
    font-weight: 600;
    cursor: pointer;
    transition: background var(--transition-fast), transform var(--transition-fast);
    -webkit-tap-highlight-color: transparent;
  }

  .btn:active {
    transform: scale(0.97);
  }

  .btn-primary {
    background: var(--color-accent);
    color: #fff;
  }

  .btn-primary:hover {
    background: var(--color-accent-hover);
  }

  .btn-secondary {
    background: var(--color-bg-surface);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover {
    background: var(--color-bg-surface-hover);
  }

  .btn-large {
    padding: var(--spacing-md) var(--spacing-xl);
    font-size: var(--font-lg);
  }

  .btn-danger {
    background: var(--color-danger);
    color: #fff;
  }

  .page {
    padding: var(--spacing-lg);
    max-width: 800px;
    margin: 0 auto;
    padding-bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0) + var(--spacing-lg));
  }

  .page-title {
    font-size: var(--font-xl);
    font-weight: 700;
    color: var(--color-text-primary);
    margin-bottom: var(--spacing-lg);
  }

  .section-label {
    font-size: var(--font-sm);
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--spacing-sm);
  }

  .btn-compact {
    padding: var(--spacing-xs) var(--spacing-md);
    font-size: var(--font-sm);
  }

  .btn-ghost {
    background: none;
    border: none;
    color: var(--color-accent);
    font-size: var(--font-sm);
    font-weight: 600;
    padding: var(--spacing-xs) var(--spacing-sm);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .btn-icon-only {
    padding: 9px 11px;
    min-width: 38px;
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

  .dashed-add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-md);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-muted);
    font-size: var(--font-sm);
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: border-color var(--transition-fast), color var(--transition-fast);
  }

  .dashed-add-btn:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .dashed-add-btn svg {
    width: 18px;
    height: 18px;
  }

  .tabs {
    display: flex;
    gap: var(--spacing-xs);
    background: var(--color-bg-surface);
    border-radius: var(--radius-full);
    padding: 3px;
    border: 1px solid var(--color-border);
  }

  .tab-btn {
    flex: 1;
    padding: var(--spacing-sm) var(--spacing-md);
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text-secondary);
    font-size: var(--font-sm);
    font-weight: 700;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: inherit;
  }

  .tab-btn.active {
    background: var(--color-accent);
    color: #fff;
  }

  .action-bar {
    position: fixed;
    bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0));
    left: 0;
    right: 0;
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--color-bg-secondary);
    border-top: 1px solid var(--color-border);
    display: flex;
    gap: var(--spacing-sm);
    justify-content: center;
    z-index: 50;
  }

  .action-bar .btn {
    flex: 1;
    max-width: 300px;
  }

  @media (min-width: 769px) {
    .action-bar {
      bottom: 0;
      left: 80px;
    }
  }

  .info-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    border-radius: var(--radius-sm);
    -webkit-tap-highlight-color: transparent;
    transition: color var(--transition-fast);
  }

  .info-btn:hover,
  .info-btn.active {
    color: var(--color-accent);
  }

  .info-tooltip {
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .time-picker {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .time-picker:focus-within {
    border-color: var(--color-accent);
  }

  .time-picker-field {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .time-picker-field input {
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    font-size: var(--font-md);
    font-weight: 700;
    text-align: center;
    font-family: inherit;
    font-variant-numeric: tabular-nums;
    width: 3ch;
    padding: 0;
    -moz-appearance: textfield;
  }

  .time-picker-field input:focus {
    outline: none;
  }

  .time-picker-field input::-webkit-outer-spin-button,
  .time-picker-field input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .time-picker-unit {
    font-size: 10px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .time-picker-sep {
    font-size: var(--font-md);
    font-weight: 700;
    color: var(--color-text-secondary);
    padding-bottom: 1.2em;
    flex-shrink: 0;
  }

  .phase-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }

  .phase-pill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--radius-full);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .phase-pill svg {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
  }

  .phase-pill-duration {
    text-transform: none;
  }

  .phase-pill.inhale {
    background: color-mix(in srgb, var(--color-breathe) 20%, transparent);
    color: var(--color-breathe);
  }

  .phase-pill.hold-in {
    background: color-mix(in srgb, var(--color-breathe) 12%, transparent);
    color: var(--color-breathe);
    opacity: 0.75;
  }

  .phase-pill.exhale {
    background: color-mix(in srgb, var(--color-hold) 20%, transparent);
    color: var(--color-hold);
  }

  .phase-pill.hold-out {
    background: color-mix(in srgb, var(--color-hold) 12%, transparent);
    color: var(--color-hold);
    opacity: 0.75;
  }

  .phase-pill.breathing {
    background: color-mix(in srgb, var(--color-rest) 20%, transparent);
    color: var(--color-rest);
  }

  .phase-pill.apnea-full {
    background: color-mix(in srgb, var(--color-breathe) 20%, transparent);
    color: var(--color-breathe);
  }

  .phase-pill.apnea-empty {
    background: color-mix(in srgb, var(--color-hold) 20%, transparent);
    color: var(--color-hold);
  }

  .phase-pill.activity {
    background: color-mix(in srgb, var(--color-activity) 20%, transparent);
    color: var(--color-activity);
  }

  .card-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
  }

  .card-actions-main {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  .card-actions-delete {
    margin-left: auto;
  }

  .card-actions .btn {
    min-height: 38px;
    padding: 9px 16px;
    font-size: var(--font-sm);
    white-space: nowrap;
  }

  .card-actions .btn svg {
    width: 14px;
    height: 14px;
  }

  .empty-state {
    text-align: center;
    padding: var(--spacing-2xl) var(--spacing-lg);
    color: var(--color-text-muted);
    font-size: var(--font-sm);
    line-height: 1.5;
  }
`;
