import { configureLocalization } from '@lit/localize';
import { sourceLocale, targetLocales } from './generated/locale-codes.js';

const localeModules = new Map([
  ['fr', () => import('./generated/locales/fr.js')],
]);

export const { getLocale, setLocale } = configureLocalization({
  sourceLocale,
  targetLocales,
  loadLocale: (locale: string) => {
    const loader = localeModules.get(locale);
    if (!loader) throw new Error(`Unknown locale: ${locale}`);
    return loader();
  },
});

/** Detect locale from navigator.languages, matching supported locales */
export function detectLocale(): typeof sourceLocale | (typeof targetLocales)[number] {
  const supported: readonly string[] = [sourceLocale, ...targetLocales];
  for (const lang of navigator.languages) {
    const prefix = lang.split('-')[0];
    if (supported.includes(prefix)) return prefix as typeof sourceLocale;
  }
  return sourceLocale;
}
