import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLocale, setLocaleProvider, t, translate } from "../../src/i18n/messages";

test("locales normalise to en or ru", () => {
  assert.equal(normalizeLocale("ru"), "ru");
  assert.equal(normalizeLocale("RU-ru"), "ru");
  assert.equal(normalizeLocale("en-GB"), "en");
  assert.equal(normalizeLocale(null), "en");
});

test("messages are filled with parameters and follow the locale provider", () => {
  assert.equal(translate("en", "status.queue", { count: 2 }), "Queue: 2");
  assert.equal(translate("ru", "status.queue", { count: 2 }), "Очередь: 2");
  setLocaleProvider(() => "ru");
  assert.equal(t("settings.refresh"), "Обновить");
  setLocaleProvider(() => "en");
  assert.equal(t("settings.refresh"), "Refresh");
});
