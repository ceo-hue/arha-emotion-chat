import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { ko, Translations } from '../locales/ko';
import { en } from '../locales/en';

export type Language = 'ko' | 'en';

const LANG_STORAGE_KEY = 'arha_lang';
const translations: Record<Language, Translations> = { ko, en };

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'ko',
  setLang: () => {},
  t: ko,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return saved === 'en' || saved === 'ko' ? saved : 'ko';
  });

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem(LANG_STORAGE_KEY, newLang);
  }, []);

  const value = useMemo(() => ({
    lang,
    setLang,
    t: translations[lang],
  }), [lang, setLang]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
