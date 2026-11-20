export type SupportedLocale = "en" | "ru";

type MessageParams = Record<string, string | number>;

const en = {
  "command.startServer": "Start Codex server",
  "command.stopServer": "Stop Codex server",

  "status.state.stopped": "stopped",
  "status.state.starting": "starting",
  "status.state.ready": "ready",
  "status.state.error": "error",
  "status.processing": "Processing",
  "status.queue": "Queue: {count}",

  "settings.title": "Codex Bridge",
  "settings.intro":
    "One local server for text and image tasks from your Obsidian plugins. Starts on demand; uses the Codex sign-in on this computer.",
  "settings.server": "Server",
  "settings.start": "Start",
  "settings.stop": "Stop",
  "settings.restart": "Restart",
  "settings.executableName": "Codex executable",
  "settings.executableDesc":
    "codex, or the full path to its executable. Detected automatically when left as codex. Restart after changing.",
  "settings.autoStart": "Start with Obsidian",
  "settings.account": "Account",
  "settings.accountNotChecked": "Not checked",
  "settings.accountSignInToRun": "Sign in to ChatGPT to run tasks",
  "settings.signInWithChatGpt": "Sign in with ChatGPT",
  "settings.checkAccount": "Check account and models",
  "settings.fullAccessName": "Allow full access for plugins",
  "settings.fullAccessDesc":
    "Lets a plugin that asks for it use web search and the MCP servers and Codex apps listed below, on top of text answers. Shell commands and files are never available. Text from books, pages or tools could try to steer Codex, so enable this only for plugins you trust.",
  "settings.mcpAllowlistName": "MCP servers allowed for full access",
  "settings.mcpAllowlistDesc":
    "Names from your Codex configuration, separated by commas (for example readwise). All other MCP servers stay off, including browser and computer control. Empty means web search only.",
  "settings.defaultModelName": "Default model",
  "settings.defaultModelDesc":
    "Used when a plugin does not choose a model for its task. Leave empty to use the first model your account offers.",
  "settings.availableModels": "Available models",
  "settings.selectModel": "Select a model…",
  "settings.imagesSuffix": " · Images",

  "settings.mcpTitle": "MCP servers",
  "settings.mcpIntro":
    "Servers from your Codex configuration. Only the ones switched on here are usable with full access; all others stay off for every task.",
  "settings.mcpServers": "Servers",
  "settings.mcpNone": "None configured.",
  "settings.notLoaded": "Not loaded yet.",
  "settings.refresh": "Refresh",
  "settings.usableWithFullAccess": "Usable with full access",
  "settings.localCommand": "local command",
  "settings.signedIn": "signed in",
  "settings.noSignInNeeded": "no sign-in needed",
  "settings.notSignedIn": "not signed in",
  "settings.signIn": "Sign in",
  "settings.remove": "Remove",
  "settings.addServerName": "Add a server",
  "settings.addServerDesc":
    "Writes an https MCP server to your Codex configuration (config.toml), which other Codex apps also read. It is switched on for full access here.",
  "settings.serverNamePlaceholder": "name",
  "settings.serverUrlPlaceholder": "https://…/mcp",
  "settings.add": "Add",
  "settings.readwiseName": "Readwise",
  "settings.readwiseDesc":
    "Official hosted Readwise server (https://mcp2.readwise.io/mcp), for Reader and highlights.",
  "settings.addReadwise": "Add Readwise",

  "settings.appsTitle": "Codex apps",
  "settings.appsIntro":
    "Apps connected in your Codex account (for example Readwise, used by writing @readwise). Only the ones switched on here are usable with full access, and never to change or delete data.",
  "settings.apps": "Apps",
  "settings.appsNone": "None installed.",

  "notice.signInUrlUnexpected": "Unexpected Codex sign-in URL.",
  "notice.signInAddressUnexpected": "Unexpected sign-in address.",
  "notice.completeSignInThenCheck":
    "Complete sign-in in your browser, then click Check account and models.",
  "notice.completeSignInThenRefresh": "Complete sign-in in your browser, then press Refresh.",
  "notice.serverAdded": "{name} added. Press Sign in if it asks for it.",

  "status.mcpSignedIn": "MCP server {name} signed in.",
  "status.mcpSignInFailed": "MCP sign-in failed.",
  "status.mcpSignInFailedWith": "MCP sign-in failed: {error}",
  "status.signedIn": "Signed in.",
  "status.signInFailed": "Sign-in failed.",
  "error.signInFirst": "Sign in through Codex Bridge settings first.",
  "error.chooseModel": "Choose a Codex model.",
  "error.modelUnavailable": "Model {model} is not available to this Codex account.",
  "error.modelNoImages": "Model {model} does not support images.",
  "error.unsupportedImage": "Use a PNG, JPEG or WebP image up to 20 MB.",
  "error.fullAccessOff": "Full Codex access is turned off in Codex Bridge settings.",
  "error.cancelled": "Codex task cancelled.",
  "error.toolAttempt": "Codex attempted a tool operation; the task was stopped. ({what})",
  "error.timedOut": "Codex task timed out.",
  "error.noText": "Codex returned no text.",
  "error.taskFailed": "Codex task failed.",
  "error.serverStopped": "Codex server stopped.",
  "error.serverNotRunning": "Codex server is stopped.",
  "error.serverExited": "Codex server exited.",
  "error.startFailed": "Could not start Codex. Check the executable path in Codex Bridge settings.",
  "error.invalidMessage": "Invalid message from Codex server.",
  "error.requestFailed": "Codex request failed.",
  "error.requestTimedOut": "Codex request timed out: {method}",
  "error.threadNotFound": "Codex thread not found.",
  "error.invalidServerUrl": "Enter a valid server URL.",
  "error.httpsOnly": "Only https:// addresses without credentials are accepted.",
  "error.serverNameInvalid": "Use letters, digits, - or _ for the server name.",
  "error.serverNameUnsupported": "Unsupported server name.",
  "error.serverExists": "An MCP server named {name} already exists in the Codex configuration.",
  "progress.queued": "Queued for Codex",
  "progress.connecting": "Connecting to Codex Server",
  "progress.checking": "Checking Codex account and model",
  "progress.continuing": "Continuing the Codex conversation · {model}",
  "progress.startingConversation": "Starting a Codex conversation · {model}",
  "progress.temporary": "Creating a temporary session · {model}",
  "progress.waiting": "Waiting for Codex response",
  "progress.started": "Codex started processing",
  "progress.reasoning": "Codex is processing the supplied material",
  "progress.composing": "Codex is composing the response",
  "progress.commentary": "Codex: {text}",
  "progress.receiving": "Receiving Codex response · {count} characters",
  "progress.finished": "Codex finished processing",
  "progress.cancelled": "Codex task cancelled",
  "progress.failed": "Codex task failed",
  "progress.webSearch": "Codex is searching the web",
  "progress.usingApp": "Codex is using {app} · {action}",
  "progress.usingServer": "Codex is using {server} · {tool}",
  "progress.anApp": "an app",
  "progress.tool": "tool",
  "warning.codexOld": "Codex {version} is older than the tested {tested}; some features may not work.",
  "settings.modelAutoPlaceholder": "first available model",
  "settings.codexMissing": "Codex was not found. Install the Codex CLI, or set its full path in Codex executable below, then press Start.",
  "settings.diagnosticsName": "Diagnostics",
  "settings.diagnosticsDesc": "Copies versions, executable path, state and task counts per plugin. No task text, account or tokens.",
  "settings.copyDiagnostics": "Copy diagnostics",
  "notice.diagnosticsCopied": "Diagnostics copied.",
};

