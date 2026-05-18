import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: ["en", "de", "fr", "it", "rm"],
    load: "languageOnly",

    react: {
      useSuspense: true,
    },

    saveMissing: true,
    missingKeyHandler: (lngs, ns, key) => {
      const message = `[i18n] Missing translation key: "${key}" in namespace "${ns}" for language "${lngs.join(", ")}"`;
      if (import.meta.env.DEV) {
        console.warn(message);
      } else {
        // Prod: surface to console.error so missing keys are visible in user-side
        // devtools and any error-reporting hook that listens on console.error.
        console.error(message);
      }
    },

    backend: {
      loadPath: "/locales/{{lng}}/translation.json",
    },

    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },

    interpolation: {
      escapeValue: false,
    },
  })
  .catch((error) => {
    console.error("i18next initialization failed:", error);
  });

export default i18n;
