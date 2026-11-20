import * as obsidian from "obsidian";
import { normalizeLocale, setLocaleProvider, t, type I18nKey, type SupportedLocale } from "./messages";

/** `getLanguage` arrived in Obsidian 1.8; older versions keep the choice in local storage. */
function obsidianLanguage(): string | null {
  const api = obsidian as { getLanguage?: () => string };
  if (typeof api.getLanguage === "function") return api.getLanguage();
  try {
    return window.localStorage.getItem("language");
  } catch {
    return null;
  }
}

setLocaleProvider(() => normalizeLocale(obsidianLanguage()));

export { t };
export type { I18nKey, SupportedLocale };
