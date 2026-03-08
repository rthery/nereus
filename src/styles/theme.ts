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
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--spacing-sm);
  }
`;
