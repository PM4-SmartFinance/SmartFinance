import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

// Surface init failure to the React tree.
// `<I18nInitGate>` (in main.tsx) reads getInitError() during render and
// re-throws, letting `<I18nErrorBoundary>` show the recovery UI. Without
// this gate, a rejected init promise would only log to console while the
// app hangs on the Suspense fallback.
let initError: Error | null = null;

const initPromise = i18n
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

    // DEV-only: triggers `missingKeyHandler` for visibility while authoring.
    // In prod, missing keys are caught by CI (`i18n.callsites.test.ts`,
    // `i18n.keys.test.ts`) — no need to POST 404s at the static asset server.
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (lngs, ns, key) => {
      if (!import.meta.env.DEV) return;
      console.warn(
        `[i18n] Missing translation key: "${key}" in namespace "${ns}" for language "${lngs.join(", ")}"`,
      );
    },

    // Inline English fallbacks at every callsite — t(KEY, ENGLISH_FALLBACK) —
    // are intentional. Two safety nets compensate for the fact that a missing
    // translation silently renders the English literal:
    //   1. i18n.callsites.test.ts fails CI when a static key is missing from
    //      en/translation.json — catches typos at PR time.
    //   2. i18n.keys.test.ts enforces key-set parity across locales — a key
    //      present in en but absent from de/fr/it/rm fails CI.
    // A runtime HTTP 404 on /locales/<lng>/translation.json is surfaced by
    // the failedLoading listener below.

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
  });

initPromise.catch((error: unknown) => {
  initError = error instanceof Error ? error : new Error(String(error));
  console.error("[i18n] initialization failed:", initError);
});

// Per-namespace fetch failures (e.g. 404 on /locales/<lng>/translation.json)
// do not throw — i18next-http-backend silently falls back to empty resources,
// which would mask the failure and degrade strings to inline English defaults.
// This listener makes the failure visible to operators and any console hook.
i18n.on("failedLoading", (lng, ns, msg) => {
  console.error(`[i18n] failed to load namespace "${ns}" for language "${lng}":`, msg);
});

export function getInitError(): Error | null {
  return initError;
}

export default i18n;
