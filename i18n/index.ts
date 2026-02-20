import * as Localization from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import jp from './locales/jp.json';
import nl from './locales/nl.json';
import pt from './locales/pt.json';
import zh from './locales/zh.json';

const resources = {
    en: { translation: en },
    ja: { translation: jp },
    jp: { translation: jp },
    de: { translation: de },
    fr: { translation: fr },
    es: { translation: es },
    it: { translation: it },
    nl: { translation: nl },
    pt: { translation: pt },
    zh: { translation: zh },
};

const getLocale = () => {
    const locale = Localization.getLocales()[0].languageCode;
    if (locale && resources.hasOwnProperty(locale)) {
        return locale;
    }
    return 'en';
};

const i18n = createInstance();

void i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: getLocale(),
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
