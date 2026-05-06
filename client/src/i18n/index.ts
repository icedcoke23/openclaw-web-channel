/**
 * i18n Internationalization Configuration
 * Supports Chinese (default) and English
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

export const resources = {
  'zh-CN': {
    translation: zhCN,
  },
  'en-US': {
    translation: enUS,
  },
} as const;

export type Language = 'zh-CN' | 'en-US';

export const LANGUAGE_NAMES: Record<Language, { name: string; flag: string; nativeName: string }> = {
  'zh-CN': { name: 'Chinese', flag: '🇨🇳', nativeName: '简体中文' },
  'en-US': { name: 'English', flag: '🇺🇸', nativeName: 'English' },
};

export const DEFAULT_LANGUAGE: Language = 'zh-CN';
export const SUPPORTED_LANGUAGES: Language[] = ['zh-CN', 'en-US'];

// Initialize i18n
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    react: {
      useSuspense: false,
    },

    // Namespace configuration
    ns: ['translation'],
    defaultNS: 'translation',
  });

export function changeLanguage(lng: Language): Promise<void> {
  return i18n.changeLanguage(lng);
}

export function getCurrentLanguage(): Language {
  return (i18n.language as Language) || DEFAULT_LANGUAGE;
}

export function isSupportedLanguage(lng: string): lng is Language {
  return SUPPORTED_LANGUAGES.includes(lng as Language);
}

export default i18n;
