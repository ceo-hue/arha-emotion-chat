import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode } from 'react';
import { ko, type AdminTranslations } from '../locales/ko';
import { en } from '../locales/en';

export type Language = 'ko' | 'en';

const LANG_KEY = 'arha_lang'; // shared with ARHA
const translations: Record<Language, AdminTranslations> = { ko, en };

interface I18nContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: AdminTranslations;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'ko',
  setLang: () => {},
  t: ko,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const stored = localStorage.getItem(LANG_KEY);
    return (stored === 'en' || stored === 'ko') ? stored : 'ko';
  });

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
  }, []);

  const t = useMemo(() => translations[lang], [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
