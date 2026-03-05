function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

export function vibrateShort(): void {
  if (canVibrate()) {
    navigator.vibrate(50);
  }
}

export function vibrateMedium(): void {
  if (canVibrate()) {
    navigator.vibrate(150);
  }
}

export function vibratePattern(pattern: number[]): void {
  if (canVibrate()) {
    navigator.vibrate(pattern);
  }
}

export function vibratePhaseChange(): void {
  if (canVibrate()) {
    navigator.vibrate([100, 50, 100]);
  }
}

export function vibrateComplete(): void {
  if (canVibrate()) {
    navigator.vibrate([200, 100, 200, 100, 400]);
  }
}

export function vibrateCountdown(): void {
  vibrateShort();
}
