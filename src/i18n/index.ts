import { getLanguage } from "obsidian";
import { normalizeLocale, setLocaleProvider, t, type I18nKey, type SupportedLocale } from "./messages";

/** `getLanguage` needs Obsidian 1.8, which is this plugin's minimum version. */
setLocaleProvider(() => normalizeLocale(getLanguage()));

export { t };
export type { I18nKey, SupportedLocale };
