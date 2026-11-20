/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Programmable i18n Translation Engine & Flat-File Ledger Accessor
 * Supports Top 20 Global Languages, Bidirectional (RTL) Layouts,
 * and Vertical CJK Typography.
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import ledgerData from './ledger.json';

import en from './locales/en.json';
import zh from './locales/zh.json';
import es from './locales/es.json';
import hi from './locales/hi.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';
import bn from './locales/bn.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import ur from './locales/ur.json';
import id from './locales/id.json';
import de from './locales/de.json';
import ja from './locales/ja.json';
import mr from './locales/mr.json';
import te from './locales/te.json';
import tr from './locales/tr.json';
import ta from './locales/ta.json';
import vi from './locales/vi.json';
import ko from './locales/ko.json';
import it from './locales/it.json';

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
  vertical?: boolean;
}

export const TOP_20_LANGUAGES: LanguageInfo[] = (ledgerData.languages as LanguageInfo[]) || [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', dir: 'ltr', vertical: true },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', dir: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', dir: 'rtl' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', dir: 'ltr', vertical: true },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', dir: 'ltr' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', dir: 'ltr' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', dir: 'ltr' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', dir: 'ltr' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', dir: 'ltr' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', dir: 'ltr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', dir: 'ltr' },
];

// Flat-file dictionary map with all 20 global languages
const GLOBAL_TRANSLATIONS: Record<string, Record<string, string>> = {
  en,
  zh,
  es,
  hi,
  ar,
  fr,
  bn,
  pt,
  ru,
  ur,
  id,
  de,
  ja,
  mr,
  te,
  tr,
  ta,
  vi,
  ko,
  it,
};

export const CJK_LANGUAGES = ['zh', 'ja', 'ko'];

interface I18nContextValue {
  currentLanguage: string;
  setLanguage: (lang: string) => void;
  isRtl: boolean;
  isVertical: boolean;
  supportsVerticalType: boolean;
  toggleVertical: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  currentLanguage: 'en',
  setLanguage: () => {},
  isRtl: false,
  isVertical: false,
  supportsVerticalType: false,
  toggleVertical: () => {},
  t: (key) => key,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguageState] = useState<string>(() => {
    try {
      return localStorage.getItem('dt_lang_v1') || 'en';
    } catch {
      return 'en';
    }
  });

  const [isVertical, setIsVertical] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dt_vertical_type_v1') === 'true';
    } catch {
      return false;
    }
  });

  const currentLangInfo = useMemo(() => {
    return TOP_20_LANGUAGES.find((l) => l.code === currentLanguage) || TOP_20_LANGUAGES[0];
  }, [currentLanguage]);

  const isRtl = currentLangInfo.dir === 'rtl';

  // Apply direction to HTML element dynamically
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', currentLanguage);
    }
  }, [currentLanguage, isRtl]);

  // Apply Vertical text mode class
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isVertical) {
        document.documentElement.classList.add('vertical-text-mode');
      } else {
        document.documentElement.classList.remove('vertical-text-mode');
      }
    }
  }, [isVertical]);

  const setLanguage = (lang: string) => {
    setCurrentLanguageState(lang);
    try {
      localStorage.setItem('dt_lang_v1', lang);
    } catch {
      // Ignore storage errors
    }
  };

  const toggleVertical = () => {
    setIsVertical((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('dt_vertical_type_v1', String(next));
      } catch {}
      return next;
    });
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const langDict = GLOBAL_TRANSLATIONS[currentLanguage] || {};
    const fallbackDict = (GLOBAL_TRANSLATIONS['en'] as Record<string, string>) || {};

    let text = langDict[key] || fallbackDict[key];
    if (!text) {
      if (key.includes('.')) {
        const lastPart = key.split('.').pop() || key;
        text = lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/([A-Z])/g, ' $1').trim();
      } else {
        text = key;
      }
    }

    if (params) {
      for (const [paramKey, val] of Object.entries(params)) {
        text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(val));
      }
    }

    return text;
  };

  const supportsVerticalType = CJK_LANGUAGES.includes(currentLanguage);

  return (
    <I18nContext.Provider
      value={{
        currentLanguage,
        setLanguage,
        isRtl,
        isVertical,
        supportsVerticalType,
        toggleVertical,
        t,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);