export type I18nKey = keyof typeof en;

const ru: Record<I18nKey, string> = {
  "command.startServer": "Запустить сервер Codex",
  "command.stopServer": "Остановить сервер Codex",

  "status.state.stopped": "остановлен",
  "status.state.starting": "запускается",
  "status.state.ready": "готов",
  "status.state.error": "ошибка",
  "status.processing": "Выполняется задача",
  "status.queue": "Очередь: {count}",

  "settings.title": "Codex Bridge",
  "settings.intro":
    "Один локальный сервер для текстовых и графических задач из ваших плагинов Obsidian. Запускается по требованию и использует вход в Codex на этом компьютере.",
  "settings.server": "Сервер",
  "settings.start": "Запустить",
  "settings.stop": "Остановить",
  "settings.restart": "Перезапустить",
  "settings.executableName": "Исполняемый файл Codex",
  "settings.executableDesc":
    "codex или полный путь к исполняемому файлу. Если оставить codex, путь определяется автоматически. После изменения перезапустите сервер.",
  "settings.autoStart": "Запускать вместе с Obsidian",
  "settings.account": "Аккаунт",
  "settings.accountNotChecked": "Не проверялся",
  "settings.accountSignInToRun": "Войдите в ChatGPT, чтобы выполнять задачи",
  "settings.signInWithChatGpt": "Войти через ChatGPT",
  "settings.checkAccount": "Проверить аккаунт и модели",
  "settings.fullAccessName": "Разрешить плагинам полный доступ",
  "settings.fullAccessDesc":
    "Позволяет плагину, который об этом просит, использовать поиск в интернете, MCP-серверы и приложения Codex из списков ниже в дополнение к текстовым ответам. Команды оболочки и файлы недоступны никогда. Текст из книг, страниц и инструментов может пытаться управлять Codex, поэтому включайте это только для плагинов, которым доверяете.",
  "settings.mcpAllowlistName": "MCP-серверы, разрешённые при полном доступе",
  "settings.mcpAllowlistDesc":
    "Имена из вашей конфигурации Codex через запятую (например, readwise). Остальные MCP-серверы остаются выключенными, включая управление браузером и компьютером. Пустое поле означает только поиск в интернете.",
  "settings.defaultModelName": "Модель по умолчанию",
  "settings.defaultModelDesc":
    "Используется, когда плагин не выбрал модель для своей задачи. Если оставить пустым, берётся первая модель, доступная вашему аккаунту.",
  "settings.availableModels": "Доступные модели",
  "settings.selectModel": "Выберите модель…",
  "settings.imagesSuffix": " · Изображения",

  "settings.mcpTitle": "MCP-серверы",
  "settings.mcpIntro":
    "Серверы из вашей конфигурации Codex. При полном доступе используются только включённые здесь; остальные выключены для всех задач.",
  "settings.mcpServers": "Серверы",
  "settings.mcpNone": "Серверов нет.",
  "settings.notLoaded": "Ещё не загружено.",
  "settings.refresh": "Обновить",
  "settings.usableWithFullAccess": "Доступен при полном доступе",
  "settings.localCommand": "локальная команда",
  "settings.signedIn": "вход выполнен",
  "settings.noSignInNeeded": "вход не требуется",
  "settings.notSignedIn": "вход не выполнен",
  "settings.signIn": "Войти",
  "settings.remove": "Удалить",
  "settings.addServerName": "Добавить сервер",
  "settings.addServerDesc":
    "Записывает https-MCP-сервер в конфигурацию Codex (config.toml), которую читают и другие приложения Codex. Здесь он сразу включается для полного доступа.",
  "settings.serverNamePlaceholder": "имя",
  "settings.serverUrlPlaceholder": "https://…/mcp",
  "settings.add": "Добавить",
  "settings.readwiseName": "Readwise",
  "settings.readwiseDesc":
    "Официальный сервер Readwise (https://mcp2.readwise.io/mcp) для Reader и хайлайтов.",
  "settings.addReadwise": "Добавить Readwise",

  "settings.appsTitle": "Приложения Codex",
  "settings.appsIntro":
    "Приложения, подключённые в вашем аккаунте Codex (например, Readwise, к которому обращаются через @readwise). При полном доступе используются только включённые здесь, и никогда для изменения или удаления данных.",
  "settings.apps": "Приложения",
  "settings.appsNone": "Приложений нет.",

  "notice.signInUrlUnexpected": "Неожиданный адрес входа Codex.",
  "notice.signInAddressUnexpected": "Неожиданный адрес входа.",
  "notice.completeSignInThenCheck":
    "Завершите вход в браузере, затем нажмите «Проверить аккаунт и модели».",
  "notice.completeSignInThenRefresh": "Завершите вход в браузере, затем нажмите «Обновить».",
  "notice.serverAdded": "{name} добавлен. Если потребуется, нажмите «Войти».",

  "status.mcpSignedIn": "MCP-сервер {name}: вход выполнен.",
  "status.mcpSignInFailed": "Не удалось войти в MCP-сервер.",
  "status.mcpSignInFailedWith": "Не удалось войти в MCP-сервер: {error}",
  "status.signedIn": "Вход выполнен.",
  "status.signInFailed": "Не удалось войти.",
  "error.signInFirst": "Сначала войдите в настройках Codex Bridge.",
  "error.chooseModel": "Выберите модель Codex.",
  "error.modelUnavailable": "Модель {model} недоступна для этого аккаунта Codex.",
  "error.modelNoImages": "Модель {model} не поддерживает изображения.",
  "error.unsupportedImage": "Используйте изображение PNG, JPEG или WebP до 20 МБ.",
  "error.fullAccessOff": "Полный доступ к Codex выключен в настройках Codex Bridge.",
  "error.cancelled": "Задача Codex отменена.",
  "error.toolAttempt": "Codex попытался вызвать инструмент; задача остановлена. ({what})",
  "error.timedOut": "Время выполнения задачи Codex истекло.",
  "error.noText": "Codex не вернул текст.",
  "error.taskFailed": "Задача Codex завершилась ошибкой.",
  "error.serverStopped": "Сервер Codex остановлен.",
  "error.serverNotRunning": "Сервер Codex не запущен.",
  "error.serverExited": "Сервер Codex завершил работу.",
  "error.startFailed": "Не удалось запустить Codex. Проверьте путь к исполняемому файлу в настройках Codex Bridge.",
  "error.invalidMessage": "Некорректное сообщение от сервера Codex.",
  "error.requestFailed": "Запрос к Codex не выполнен.",
  "error.requestTimedOut": "Время запроса к Codex истекло: {method}",
  "error.threadNotFound": "Диалог Codex не найден.",
  "error.invalidServerUrl": "Введите корректный адрес сервера.",
  "error.httpsOnly": "Допустимы только адреса https:// без логина и пароля.",
  "error.serverNameInvalid": "Для имени сервера используйте буквы, цифры, - или _.",
  "error.serverNameUnsupported": "Недопустимое имя сервера.",
  "error.serverExists": "MCP-сервер с именем {name} уже есть в конфигурации Codex.",
  "progress.queued": "В очереди к Codex",
  "progress.connecting": "Подключение к серверу Codex",
  "progress.checking": "Проверка аккаунта и модели Codex",
  "progress.continuing": "Продолжение диалога Codex · {model}",
  "progress.startingConversation": "Начало диалога Codex · {model}",
  "progress.temporary": "Создание временной сессии · {model}",
  "progress.waiting": "Ожидание ответа Codex",
  "progress.started": "Codex начал обработку",
  "progress.reasoning": "Codex обрабатывает переданный материал",
  "progress.composing": "Codex формирует ответ",
  "progress.commentary": "Codex: {text}",
  "progress.receiving": "Получение ответа Codex · символов: {count}",
  "progress.finished": "Codex завершил обработку",
  "progress.cancelled": "Задача Codex отменена",
  "progress.failed": "Задача Codex не выполнена",
  "progress.webSearch": "Codex ищет в интернете",
  "progress.usingApp": "Codex использует {app} · {action}",
  "progress.usingServer": "Codex использует {server} · {tool}",
  "progress.anApp": "приложение",
  "progress.tool": "инструмент",
  "warning.codexOld": "Codex {version} старше проверенной версии {tested}; часть функций может не работать.",
  "settings.modelAutoPlaceholder": "первая доступная модель",
  "settings.codexMissing": "Codex не найден. Установите Codex CLI или укажите полный путь в поле «Исполняемый файл Codex» ниже, затем нажмите «Запустить».",
  "settings.diagnosticsName": "Диагностика",
  "settings.diagnosticsDesc": "Копирует версии, путь к файлу, состояние и число задач по плагинам. Без текста задач, данных аккаунта и токенов.",
  "settings.copyDiagnostics": "Скопировать диагностику",
  "notice.diagnosticsCopied": "Диагностика скопирована.",
};

const messages: Record<SupportedLocale, Record<I18nKey, string>> = { en, ru };

let localeProvider: () => SupportedLocale = () => "en";

/** Lets the plugin entry point plug in Obsidian's language; tests leave the default. */
export function setLocaleProvider(provider: () => SupportedLocale): void {
  localeProvider = provider;
}

export function normalizeLocale(language: string | undefined | null): SupportedLocale {
  return String(language || "en").toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function translate(locale: SupportedLocale, key: I18nKey, params: MessageParams = {}): string {
  const template = messages[locale][key] || messages.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(params[name] ?? ""));
}

export function t(key: I18nKey, params?: MessageParams): string {
  return translate(localeProvider(), key, params);
}
