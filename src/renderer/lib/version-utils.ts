/** Shared .NET version labels and colors for the renderer. */

export const VERSION_LABELS: Record<string, string> = {
  Net31: '.NET 3.1',
  Net50: '.NET 5.0',
  Net60: '.NET 6.0',
  Net70: '.NET 7.0',
  Net80: '.NET 8.0',
  Net90: '.NET 9.0',
  Net100: '.NET 10.0',
};

export const VERSION_COLORS: Record<string, string> = {
  Net31: '#f85149',
  Net50: '#f0883e',
  Net60: '#d29922',
  Net70: '#9f7aea',
  Net80: '#00d4aa',
  Net90: '#58a6ff',
  Net100: '#3fb950',
};

export const FALLBACK_COLOR = '#8b949e';

/** Get a human-readable label for a version key (e.g. 'Net80' → '.NET 8.0'). */
export function getVersionLabel(key: string): string {
  return VERSION_LABELS[key] ?? key;
}

/** Get a color for a version key (e.g. 'Net80' → '#00d4aa'). */
export function getVersionColor(key: string): string {
  return VERSION_COLORS[key] ?? FALLBACK_COLOR;
}
