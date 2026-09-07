export type UsagePlatform = 'extension' | 'ios' | 'android' | 'web';

/**
 * A group label for the daily usage event, never the user agent. Capacitor is
 * split with Capacitor.getPlatform(), passed in so this stays a pure function.
 */
export function usagePlatform(
  kind: 'extension' | 'capacitor' | 'web',
  native: () => string
): UsagePlatform {
  if (kind === 'capacitor') return native() === 'ios' ? 'ios' : 'android';
  return kind;
}
