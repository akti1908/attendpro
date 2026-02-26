import { renderHome } from "./components/Home.js";
import { renderCalendar } from "./components/Calendar.js";
import { renderStudentsManager } from "./components/StudentCard.js";
import { renderGroupsManager } from "./components/GroupCard.js";
import { renderSession } from "./components/Session.js";
import { renderStatistics } from "./components/Statistics.js";
import { renderSalary } from "./components/Salary.js";
import { renderAuth } from "./components/Auth.js";
import { renderSettings } from "./components/Settings.js";

const STORAGE_KEY = "attendpro_state_v4";
const SYNC_CONFLICT_BACKUPS_KEY = "attendpro_sync_conflict_backups_v1";
const APP_VERSION = 5;
const ALLOWED_THEMES = ["dark", "light"];
const CLOUD_SYNC_DEBOUNCE_MS = 1200;
const CLOUD_SYNC_RETRY_BASE_MS = 2000;
const CLOUD_SYNC_RETRY_MAX_MS = 60000;
const CLOUD_FETCH_TIMEOUT_MS = 15000;
const AUTO_REPORT_CHECK_INTERVAL_MS = 30000;
const TELEGRAM_REPORT_MAX_LENGTH = 3900;
const MAX_SYNC_CONFLICT_BACKUPS = 5;
const DEFAULT_SYNC_STATE = {
  pendingDataSync: false,
  lastDataChangeAt: null,
  lastCloudUpdateAt: null
};
const LEGACY_TEXT_MAP = {
  "РџРЅ": "Пн",
  "Р’С‚": "Вт",
  "РЎСЂ": "Ср",
  "Р§С‚": "Чт",
  "РџС‚": "Пт",
  "РЎР±": "Сб",
  "Р’СЃ": "Вс",
  "Р“СЂСѓРїРїР°": "Группа",
  "РЈС‡РµРЅРёРє": "Ученик",
  "РЈС‡Р°СЃС‚РЅРёРє 1": "Участник 1",
  "РЈС‡Р°СЃС‚РЅРёРє 2": "Участник 2",
  "РїСЂРёС€РµР»": "пришел",
  "РЅРµ РїСЂРёС€РµР»": "не пришел",
  "Р·Р°РїР»Р°РЅРёСЂРѕРІР°РЅРѕ": "запланировано",
  "РїСЂРёСЃСѓС‚СЃС‚РІРѕРІР°Р»": "присутствовал",
  "РѕС‚СЃСѓС‚СЃС‚РІРѕРІР°Р»": "отсутствовал"
};

const TRAINER_CATEGORIES = ["I", "II", "III"];
const PACKAGE_COUNTS = [1, 5, 10, 25];
const DEFAULT_TRAINER_CATEGORY = "I";
const DEFAULT_COACH_PERCENT = 50;
const DEFAULT_USER_SETTINGS = {
  trainerCategory: DEFAULT_TRAINER_CATEGORY,
  coachPercent: DEFAULT_COACH_PERCENT,
  workSchedule: {
    days: [1, 2, 3, 4, 5, 6, 0],
    startHour: 0,
    endHour: 23
  },
  autoReport: {
    enabled: false,
    days: [],
    hour: 18,
    lastSentSlotKey: ""
  }
};
const CATEGORY_PRICE_TABLES = {
  personal: {
    I: { 1: 1500, 5: 6750, 10: 12000, 25: 27500 },
    II: { 1: 2000, 5: 9000, 10: 17000, 25: 40000 },
    III: { 1: 2500, 5: 11250, 10: 21000, 25: 50000 }
  },
  // Временные значения для II/III, обновим после получения вашей таблицы по сплитам.
  split: {
    I: { 1: 1200, 5: 5500, 10: 10000, 25: 24000 },
    II: { 1: 1200, 5: 5500, 10: 10000, 25: 24000 },
    III: { 1: 1200, 5: 5500, 10: 10000, 25: 24000 }
  },
  mini_group: {
    I: { 1: 1100, 5: 4900, 10: 9500, 25: 22000 },
    II: { 1: 1600, 5: 7800, 10: 14000, 25: 32000 },
    III: { 1: 2000, 5: 8500, 10: 15000, 25: 40000 }
  }
};
const MINI_GROUP_MIN_PARTICIPANTS = 3;
const MINI_GROUP_MAX_PARTICIPANTS = 5;

// Понедельник первым для удобного выбора в формах.
const weekDays = [
  { jsDay: 1, label: "Пн" },
  { jsDay: 2, label: "Вт" },
  { jsDay: 3, label: "Ср" },
  { jsDay: 4, label: "Чт" },
  { jsDay: 5, label: "Пт" },
  { jsDay: 6, label: "Сб" },
  { jsDay: 0, label: "Вс" }
];

// Явный импорт, чтобы app.js был связан со всеми компонентами.
void renderSession;

let state = loadState();
let cloudSyncTimer = null;
let cloudSyncRetryTimer = null;
let cloudSyncRetryAttempt = 0;
let cloudSyncInFlight = false;
let cloudSyncQueued = false;
let swRefreshTriggered = false;
let autoReportTimer = null;

const root = document.getElementById("app");
bindTopbarMenu();
bindTopNavigation();
bindSyncLifecycleHandlers();
applyTheme(state.theme);
renderApp();
void bootstrapCloudSync();
startAutoReportScheduler();
registerServiceWorker();

function bindTopNavigation() {
  const navMap = {
    "go-today": "home",
    "go-students": "students",
    "go-groups": "groups",
    "go-calendar": "calendar",
    "go-stats": "stats",
    "go-salary": "salary",
    "go-settings": "settings"
  };

  Object.entries(navMap).forEach(([id, view]) => {
    const button = document.getElementById(id);
    if (!button) return;

    button.addEventListener("click", () => {
      if (!isAuthenticated()) return;
      if (state.view === view) {
        closeTopbarMenu();
        return;
      }
      state.view = view;
      if (view !== "home") state.editMode = false;
      saveState();
      closeTopbarMenu();
      renderApp();
    });
  });
}

function bindTopbarMenu() {
  const menuToggle = document.getElementById("menu-toggle");
  const menuPanel = document.getElementById("topbar-menu");
  if (!menuToggle) return;

  menuToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = document.body.classList.contains("menu-open");
    setTopbarMenuOpen(!isOpen);
  });

  document.addEventListener("click", (event) => {
    const clickedToggle = menuToggle.contains(event.target);
    const clickedMenuPanel = menuPanel ? menuPanel.contains(event.target) : false;
    if (!clickedToggle && !clickedMenuPanel) setTopbarMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setTopbarMenuOpen(false);
    }
  });

  window.addEventListener("resize", () => {
    setTopbarMenuOpen(false);
  });
}

function setTopbarMenuOpen(isOpen) {
  const menuToggle = document.getElementById("menu-toggle");
  document.body.classList.toggle("menu-open", Boolean(isOpen));
  if (menuToggle) {
    menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }
}

function closeTopbarMenu() {
  setTopbarMenuOpen(false);
}

function bindSyncLifecycleHandlers() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void pushStateToCloud();
    }
  });

  window.addEventListener("online", () => {
    resetCloudSyncRetry();
    void bootstrapCloudSync();
  });
}

function startAutoReportScheduler() {
  if (!shouldRunBrowserAutoReportScheduler()) {
    if (autoReportTimer) {
      clearInterval(autoReportTimer);
      autoReportTimer = null;
    }
    return;
  }

  if (autoReportTimer) {
    clearInterval(autoReportTimer);
    autoReportTimer = null;
  }

  autoReportTimer = setInterval(() => {
    void checkScheduledTelegramReport();
  }, AUTO_REPORT_CHECK_INTERVAL_MS);

  void checkScheduledTelegramReport();
}

async function checkScheduledTelegramReport() {
  if (!shouldRunBrowserAutoReportScheduler()) return;
  if (!isAuthenticated()) return;

  const ownerId = getCurrentUserId();
  if (!ownerId) return;

  const settings = getUserSettings(ownerId);
  const autoReport = settings.autoReport || normalizeAutoReportSettings();
  if (!autoReport.enabled) return;
  if (!Array.isArray(autoReport.days) || !autoReport.days.length) return;

  const now = new Date();
  const currentDay = now.getDay();
  if (!autoReport.days.includes(currentDay)) return;

  const scheduleHour = Number(autoReport.hour);
  const currentHour = now.getHours();
  // Отправляем в выбранный час и "догоняем" позже в тот же день,
  // если приложение было закрыто/неактивно в точное время.
  if (currentHour < scheduleHour) return;

  const slotKey = `${toISODate(now)}__${String(scheduleHour).padStart(2, "0")}`;
  if (autoReport.lastSentSlotKey === slotKey) return;

  const idempotencyKey = buildTelegramReportIdempotencyKey({
    slotKey,
    source: "browser-auto"
  });
  const result = await sendTodayReportToTelegram(toISODate(now), { idempotencyKey });
  if (!result?.ok) {
    return;
  }

  setUserSettingsForUser(ownerId, {
    autoReport: {
      ...autoReport,
      lastSentSlotKey: slotKey
    }
  });
  saveState({ dataChanged: true });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" })
      .then((registration) => {
        registration.update().catch(() => {});

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              registration.waiting?.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch((error) => {
        console.error("Service worker registration error:", error);
      });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (swRefreshTriggered) return;
      swRefreshTriggered = true;
      window.location.reload();
    });
  });
}

function refreshTopbarAuthState() {
  const isLoggedIn = isAuthenticated();

  document.body.classList.toggle("is-auth-required", !isLoggedIn);

  if (!isLoggedIn) {
    setTopbarMenuOpen(false);
  }
}

function setTheme(themeName) {
  const normalizedTheme = normalizeTheme(themeName);
  if (state.theme === normalizedTheme) return;

  state.theme = normalizedTheme;
  applyTheme(state.theme);
  saveState();
  renderApp();
}

function setTrainerCategory(categoryValue) {
  const ownerId = getCurrentUserId();
  if (!ownerId) return;

  const normalizedCategory = normalizeTrainerCategory(categoryValue);
  const current = getUserSettings(ownerId);
  if (current.trainerCategory === normalizedCategory) return;

  setUserSettingsForUser(ownerId, {
    trainerCategory: normalizedCategory
  });
  saveState({ dataChanged: true });
  renderApp();
}

function setWorkScheduleSettings(payload) {
  const ownerId = getCurrentUserId();
  if (!ownerId) return;

  const current = getUserSettings(ownerId);
  const currentWorkSchedule = normalizeWorkSchedule(current.workSchedule || {});
  const nextWorkSchedule = normalizeWorkSchedule({
    ...currentWorkSchedule,
    ...(payload || {})
  });

  const hasChanges = JSON.stringify(currentWorkSchedule) !== JSON.stringify(nextWorkSchedule);
  if (!hasChanges) return;

  setUserSettingsForUser(ownerId, {
    workSchedule: nextWorkSchedule
  });
  saveState({ dataChanged: true });
  renderApp();
}

function setAutoReportSettings(payload) {
  const ownerId = getCurrentUserId();
  if (!ownerId) return;

  const current = getUserSettings(ownerId);
  const currentAutoReport = normalizeAutoReportSettings(current.autoReport || {});
  const nextAutoReport = normalizeAutoReportSettings({
    ...currentAutoReport,
    ...(payload || {})
  });

  const daysChanged = JSON.stringify(currentAutoReport.days) !== JSON.stringify(nextAutoReport.days);
  const hourChanged = Number(currentAutoReport.hour) !== Number(nextAutoReport.hour);
  const enabledChanged = currentAutoReport.enabled !== nextAutoReport.enabled;
  if (daysChanged || hourChanged || enabledChanged) {
    nextAutoReport.lastSentSlotKey = "";
  }

  const hasChanges = JSON.stringify(currentAutoReport) !== JSON.stringify(nextAutoReport);
  if (!hasChanges) return;

  setUserSettingsForUser(ownerId, {
    autoReport: nextAutoReport
  });
  saveState({ dataChanged: true });
  renderApp();
  if (shouldRunBrowserAutoReportScheduler()) {
    void checkScheduledTelegramReport();
  }
}

async function syncCloudNow() {
  if (!isAuthenticated()) {
    return { ok: false, message: "Авторизуйтесь для синхронизации." };
  }
  if (!isCloudConfigured()) {
    return { ok: false, message: "Облачная синхронизация не настроена." };
  }

  const user = getCurrentUser();
  if (!user) {
    return { ok: false, message: "Пользователь не найден." };
  }

  // Ручная синхронизация: сначала читаем облако (чтобы не перетереть более новые данные),
  // затем при наличии локального pending делаем push.
  await pullStateFromCloudForUser(user, { preferRemoteOnConflict: true });

  const sync = getSyncStateForUser(user.id);
  if (sync.pendingDataSync) {
    const pushed = await pushStateToCloud();
    if (!pushed) {
      return { ok: false, message: "Не удалось отправить изменения в облако." };
    }
  }

  return { ok: true, message: "Синхронизация завершена." };
}

async function sendTodayReportToTelegram(targetDateISO = null, options = {}) {
  if (!isAuthenticated()) {
    return { ok: false, message: "Авторизуйтесь для отправки отчета." };
  }

  const telegramConfig = getTelegramReportConfig();
  const hasServerEndpoint = Boolean(telegramConfig.apiBaseUrl);
  const hasDirectTelegram = Boolean(telegramConfig.botToken && telegramConfig.chatId);
  if (!hasServerEndpoint && !hasDirectTelegram) {
    return {
      ok: false,
      message: "Telegram не настроен. Укажите ATTENDPRO_TELEGRAM.apiBaseUrl или botToken/chatId."
    };
  }

  const reportDateISO = ensureISODate(targetDateISO, getTodayISO());
  const text = buildTodayAttendanceReportText(reportDateISO);
  const idempotencyKey = String(options?.idempotencyKey || "").trim();

  let lastErrorMessage = "";

  if (hasServerEndpoint) {
    const serverResult = await sendTelegramReportViaBackend({
      telegramConfig,
      reportDateISO,
      text,
      idempotencyKey
    });
    if (serverResult.ok) return serverResult;
    lastErrorMessage = serverResult.message || lastErrorMessage;
  }

  if (hasDirectTelegram) {
    const directResult = await sendTelegramReportDirect({
      telegramConfig,
      text
    });
    if (directResult.ok) return directResult;
    lastErrorMessage = directResult.message || lastErrorMessage;
  }

  return {
    ok: false,
    message: lastErrorMessage || "Не удалось отправить отчет."
  };
}

async function sendTelegramReportViaBackend(payload) {
  const telegramConfig = payload.telegramConfig;
  const idempotencyKey = String(payload.idempotencyKey || "").trim();

  try {
    const response = await fetch(`${telegramConfig.apiBaseUrl}/api/telegram/send-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {})
      },
      body: JSON.stringify({
        dateISO: payload.reportDateISO,
        userEmail: getCurrentUser()?.email || "",
        text: payload.text,
        ...(idempotencyKey ? { idempotencyKey } : {})
      })
    });

    let body = null;
    try {
      body = await response.json();
    } catch (_error) {
      body = null;
    }

    if (!response.ok || !body?.ok) {
      return {
        ok: false,
        message: body?.message || body?.description || `Ошибка отправки отчета (${response.status}).`
      };
    }

    return {
      ok: true,
      message: body?.message || "Отчет отправлен в Telegram."
    };
  } catch (error) {
    console.error("sendTelegramReportViaBackend error:", error);
    return {
      ok: false,
      message: "Сервер отправки недоступен."
    };
  }
}

async function sendTelegramReportDirect(payload) {
  const telegramConfig = payload.telegramConfig;
  const endpoint = `https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`;
  const messageThreadId = Number(telegramConfig.messageThreadId);
  const body = {
    chat_id: telegramConfig.chatId,
    text: payload.text,
    disable_web_page_preview: true,
    allow_sending_without_reply: true,
    ...(Number.isInteger(messageThreadId) && messageThreadId > 0 ? { message_thread_id: messageThreadId } : {})
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    let result = null;
    try {
      result = await response.json();
    } catch (_error) {
      result = null;
    }

    if (!response.ok || !result?.ok) {
      return {
        ok: false,
        message: result?.description || result?.message || `Ошибка Telegram API (${response.status}).`
      };
    }

    return {
      ok: true,
      message: "Отчет отправлен в Telegram."
    };
  } catch (error) {
    console.error("sendTelegramReportDirect error:", error);
    const compatibilitySent = await sendTelegramReportDirectNoCors(endpoint, body);
    if (compatibilitySent) {
      return {
        ok: true,
        message: "Отчет отправлен в Telegram (режим совместимости)."
      };
    }

    return {
      ok: false,
      message: "Не удалось отправить отчет напрямую в Telegram."
    };
  }
}

async function sendTelegramReportDirectNoCors(endpoint, body) {
  try {
    const form = new URLSearchParams();
    Object.entries(body || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      form.set(key, String(value));
    });

    await fetch(endpoint, {
      method: "POST",
      mode: "no-cors",
      body: form
    });
    return true;
  } catch (_error) {
    return false;
  }
}

function getTelegramReportConfig() {
  const raw = window.ATTENDPRO_TELEGRAM || {};
  return {
    apiBaseUrl: resolveTelegramApiBaseUrl(raw.apiBaseUrl),
    schedulerMode: normalizeTelegramSchedulerMode(raw.schedulerMode),
    botToken: String(raw.botToken || "").trim(),
    chatId: String(raw.chatId || "").trim(),
    messageThreadId: String(raw.messageThreadId || "").trim()
  };
}

function resolveTelegramApiBaseUrl(value) {
  const explicitUrl = String(value || "")
    .trim()
    .replace(/\/+$/, "");
  if (explicitUrl) return explicitUrl;
  if (window.location.protocol.startsWith("http") && isLocalhostOrigin(window.location.hostname)) {
    return window.location.origin.replace(/\/+$/, "");
  }
  return "";
}

function normalizeTelegramSchedulerMode(value) {
  return String(value || "").trim().toLowerCase() === "browser" ? "browser" : "server";
}

function shouldRunBrowserAutoReportScheduler() {
  const cfg = getTelegramReportConfig();
  if (!cfg.apiBaseUrl) return true;
  return cfg.schedulerMode === "browser";
}

function isServerAutoReportEnabled() {
  const cfg = getTelegramReportConfig();
  return Boolean(cfg.apiBaseUrl) && cfg.schedulerMode !== "browser";
}

function isLocalhostOrigin(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function buildTelegramReportIdempotencyKey(payload = {}) {
  const source = String(payload?.source || "manual").trim().toLowerCase() || "manual";
  const slotKey = normalizeAutoReportSlotKey(payload?.slotKey);
  const userId = getCurrentUserId() || "anon";
  if (slotKey) {
    return `attendpro:${source}:${userId}:${slotKey}`;
  }
  return `attendpro:${source}:${userId}:${getTodayISO()}`;
}

function applyTheme(themeName) {
  const normalizedTheme = normalizeTheme(themeName);
  document.body.setAttribute("data-theme", normalizedTheme);
}

function normalizeTheme(themeName) {
  const value = String(themeName || "").toLowerCase();
  if (ALLOWED_THEMES.includes(value)) return value;
  return "dark";
}

function normalizeLegacyText(value) {
  if (typeof value !== "string") return value;
  return LEGACY_TEXT_MAP[value] || value;
}

function getCloudConfig() {
  const raw = window.ATTENDPRO_CLOUD || {};
  const url = String(raw.url || "").trim().replace(/\/+$/, "");
  const anonKey = String(raw.anonKey || "").trim();
  const table = String(raw.table || "attendpro_accounts").trim();
  return { url, anonKey, table };
}

function isCloudConfigured() {
  const cfg = getCloudConfig();
  return Boolean(cfg.url && cfg.anonKey && cfg.table);
}

function cloudHeaders(extra = {}) {
  const cfg = getCloudConfig();
  return {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${cfg.anonKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

function cloudEndpoint(path) {
  const cfg = getCloudConfig();
  return `${cfg.url}${path}`;
}

async function cloudFetch(path, options = {}) {
  if (!isCloudConfigured()) {
    throw new Error("Cloud sync is not configured.");
  }

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), CLOUD_FETCH_TIMEOUT_MS) : null;
  let response;
  try {
    response = await fetch(cloudEndpoint(path), {
      ...options,
      headers: cloudHeaders(options.headers || {}),
      ...(controller ? { signal: controller.signal } : {})
    });
  } catch (error) {
    if (controller && error?.name === "AbortError") {
      throw new Error("Cloud request timeout.");
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Cloud request failed (${response.status}): ${details}`);
  }

  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new Error("Cloud response is not valid JSON.");
  }
}

async function cloudGetAccountByEmail(email) {
  const cfg = getCloudConfig();
  const encodedEmail = encodeURIComponent(email);
  const path = `/rest/v1/${cfg.table}?select=id,email,name,password_hash,app_state,updated_at&email=eq.${encodedEmail}&limit=1`;
  const rows = await cloudFetch(path, { method: "GET" });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function cloudCreateAccount(account) {
  const cfg = getCloudConfig();
  const path = `/rest/v1/${cfg.table}`;
  const payload = {
    email: account.email,
    name: account.name,
    password_hash: account.passwordHash,
    app_state: account.appState,
    updated_at: new Date().toISOString()
  };

  const rows = await cloudFetch(path, {
    method: "POST",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  return Array.isArray(rows) && rows.length ? rows[0] : rows;
}

async function cloudUpdateStateByAccount(user, appStatePayload) {
  const cfg = getCloudConfig();
  const encodedEmail = encodeURIComponent(user.email);
  const encodedHash = encodeURIComponent(user.passwordHash);
  const path = `/rest/v1/${cfg.table}?email=eq.${encodedEmail}&password_hash=eq.${encodedHash}`;
  const payload = {
    name: user.name,
    app_state: appStatePayload,
    updated_at: new Date().toISOString()
  };

  const patchedRows = await cloudFetch(path, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (Array.isArray(patchedRows) && patchedRows.length > 0) return true;

  const existingByEmail = await cloudGetAccountByEmail(user.email);
  if (existingByEmail && existingByEmail.password_hash !== user.passwordHash) {
    throw new Error("Cloud account exists with different password hash.");
  }

  await cloudCreateAccount({
    email: user.email,
    name: user.name,
    passwordHash: user.passwordHash,
    appState: appStatePayload
  });
  return true;
}

function buildCloudStatePayload() {
  const ownerId = getCurrentUserId();
  const sync = getSyncStateForUser(ownerId);
  const dataUpdatedAt = sync.lastDataChangeAt || new Date().toISOString();
  return {
    selectedDate: state.selectedDate,
    calendarDate: state.calendarDate,
    salaryMonth: state.salaryMonth,
    editMode: false,
    students: getStudentsForUser(ownerId),
    groups: getGroupsForUser(ownerId),
    salaryClosures: getSalaryClosuresForUser(ownerId),
    settings: getUserSettings(ownerId),
    syncMeta: {
      dataUpdatedAt
    }
  };
}

function applyCloudStatePayload(payload, user) {
  if (!payload || typeof payload !== "object") return false;
  const ownerId = user?.id || getCurrentUserId();
  if (!ownerId) return false;

  const next = normalizeState({
    ...state,
    selectedDate: payload.selectedDate ?? state.selectedDate,
    calendarDate: payload.calendarDate ?? state.calendarDate,
    salaryMonth: payload.salaryMonth ?? state.salaryMonth,
    editMode: false,
    students: mergeOwnedRows(
      state.students,
      Array.isArray(payload.students) ? payload.students : getStudentsForUser(ownerId),
      ownerId
    ),
    groups: mergeOwnedRows(
      state.groups,
      Array.isArray(payload.groups) ? payload.groups : getGroupsForUser(ownerId),
      ownerId
    ),
    salaryClosures: mergeOwnedRows(
      state.salaryClosures,
      Array.isArray(payload.salaryClosures) ? payload.salaryClosures : getSalaryClosuresForUser(ownerId),
      ownerId
    ),
    settingsByUser: {
      ...state.settingsByUser,
      [ownerId]: normalizeUserSettings(payload.settings || state.settingsByUser?.[ownerId] || DEFAULT_USER_SETTINGS)
    },
    users: state.users,
    auth: state.auth
  });

  state = next;
  return true;
}

function scheduleCloudSync() {
  if (!isAuthenticated() || !isCloudConfigured()) return;

  cloudSyncQueued = true;
  if (cloudSyncRetryTimer) {
    clearTimeout(cloudSyncRetryTimer);
    cloudSyncRetryTimer = null;
  }
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    void pushStateToCloud();
  }, CLOUD_SYNC_DEBOUNCE_MS);
}

function resetCloudSyncRetry() {
  cloudSyncRetryAttempt = 0;
  if (cloudSyncRetryTimer) {
    clearTimeout(cloudSyncRetryTimer);
    cloudSyncRetryTimer = null;
  }
}

function scheduleCloudSyncRetry() {
  if (!isAuthenticated() || !isCloudConfigured()) return;
  if (cloudSyncRetryTimer) return;

  cloudSyncRetryAttempt += 1;
  const retryDelayMs = Math.min(
    CLOUD_SYNC_RETRY_MAX_MS,
    CLOUD_SYNC_RETRY_BASE_MS * (2 ** Math.max(0, cloudSyncRetryAttempt - 1))
  );

  cloudSyncRetryTimer = setTimeout(() => {
    cloudSyncRetryTimer = null;
    void pushStateToCloud();
  }, retryDelayMs);
}

async function pushStateToCloud() {
  if (!isAuthenticated() || !isCloudConfigured()) return false;
  if (cloudSyncInFlight) return false;

  const user = getCurrentUser();
  if (!user) return false;

  cloudSyncInFlight = true;
  cloudSyncQueued = false;
  try {
    await cloudUpdateStateByAccount(user, buildCloudStatePayload());
    resetCloudSyncRetry();
    const sync = getSyncStateForUser(user.id);
    sync.pendingDataSync = false;
    sync.lastCloudUpdateAt = new Date().toISOString();
    if (!sync.lastDataChangeAt) {
      sync.lastDataChangeAt = sync.lastCloudUpdateAt;
    }
    setSyncStateForUser(user.id, sync);
    state.sync = { ...sync };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Cloud sync error:", error);
    const sync = getSyncStateForUser(user.id);
    if (sync.pendingDataSync) {
      scheduleCloudSyncRetry();
    }
    return false;
  } finally {
    cloudSyncInFlight = false;
    if (cloudSyncQueued) scheduleCloudSync();
  }
}

async function pullStateFromCloudForUser(user, options = {}) {
  if (!isCloudConfigured() || !user?.email) return false;

  try {
    const account = await cloudGetAccountByEmail(user.email);
    if (!account) return false;
    if (account.password_hash !== user.passwordHash) return false;

    const payload = account.app_state;
    const ownerId = user.id;
    const localHasData = hasOwnedDataForUser(ownerId);
    const remoteHasData = hasDataInPayload(payload);
    const sync = getSyncStateForUser(ownerId);
    const remoteUpdatedAt = getRemotePayloadUpdatedAt(payload, account.updated_at);
    const localUpdatedAt = sync.lastDataChangeAt;
    const remoteUpdatedMs = toEpochMs(remoteUpdatedAt);
    const localUpdatedMs = toEpochMs(localUpdatedAt);
    const remoteIsNewerThanLocal = Boolean(
      remoteUpdatedAt
      && localUpdatedAt
      && remoteUpdatedMs > localUpdatedMs
    );
    const preferRemoteOnConflict = Boolean(options?.preferRemoteOnConflict);
    const remoteIsNotOlder = Boolean(remoteUpdatedAt && (!localUpdatedAt || remoteUpdatedMs >= localUpdatedMs));

    // Если есть локальные несинхронизированные изменения, не перетираем их облаком.
    if (sync.pendingDataSync && (localHasData || !remoteHasData)) {
      // Если в облаке данные новее (или запросили приоритет облака вручную),
      // принимаем облачную версию и не пушим локальную поверх нее.
      if (remoteIsNewerThanLocal || (preferRemoteOnConflict && remoteIsNotOlder)) {
        saveSyncConflictBackup({
          ownerId,
          localPayload: buildCloudStatePayload(),
          remotePayload: payload,
          localUpdatedAt,
          remoteUpdatedAt
        });
        // Продолжаем и применяем payload ниже.
      } else {
        await pushStateToCloud();
        return false;
      }
    }

    if (remoteUpdatedAt && localUpdatedAt && localHasData) {
      if (remoteUpdatedMs <= localUpdatedMs) {
        return false;
      }
    }

    const changed = applyCloudStatePayload(payload, user);
    if (changed) {
      const nextSync = getSyncStateForUser(ownerId);
      nextSync.pendingDataSync = false;
      if (remoteUpdatedAt) {
        nextSync.lastCloudUpdateAt = remoteUpdatedAt;
        nextSync.lastDataChangeAt = remoteUpdatedAt;
      } else {
        const nowISO = new Date().toISOString();
        nextSync.lastCloudUpdateAt = nowISO;
        nextSync.lastDataChangeAt = nextSync.lastDataChangeAt || nowISO;
      }
      setSyncStateForUser(ownerId, nextSync);
      state.sync = { ...nextSync };
      saveState({ skipCloud: true });
      renderApp();
    }
    return changed;
  } catch (error) {
    console.error("Cloud pull error:", error);
    return false;
  }
}

async function bootstrapCloudSync() {
  if (!isAuthenticated() || !isCloudConfigured()) return;
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  await pullStateFromCloudForUser(currentUser);

  const sync = getSyncStateForUser(currentUser.id);
  if (sync.pendingDataSync) {
    await pushStateToCloud();
  }
}

function renderApp() {
  if (!root) return;
  applyTheme(state.theme);
  document.body.classList.remove("modal-open");
  refreshTopbarAuthState();

  const ctx = buildContext();
  if (!isAuthenticated()) {
    renderAuth(root, ctx);
    markActiveNavButton();
    return;
  }

  if (state.view === "calendar") {
    renderCalendar(root, ctx);
  } else if (state.view === "students") {
    renderStudentsManager(root, ctx);
  } else if (state.view === "groups") {
    renderGroupsManager(root, ctx);
  } else if (state.view === "stats") {
    renderStatistics(root, ctx);
  } else if (state.view === "salary") {
    renderSalary(root, ctx);
  } else if (state.view === "settings") {
    renderSettings(root, ctx);
  } else {
    renderHome(root, ctx);
  }

  markActiveNavButton();
}

function markActiveNavButton() {
  const viewToButtonId = {
    home: "go-today",
    students: "go-students",
    groups: "go-groups",
    calendar: "go-calendar",
    stats: "go-stats",
    salary: "go-salary",
    settings: "go-settings"
  };

  Object.values(viewToButtonId).forEach((id) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.classList.remove("btn-active");
  });

  if (!isAuthenticated()) return;

  const activeButton = document.getElementById(viewToButtonId[state.view] || "go-today");
  if (activeButton) activeButton.classList.add("btn-active");
}

function buildScopedStateForContext() {
  if (!isAuthenticated()) return state;

  const ownerId = getCurrentUserId();
  return {
    ...state,
    students: getStudentsForUser(ownerId),
    groups: getGroupsForUser(ownerId),
    salaryClosures: getSalaryClosuresForUser(ownerId)
  };
}

function buildContext() {
  const scopedState = buildScopedStateForContext();
  const userSettings = getUserSettings();
  const workSchedule = normalizeWorkSchedule(userSettings.workSchedule);
  const workHours = getWorkHoursFromSchedule(workSchedule);
  const packageOptions = getPackageOptionsByCategory(userSettings.trainerCategory);
  return {
    state: scopedState,
    currentUser: getCurrentUser(),
    userSettings,
    workSchedule,
    workHours,
    getWorkHoursForDays: (scheduleDays = []) => {
      const hours = getAvailableWorkHours(workSchedule, scheduleDays);
      return hours.length ? hours : [...workHours];
    },
    trainerCategories: TRAINER_CATEGORIES,
    weekDays,
    packageOptions,
    isCloudConfigured: isCloudConfigured(),
    isServerAutoReportEnabled: isServerAutoReportEnabled(),
    getTodayISO,
    formatDate,
    dayLabel,
    getSessionsForDate,
    getSessionsByDate,
    getStatistics,
    getSalaryReport,
    actions: {
      setSelectedDate,
      shiftSelectedDate,
      toggleEditMode,
      isEditingAllowedForSelectedDate,
      isDateLocked,
      setCalendarDate,
      openDateJournalFromCalendar,
      addStudent,
      addStudentPackage,
      updateStudentSchedule,
      updateStudentCardData,
      deleteStudentCard,
      addGroup,
      updateGroupCardData,
      deleteGroupCard,
      markPersonalSession,
      forceSetPersonalStatus,
      reschedulePersonalSession,
      setGroupAttendance,
      setSalaryMonth,
      closeSalaryMonth,
      reopenSalaryMonth,
      exportSalaryMonthCSV,
      exportStatisticsCSV,
      exportBackupJSON,
      importBackupFromFile,
      setTheme,
      setTrainerCategory,
      setWorkScheduleSettings,
      setAutoReportSettings,
      syncCloudNow,
      sendTodayReportToTelegram,
      registerUser,
      loginUser,
      logoutUser
    }
  };
}

function createInitialState() {
  const todayISO = getTodayISO();
  return {
    appVersion: APP_VERSION,
    theme: "dark",
    view: "home",
    selectedDate: todayISO,
    calendarDate: monthStartISO(todayISO),
    salaryMonth: todayISO.slice(0, 7),
    users: [],
    auth: {
      currentUserId: null
    },
    settingsByUser: {},
    syncByUser: {},
    sync: {
      ...DEFAULT_SYNC_STATE
    },
    editMode: false,
    students: [],
    groups: [],
    salaryClosures: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (error) {
    console.error("Ошибка загрузки LocalStorage, использую пустое состояние.", error);
    return createInitialState();
  }
}

function saveState(options = {}) {
  if (options.dataChanged) {
    const userId = state?.auth?.currentUserId || getCurrentUserId();
    if (userId) {
      const sync = getSyncStateForUser(userId);
      sync.pendingDataSync = true;
      sync.lastDataChangeAt = new Date().toISOString();
      setSyncStateForUser(userId, sync);
      // Оставляем legacy-поле для обратной совместимости с ранними версиями.
      state.sync = { ...sync };
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (options.skipCloud) return;
  if (!options.dataChanged) return;
  scheduleCloudSync();
}

function normalizeState(input) {
  const defaults = createInitialState();
  const next = {
    ...defaults,
    ...input
  };

  next.theme = normalizeTheme(next.theme);
  next.view = isAllowedView(next.view) ? next.view : "home";
  next.selectedDate = ensureISODate(next.selectedDate, defaults.selectedDate);
  next.calendarDate = ensureISODate(next.calendarDate, monthStartISO(next.selectedDate));
  next.salaryMonth = ensureMonthISO(next.salaryMonth, defaults.salaryMonth);
  next.users = Array.isArray(next.users) ? next.users.map(normalizeUser).filter(Boolean) : [];
  next.auth = normalizeAuth(next.auth, next.users);
  next.settingsByUser = normalizeSettingsByUser(next.settingsByUser);
  if (next.auth.currentUserId && !next.settingsByUser[next.auth.currentUserId]) {
    next.settingsByUser[next.auth.currentUserId] = createDefaultUserSettings();
  }
  const legacySync = normalizeSyncState(next.sync);
  next.syncByUser = normalizeSyncByUser(next.syncByUser);
  if (next.auth.currentUserId && !next.syncByUser[next.auth.currentUserId]) {
    next.syncByUser[next.auth.currentUserId] = { ...legacySync };
  }
  next.sync = legacySync;
  next.editMode = Boolean(next.editMode);
  const fallbackOwnerId = getMigrationFallbackOwnerId(next.users);
  next.students = Array.isArray(next.students)
    ? next.students.map((student) => normalizeStudent(student, fallbackOwnerId)).filter(Boolean)
    : [];
  next.groups = Array.isArray(next.groups)
    ? next.groups.map((group) => normalizeGroup(group, fallbackOwnerId)).filter(Boolean)
    : [];
  next.salaryClosures = Array.isArray(next.salaryClosures)
    ? next.salaryClosures
      .map((closure) => normalizeSalaryClosure(closure, fallbackOwnerId))
      .filter(Boolean)
    : [];

  // На старте поддерживаем целостность будущего расписания.
  next.students.forEach((student) => {
    rebuildStudentPlannedSessions(student, getTodayISO());
  });

  next.groups.forEach((group) => {
    rebuildGroupFutureSessions(group, getTodayISO());
  });

  return next;
}

function normalizeSyncState(rawSync) {
  if (!rawSync || typeof rawSync !== "object") {
    return { ...DEFAULT_SYNC_STATE };
  }

  const lastDataChangeAt = isValidISODateTime(rawSync.lastDataChangeAt) ? rawSync.lastDataChangeAt : null;
  const lastCloudUpdateAt = isValidISODateTime(rawSync.lastCloudUpdateAt) ? rawSync.lastCloudUpdateAt : null;

  return {
    pendingDataSync: Boolean(rawSync.pendingDataSync),
    lastDataChangeAt,
    lastCloudUpdateAt
  };
}

function normalizeSyncByUser(rawSyncByUser) {
  if (!rawSyncByUser || typeof rawSyncByUser !== "object" || Array.isArray(rawSyncByUser)) {
    return {};
  }

  const normalized = {};
  Object.entries(rawSyncByUser).forEach(([userId, rawSync]) => {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) return;
    normalized[normalizedUserId] = normalizeSyncState(rawSync);
  });
  return normalized;
}

function normalizeSettingsByUser(rawSettingsByUser) {
  if (!rawSettingsByUser || typeof rawSettingsByUser !== "object" || Array.isArray(rawSettingsByUser)) {
    return {};
  }

  const normalized = {};
  Object.entries(rawSettingsByUser).forEach(([userId, rawSettings]) => {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) return;
    normalized[normalizedUserId] = normalizeUserSettings(rawSettings);
  });
  return normalized;
}

function getMigrationFallbackOwnerId(users) {
  if (!Array.isArray(users) || !users.length) return null;
  return users[0]?.id || null;
}

function isAllowedView(value) {
  return ["home", "students", "groups", "calendar", "stats", "salary", "settings"].includes(value);
}

function normalizeOwnerId(ownerId, fallbackOwnerId = null) {
  const value = String(ownerId || fallbackOwnerId || "").trim();
  return value || null;
}

function normalizeTrainingType(value) {
  if (value === "split") return "split";
  if (value === "mini_group") return "mini_group";
  return "personal";
}

function normalizeStudent(rawStudent, fallbackOwnerId = null) {
  const trainingType = normalizeTrainingType(rawStudent.trainingType);
  const participants = normalizeParticipants(rawStudent, trainingType);
  const packageCount = normalizePackageCount(rawStudent.totalTrainings);
  const activePackage = normalizeActivePackage(rawStudent.activePackage, trainingType, packageCount);
  const ownerId = normalizeOwnerId(rawStudent.ownerId, fallbackOwnerId);

  const student = {
    id: String(rawStudent.id || createId("student")),
    ownerId,
    name: String(normalizeLegacyText(rawStudent.name || participants.join(" / "))).trim(),
    trainingType,
    participants,
    scheduleDays: sanitizeWeekDays(rawStudent.scheduleDays, [1, 3, 5]),
    time: sanitizeHourTime(rawStudent.time),
    totalTrainings: packageCount,
    remainingTrainings: sanitizeRemaining(rawStudent.remainingTrainings, packageCount),
    activePackage,
    packagesHistory: normalizePackagesHistory(rawStudent.packagesHistory, activePackage, trainingType),
    sessions: Array.isArray(rawStudent.sessions) ? rawStudent.sessions.map((session) => normalizeStudentSession(session, activePackage, trainingType)) : [],
    createdAt: rawStudent.createdAt || new Date().toISOString()
  };

  if (trainingType === "mini_group" && student.activePackage) {
    const normalizedParticipantsCount = Math.max(
      MINI_GROUP_MIN_PARTICIPANTS,
      Math.min(
        MINI_GROUP_MAX_PARTICIPANTS,
        Number(student.activePackage.participantsCount || participants.length || MINI_GROUP_MIN_PARTICIPANTS)
      )
    );
    student.activePackage.participantsCount = normalizedParticipantsCount;
  }

  return student;
}

function normalizeGroup(rawGroup, fallbackOwnerId = null) {
  const ownerId = normalizeOwnerId(rawGroup.ownerId, fallbackOwnerId);
  return {
    id: String(rawGroup.id || createId("group")),
    ownerId,
    name: String(normalizeLegacyText(rawGroup.name || "Группа")).trim(),
    scheduleDays: sanitizeWeekDays(rawGroup.scheduleDays, [1, 3, 5]),
    time: sanitizeHourTime(rawGroup.time),
    students: Array.isArray(rawGroup.students)
      ? rawGroup.students.map((item) => ({
        id: String(item.id || createId("member")),
        name: String(normalizeLegacyText(item.name || "")).trim()
      })).filter((item) => item.name)
      : [],
    sessions: Array.isArray(rawGroup.sessions) ? rawGroup.sessions.map(normalizeGroupSession) : [],
    createdAt: rawGroup.createdAt || new Date().toISOString()
  };
}

function normalizeSalaryClosure(rawClosure, fallbackOwnerId = null) {
  if (!rawClosure || !rawClosure.monthISO || !rawClosure.snapshot) return null;
  return {
    ownerId: normalizeOwnerId(rawClosure.ownerId, fallbackOwnerId),
    monthISO: ensureMonthISO(rawClosure.monthISO, getTodayISO().slice(0, 7)),
    closedAt: rawClosure.closedAt || new Date().toISOString(),
    snapshot: rawClosure.snapshot
  };
}

function normalizeUser(rawUser) {
  if (!rawUser) return null;

  const id = String(rawUser.id || createId("user"));
  const name = String(normalizeLegacyText(rawUser.name || "")).trim();
  const email = normalizeEmail(rawUser.email);
  const passwordHash = String(rawUser.passwordHash || rawUser.password || "");

  if (!name || !email || !passwordHash) return null;

  return {
    id,
    name,
    email,
    passwordHash,
    createdAt: rawUser.createdAt || new Date().toISOString()
  };
}

function normalizeAuth(rawAuth, users) {
  const currentUserId = String(rawAuth?.currentUserId || "");
  if (!currentUserId) return { currentUserId: null };

  const exists = users.some((user) => user.id === currentUserId);
  return {
    currentUserId: exists ? currentUserId : null
  };
}

function normalizeStudentSession(rawSession, activePackage, trainingType) {
  return {
    id: String(rawSession.id || createId("session")),
    date: ensureISODate(rawSession.date, getTodayISO()),
    time: sanitizeHourTime(rawSession.time),
    status: normalizePersonalStatus(rawSession.status),
    coachIncome: Number.isFinite(Number(rawSession.coachIncome))
      ? Number(rawSession.coachIncome)
      : getCoachIncomePerSession(activePackage, trainingType)
  };
}

function normalizeGroupSession(rawSession) {
  return {
    id: String(rawSession.id || createId("gsession")),
    date: ensureISODate(rawSession.date, getTodayISO()),
    time: sanitizeHourTime(rawSession.time),
    attendance: normalizeAttendanceMap(rawSession.attendance)
  };
}

function normalizeAttendanceMap(attendance) {
  if (!attendance || typeof attendance !== "object") return {};

  const map = {};
  Object.entries(attendance).forEach(([studentId, status]) => {
    const normalizedStatus = normalizeLegacyText(status);
    if (normalizedStatus === "присутствовал" || normalizedStatus === "отсутствовал") {
      map[String(studentId)] = normalizedStatus;
    }
  });
  return map;
}

function normalizePersonalStatus(status) {
  const normalizedStatus = normalizeLegacyText(status);
  if (normalizedStatus === "пришел" || normalizedStatus === "не пришел" || normalizedStatus === "запланировано") {
    return normalizedStatus;
  }
  return "запланировано";
}

function normalizeParticipants(rawStudent, trainingType) {
  if (Array.isArray(rawStudent.participants) && rawStudent.participants.length) {
    const cleaned = rawStudent.participants
      .map((item) => String(normalizeLegacyText(item || "")).trim())
      .filter(Boolean);
    if (trainingType === "split") return cleaned.slice(0, 2);
    if (trainingType === "mini_group") {
      const mini = cleaned.slice(0, MINI_GROUP_MAX_PARTICIPANTS);
      if (mini.length >= MINI_GROUP_MIN_PARTICIPANTS) return mini;
      return ["Участник 1", "Участник 2", "Участник 3"];
    }
    return [cleaned[0] || String(normalizeLegacyText(rawStudent.name || "Ученик")).trim()];
  }

  const studentName = String(normalizeLegacyText(rawStudent.name || "Ученик")).trim();
  if (trainingType === "split") {
    const [first, second] = studentName.split("/").map((item) => item.trim()).filter(Boolean);
    return [first || "Участник 1", second || "Участник 2"];
  }

  if (trainingType === "mini_group") {
    const parsed = studentName.split("/").map((item) => item.trim()).filter(Boolean).slice(0, MINI_GROUP_MAX_PARTICIPANTS);
    if (parsed.length >= MINI_GROUP_MIN_PARTICIPANTS) return parsed;
    return ["Участник 1", "Участник 2", "Участник 3"];
  }
  return [studentName];
}

function sanitizeParticipantNames(values) {
  return (Array.isArray(values) ? values : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeMiniGroupNames(values) {
  const names = sanitizeParticipantNames(values);
  return names.slice(0, MINI_GROUP_MAX_PARTICIPANTS);
}

function normalizePackageCount(value) {
  const count = Number(value);
  if (Number.isFinite(count) && count > 0) return count;
  return 10;
}

function normalizeActivePackage(rawPackage, trainingType, countFallback) {
  const fallbackCategory = normalizeTrainerCategory(rawPackage?.trainerCategory);
  const packageFromOption = getPackageByCount(trainingType, countFallback, fallbackCategory)
    || getPackageByCount(trainingType, 10, fallbackCategory);
  const purchasedAt = rawPackage?.purchasedAt || new Date().toISOString();
  const trainerCategory = normalizeTrainerCategory(rawPackage?.trainerCategory || fallbackCategory);
  const coachPercent = normalizeCoachPercent(rawPackage?.coachPercent);

  if (trainingType === "split" || trainingType === "mini_group") {
    const participantsCount = trainingType === "mini_group"
      ? Math.max(
        MINI_GROUP_MIN_PARTICIPANTS,
        Math.min(MINI_GROUP_MAX_PARTICIPANTS, Number(rawPackage?.participantsCount || MINI_GROUP_MIN_PARTICIPANTS))
      )
      : 2;

    return {
      count: Number(rawPackage?.count || packageFromOption.count),
      pricePerPerson: Number(rawPackage?.pricePerPerson || packageFromOption.pricePerPerson),
      participantsCount,
      trainerCategory,
      coachPercent,
      purchasedAt
    };
  }

  return {
    count: Number(rawPackage?.count || packageFromOption.count),
    totalPrice: Number(rawPackage?.totalPrice || packageFromOption.totalPrice),
    trainerCategory,
    coachPercent,
    purchasedAt
  };
}

function normalizePackagesHistory(history, activePackage, trainingType) {
  const rows = Array.isArray(history) ? history : [];

  const normalized = rows
    .map((item) => {
      if (trainingType === "split" || trainingType === "mini_group") {
        const participantsCount = trainingType === "mini_group"
          ? Math.max(
            MINI_GROUP_MIN_PARTICIPANTS,
            Math.min(
              MINI_GROUP_MAX_PARTICIPANTS,
              Number(item.participantsCount || activePackage.participantsCount || MINI_GROUP_MIN_PARTICIPANTS)
            )
          )
          : 2;

        return {
          count: Number(item.count || activePackage.count),
          pricePerPerson: Number(item.pricePerPerson || activePackage.pricePerPerson),
          participantsCount,
          trainerCategory: normalizeTrainerCategory(item.trainerCategory || activePackage.trainerCategory),
          coachPercent: normalizeCoachPercent(item.coachPercent ?? activePackage.coachPercent),
          purchasedAt: item.purchasedAt || new Date().toISOString()
        };
      }
      return {
        count: Number(item.count || activePackage.count),
        totalPrice: Number(item.totalPrice || activePackage.totalPrice),
        trainerCategory: normalizeTrainerCategory(item.trainerCategory || activePackage.trainerCategory),
        coachPercent: normalizeCoachPercent(item.coachPercent ?? activePackage.coachPercent),
        purchasedAt: item.purchasedAt || new Date().toISOString()
      };
    })
    .filter((item) => Number(item.count) > 0);

  if (!normalized.length) {
    return [{ ...activePackage }];
  }
  return normalized;
}

function sanitizeWeekDays(days, fallbackDays = []) {
  if (!Array.isArray(days)) return [...fallbackDays];

  const valid = new Set(days.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0 && item <= 6));
  const order = weekDays.map((day) => day.jsDay);
  const result = order.filter((day) => valid.has(day));
  return result.length ? result : [...fallbackDays];
}

function sanitizeHourTime(value) {
  if (typeof value !== "string") return "10:00";
  const [hourRaw] = value.split(":");
  const hour = Number(hourRaw);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return "10:00";
  return `${String(hour).padStart(2, "0")}:00`;
}

function sanitizeRemaining(remaining, total) {
  const value = Number(remaining);
  if (!Number.isFinite(value)) return total;
  return Math.max(0, Math.min(total, Math.floor(value)));
}

function ensureISODate(value, fallback) {
  if (typeof value !== "string") return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return fallback;
}

function ensureMonthISO(value, fallback) {
  if (typeof value !== "string") return fallback;
  if (/^\d{4}-\d{2}$/.test(value)) return value;
  return fallback;
}

function isValidISODateTime(value) {
  if (!value) return false;
  return Number.isFinite(Date.parse(String(value)));
}

function normalizeTrainerCategory(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return TRAINER_CATEGORIES.includes(normalized) ? normalized : DEFAULT_TRAINER_CATEGORY;
}

function normalizeCoachPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_COACH_PERCENT;
  return Math.max(1, Math.min(100, Math.round(numeric)));
}

function normalizeWorkHour(value, fallbackHour) {
  const hour = Number(value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return fallbackHour;
  return hour;
}

function normalizeWorkSchedule(rawWorkSchedule = {}) {
  const defaultDays = weekDays.map((item) => item.jsDay);
  const days = sanitizeWeekDays(rawWorkSchedule?.days, defaultDays);
  let startHour = normalizeWorkHour(rawWorkSchedule?.startHour, 0);
  let endHour = normalizeWorkHour(rawWorkSchedule?.endHour, 23);
  if (endHour < startHour) {
    const swap = startHour;
    startHour = endHour;
    endHour = swap;
  }

  return {
    days,
    startHour,
    endHour
  };
}

function getWorkHoursFromSchedule(workSchedule) {
  const normalized = normalizeWorkSchedule(workSchedule);
  const hours = [];
  for (let hour = normalized.startHour; hour <= normalized.endHour; hour += 1) {
    hours.push(hour);
  }
  return hours.length ? hours : [normalized.startHour];
}

function getAvailableWorkHours(workSchedule, scheduleDays = []) {
  const normalized = normalizeWorkSchedule(workSchedule);
  const selectedDays = sanitizeWeekDays(scheduleDays, []);
  if (selectedDays.length && !selectedDays.some((day) => normalized.days.includes(day))) {
    return [];
  }
  return getWorkHoursFromSchedule(normalized);
}

function isScheduleWithinWorkDays(scheduleDays, workSchedule) {
  const normalized = normalizeWorkSchedule(workSchedule);
  return scheduleDays.every((day) => normalized.days.includes(day));
}

function isTimeWithinWorkHours(time, workSchedule) {
  const normalized = normalizeWorkSchedule(workSchedule);
  const hour = Number(String(time || "00:00").slice(0, 2));
  return Number.isInteger(hour) && hour >= normalized.startHour && hour <= normalized.endHour;
}

function normalizeAutoReportHour(value) {
  const hour = Number(value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return 18;
  return hour;
}

function normalizeAutoReportSlotKey(value) {
  const slotKey = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}__\d{2}$/.test(slotKey)) {
    return slotKey;
  }
  return "";
}

function normalizeAutoReportSettings(rawAutoReport = {}) {
  const days = sanitizeWeekDays(rawAutoReport?.days, []);
  const hour = normalizeAutoReportHour(rawAutoReport?.hour);
  const enabled = Boolean(rawAutoReport?.enabled) && days.length > 0;
  const lastSentSlotKey = normalizeAutoReportSlotKey(rawAutoReport?.lastSentSlotKey);

  return {
    enabled,
    days,
    hour,
    lastSentSlotKey
  };
}

function normalizeUserSettings(rawSettings) {
  return {
    trainerCategory: normalizeTrainerCategory(rawSettings?.trainerCategory),
    coachPercent: normalizeCoachPercent(rawSettings?.coachPercent),
    workSchedule: normalizeWorkSchedule(rawSettings?.workSchedule),
    autoReport: normalizeAutoReportSettings(rawSettings?.autoReport)
  };
}

function createDefaultUserSettings() {
  return normalizeUserSettings(DEFAULT_USER_SETTINGS);
}

function getUserSettings(userId = getCurrentUserId()) {
  if (!userId) return createDefaultUserSettings();
  state.settingsByUser = normalizeSettingsByUser(state.settingsByUser);
  return normalizeUserSettings(state.settingsByUser[userId] || DEFAULT_USER_SETTINGS);
}

function setUserSettingsForUser(userId, patch) {
  if (!userId) return;
  const current = getUserSettings(userId);
  const next = normalizeUserSettings({
    ...current,
    ...(patch || {})
  });
  state.settingsByUser = normalizeSettingsByUser(state.settingsByUser);
  state.settingsByUser[userId] = next;
}

function getPriceForPackage(type, category, count) {
  const normalizedType = type === "split" || type === "mini_group" ? type : "personal";
  const normalizedCategory = normalizeTrainerCategory(category);
  const numericCount = Number(count);
  const categoryTable = CATEGORY_PRICE_TABLES[normalizedType]?.[normalizedCategory] || {};
  const price = Number(categoryTable[numericCount]);
  if (Number.isFinite(price) && price > 0) return price;
  return null;
}

function getPackageOptionsByCategory(category) {
  const normalizedCategory = normalizeTrainerCategory(category);
  const personal = PACKAGE_COUNTS.map((count) => ({
    count,
    totalPrice: getPriceForPackage("personal", normalizedCategory, count) || 0
  }));
  const split = PACKAGE_COUNTS.map((count) => ({
    count,
    pricePerPerson: getPriceForPackage("split", normalizedCategory, count) || 0
  }));
  const mini_group = PACKAGE_COUNTS.map((count) => ({
    count,
    pricePerPerson: getPriceForPackage("mini_group", normalizedCategory, count) || 0
  }));
  return { personal, split, mini_group };
}

function getPackageByCount(type, count, category = DEFAULT_TRAINER_CATEGORY) {
  const options = getPackageOptionsByCategory(category);
  const list = type === "split"
    ? options.split
    : type === "mini_group"
      ? options.mini_group
      : options.personal;
  const numericCount = Number(count);
  return list.find((item) => Number(item.count) === numericCount) || null;
}

function buildPackage(type, count, participantsCount = null) {
  const settings = getUserSettings();
  const option = getPackageByCount(type, count, settings.trainerCategory);
  if (!option) return null;

  if (type === "split") {
    return {
      count: option.count,
      pricePerPerson: option.pricePerPerson,
      trainerCategory: settings.trainerCategory,
      coachPercent: settings.coachPercent,
      purchasedAt: new Date().toISOString()
    };
  }

  if (type === "mini_group") {
    const normalizedCount = Math.max(
      MINI_GROUP_MIN_PARTICIPANTS,
      Math.min(MINI_GROUP_MAX_PARTICIPANTS, Number(participantsCount || MINI_GROUP_MIN_PARTICIPANTS))
    );
    return {
      count: option.count,
      pricePerPerson: option.pricePerPerson,
      participantsCount: normalizedCount,
      trainerCategory: settings.trainerCategory,
      coachPercent: settings.coachPercent,
      purchasedAt: new Date().toISOString()
    };
  }

  return {
    count: option.count,
    totalPrice: option.totalPrice,
    trainerCategory: settings.trainerCategory,
    coachPercent: settings.coachPercent,
    purchasedAt: new Date().toISOString()
  };
}

function getCoachIncomePerSession(activePackage, trainingType) {
  if (!activePackage) return 0;

  const count = Number(activePackage.count) || 1;
  if (trainingType === "split") {
    const perPerson = Number(activePackage.pricePerPerson || 0);
    const totalPerSession = (perPerson * 2) / count;
    return roundMoney(totalPerSession);
  }

  if (trainingType === "mini_group") {
    const perPerson = Number(activePackage.pricePerPerson || 0);
    const participantsCount = Math.max(
      MINI_GROUP_MIN_PARTICIPANTS,
      Math.min(MINI_GROUP_MAX_PARTICIPANTS, Number(activePackage.participantsCount || MINI_GROUP_MIN_PARTICIPANTS))
    );
    const totalPerSession = (perPerson * participantsCount) / count;
    return roundMoney(totalPerSession);
  }

  const totalPrice = Number(activePackage.totalPrice || 0);
  return roundMoney(totalPrice / count);
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getTodayISO() {
  return toISODate(new Date());
}

function buildTodayAttendanceReportText(dateISO) {
  const sessions = getSessionsForDate(dateISO);
  const user = getCurrentUser();
  const personalTypeLabel = { personal: "персональная", split: "сплит", mini_group: "мини-группа" };
  const lines = [
    "AttendPro: отчет посещаемости",
    `Дата: ${formatDate(dateISO)}`,
    `Аккаунт: ${user?.email || "-"}`,
    ""
  ];

  if (!sessions.length) {
    lines.push("Сегодня занятий нет.");
    return limitTelegramReportText(lines.join("\n"));
  }

  let personalPlannedCount = 0;
  let groupTotal = 0;
  let groupPresent = 0;
  let groupAbsent = 0;
  let groupUnmarked = 0;
  const unmarkedLines = [];

  const personalRows = sessions
    .filter((entry) => entry.type === "personal")
    .map((entry) => {
      const trainingType = entry.trainingType === "split" || entry.trainingType === "mini_group"
        ? entry.trainingType
        : "personal";
      const status = entry.data.status;
      if (status === "запланировано") {
        personalPlannedCount += 1;
        unmarkedLines.push(`- ${entry.data.time} ${entry.studentName} (${personalTypeLabel[trainingType]})`);
      }

      return `- ${entry.data.time}  ${entry.studentName}: ${status}`;
    });
  if (personalRows.length) {
    lines.push(...personalRows);
  } else {
    lines.push("- Нет персональных занятий");
  }

  lines.push("");
  lines.push("Группы:");
  const groupRows = sessions
    .filter((entry) => entry.type === "group")
    .map((entry) => {
      groupTotal += 1;
      const marks = Object.values(entry.data.attendance || {});
      const presentCount = marks.filter((item) => item === "присутствовал").length;
      const absentCount = marks.filter((item) => item === "отсутствовал").length;
      const unmarkedCount = Math.max(0, (entry.students || []).length - presentCount - absentCount);

      groupPresent += presentCount;
      groupAbsent += absentCount;
      groupUnmarked += unmarkedCount;
      if (unmarkedCount > 0) {
        unmarkedLines.push(`- ${entry.data.time} ${entry.groupName}: без отметки ${unmarkedCount}`);
      }

      return `- ${entry.data.time} ${entry.groupName}: без отметки ${unmarkedCount}`;
    });
  if (groupRows.length) {
    lines.push(...groupRows);
  } else {
    lines.push("- Нет групповых занятий");
  }

  lines.push("");
  lines.push("Итого не отмечено:");
  if (unmarkedLines.length) {
    lines.push(...unmarkedLines);
  } else {
    lines.push("- Нет неотмеченных");
  }

  lines.push(
    `Персональные/сплиты/мини-группы без отметки: ${personalPlannedCount}`
  );
  lines.push(
    `Группы: ${groupTotal} (присутствовали: ${groupPresent}, отсутствовали: ${groupAbsent}, без отметки: ${groupUnmarked})`
  );

  return limitTelegramReportText(lines.join("\n"));
}

function limitTelegramReportText(text) {
  const value = String(text || "");
  if (value.length <= TELEGRAM_REPORT_MAX_LENGTH) return value;
  const marker = "\n...\n[Отчет сокращен из-за ограничения Telegram]";
  const maxBaseLength = Math.max(0, TELEGRAM_REPORT_MAX_LENGTH - marker.length);
  return `${value.slice(0, maxBaseLength)}${marker}`;
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODate(isoDate) {
  const [y, m, d] = String(isoDate).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDaysISO(isoDate, days) {
  const date = parseISODate(isoDate);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function compareISODate(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function monthStartISO(dateISOOrMonthISO) {
  const source = String(dateISOOrMonthISO);
  if (/^\d{4}-\d{2}$/.test(source)) return `${source}-01`;
  return `${source.slice(0, 7)}-01`;
}

function monthEndISO(monthISO) {
  const [year, month] = String(monthISO).split("-").map(Number);
  const end = new Date(year, month, 0);
  return toISODate(end);
}

function monthOfDate(isoDate) {
  return String(isoDate).slice(0, 7);
}

function isDateInMonth(dateISO, monthISO) {
  return monthOfDate(dateISO) === monthISO;
}

function formatDate(isoDate) {
  return parseISODate(isoDate).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function dayLabel(jsDay) {
  const found = weekDays.find((day) => day.jsDay === Number(jsDay));
  return found ? found.label : "-";
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function sortSessionsByDateTime(sessions) {
  sessions.sort((a, b) => {
    const dateCmp = compareISODate(a.date, b.date);
    if (dateCmp !== 0) return dateCmp;
    return String(a.time).localeCompare(String(b.time));
  });
}

function isFinalPersonalStatus(status) {
  return status === "пришел" || status === "не пришел";
}

function normalizeEmail(emailValue) {
  return String(emailValue || "").trim().toLowerCase();
}

function hashPassword(password) {
  const source = String(password || "");
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

function getCurrentUser() {
  const userId = state?.auth?.currentUserId;
  if (!userId) return null;
  return state.users.find((user) => user.id === userId) || null;
}

function getCurrentUserId() {
  return getCurrentUser()?.id || null;
}

function getSyncStateForUser(userId = getCurrentUserId()) {
  if (!userId) return normalizeSyncState(state.sync);
  state.syncByUser = normalizeSyncByUser(state.syncByUser);
  return normalizeSyncState(state.syncByUser[userId]);
}

function setSyncStateForUser(userId, nextSync) {
  if (!userId) return;
  state.syncByUser = normalizeSyncByUser(state.syncByUser);
  state.syncByUser[userId] = normalizeSyncState(nextSync);
}

function isAuthenticated() {
  return Boolean(getCurrentUser());
}

function getStudentsForUser(userId = getCurrentUserId()) {
  if (!userId) return [];
  return state.students.filter((student) => student.ownerId === userId);
}

function getGroupsForUser(userId = getCurrentUserId()) {
  if (!userId) return [];
  return state.groups.filter((group) => group.ownerId === userId);
}

function getSalaryClosuresForUser(userId = getCurrentUserId()) {
  if (!userId) return [];
  return state.salaryClosures.filter((closure) => closure.ownerId === userId);
}

function hasOwnedDataForUser(userId = getCurrentUserId()) {
  if (!userId) return false;
  return getStudentsForUser(userId).length > 0
    || getGroupsForUser(userId).length > 0
    || getSalaryClosuresForUser(userId).length > 0;
}

function hasDataInPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  return Array.isArray(payload.students) && payload.students.length > 0
    || Array.isArray(payload.groups) && payload.groups.length > 0
    || Array.isArray(payload.salaryClosures) && payload.salaryClosures.length > 0;
}

function getRemotePayloadUpdatedAt(payload, fallbackUpdatedAt = null) {
  const fromPayload = payload?.syncMeta?.dataUpdatedAt;
  if (isValidISODateTime(fromPayload)) return fromPayload;
  if (isValidISODateTime(fallbackUpdatedAt)) return fallbackUpdatedAt;
  return null;
}

function toEpochMs(dateTimeValue) {
  const ms = Date.parse(String(dateTimeValue || ""));
  return Number.isFinite(ms) ? ms : 0;
}

function readSyncConflictBackups() {
  try {
    const raw = localStorage.getItem(SYNC_CONFLICT_BACKUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .slice(0, MAX_SYNC_CONFLICT_BACKUPS);
  } catch (_error) {
    return [];
  }
}

function writeSyncConflictBackups(backups) {
  const next = Array.isArray(backups) ? backups.slice(0, MAX_SYNC_CONFLICT_BACKUPS) : [];
  localStorage.setItem(SYNC_CONFLICT_BACKUPS_KEY, JSON.stringify(next));
}

function saveSyncConflictBackup(payload) {
  try {
    const item = {
      createdAt: new Date().toISOString(),
      ownerId: String(payload?.ownerId || ""),
      localUpdatedAt: payload?.localUpdatedAt || null,
      remoteUpdatedAt: payload?.remoteUpdatedAt || null,
      localPayload: payload?.localPayload || null,
      remotePayload: payload?.remotePayload || null
    };
    const current = readSyncConflictBackups();
    writeSyncConflictBackups([item, ...current]);
  } catch (_error) {
    // no-op: never block sync because of backup write issues
  }
}

function mergeOwnedRows(allRows, ownedRows, ownerId) {
  const foreignRows = (Array.isArray(allRows) ? allRows : []).filter((item) => item?.ownerId !== ownerId);
  const currentRows = (Array.isArray(ownedRows) ? ownedRows : [])
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      ...item,
      ownerId
    }));
  return [...foreignRows, ...currentRows];
}

function buildEmptyAccountData() {
  const todayISO = getTodayISO();
  const nowISO = new Date().toISOString();
  return {
    selectedDate: todayISO,
    calendarDate: monthStartISO(todayISO),
    salaryMonth: todayISO.slice(0, 7),
    editMode: false,
    students: [],
    groups: [],
    salaryClosures: [],
    settings: createDefaultUserSettings(),
    syncMeta: {
      dataUpdatedAt: nowISO
    }
  };
}

function claimLegacyOrphanDataForUser(userId) {
  if (!userId) return;
  setUserSettingsForUser(userId, getUserSettings(userId));

  const hasOwnedRows = state.students.some((row) => row.ownerId)
    || state.groups.some((row) => row.ownerId)
    || state.salaryClosures.some((row) => row.ownerId);

  if (hasOwnedRows) return;

  state.students = state.students.map((row) => ({ ...row, ownerId: userId }));
  state.groups = state.groups.map((row) => ({ ...row, ownerId: userId }));
  state.salaryClosures = state.salaryClosures.map((row) => ({ ...row, ownerId: userId }));
}

function pickOwnedRowsFromImport(rows, ownerId) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && typeof row === "object" && (!row.ownerId || row.ownerId === ownerId))
    .map((row) => ({
      ...row,
      ownerId
    }));
}

async function registerUser(payload) {
  const name = String(payload?.name || "").trim();
  const email = normalizeEmail(payload?.email);
  const password = String(payload?.password || "");
  const confirmPassword = String(payload?.confirmPassword || "");

  if (!name) return { ok: false, message: "Введите имя." };
  if (!email || !email.includes("@")) return { ok: false, message: "Введите корректный Email." };
  if (password.length < 4) return { ok: false, message: "Пароль должен содержать минимум 4 символа." };
  if (password !== confirmPassword) return { ok: false, message: "Пароли не совпадают." };

  const alreadyExists = state.users.some((user) => user.email === email);
  if (alreadyExists) return { ok: false, message: "Пользователь с таким Email уже зарегистрирован." };

  const user = {
    id: createId("user"),
    name,
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  };

  if (isCloudConfigured()) {
    try {
      const remoteExisting = await cloudGetAccountByEmail(email);
      if (remoteExisting) {
        return { ok: false, message: "Аккаунт с таким Email уже есть в облачной базе." };
      }

      await cloudCreateAccount({
        email: user.email,
        name: user.name,
        passwordHash: user.passwordHash,
        appState: buildEmptyAccountData()
      });
    } catch (error) {
      console.error("Cloud register error:", error);
      return { ok: false, message: "Не удалось зарегистрировать аккаунт в облаке." };
    }
  }

  state.users.push(user);
  state.auth.currentUserId = user.id;
  claimLegacyOrphanDataForUser(user.id);
  state.view = "home";
  saveState({ dataChanged: true });
  await pushStateToCloud();
  renderApp();

  return { ok: true };
}

async function loginUser(payload) {
  const email = normalizeEmail(payload?.email);
  const password = String(payload?.password || "");
  const passwordHash = hashPassword(password);

  if (!email || !password) return { ok: false, message: "Введите Email и пароль." };

  const localUser = state.users.find((item) => item.email === email);
  if (localUser && localUser.passwordHash === passwordHash) {
    state.auth.currentUserId = localUser.id;
    claimLegacyOrphanDataForUser(localUser.id);
    state.view = "home";
    saveState({ skipCloud: true });
    if (isCloudConfigured()) {
      await pullStateFromCloudForUser(localUser);
    }
    renderApp();
    return { ok: true };
  }

  if (isCloudConfigured()) {
    try {
      const remoteAccount = await cloudGetAccountByEmail(email);
      if (!remoteAccount) return { ok: false, message: "Пользователь не найден." };
      if (remoteAccount.password_hash !== passwordHash) {
        return { ok: false, message: "Неверный пароль." };
      }

      let user = state.users.find((item) => item.email === email);
      if (!user) {
        user = {
          id: createId("user"),
          name: String(remoteAccount.name || email).trim(),
          email,
          passwordHash,
          createdAt: new Date().toISOString()
        };
        state.users.push(user);
      } else {
        user.name = String(remoteAccount.name || user.name || email).trim();
        user.passwordHash = passwordHash;
      }

      state.auth.currentUserId = user.id;
      claimLegacyOrphanDataForUser(user.id);
      state.view = "home";
      saveState({ skipCloud: true });
      await pullStateFromCloudForUser(user);
      renderApp();
      return { ok: true };
    } catch (error) {
      console.error("Cloud login error:", error);
      return { ok: false, message: "Ошибка подключения к облачной базе." };
    }
  }

  if (localUser) return { ok: false, message: "Неверный пароль." };
  return { ok: false, message: "Пользователь не найден на этом устройстве. Проверьте облачную синхронизацию." };
}

function logoutUser() {
  state.auth.currentUserId = null;
  state.view = "home";
  state.editMode = false;
  saveState();
  renderApp();
}

function rebuildStudentPlannedSessions(student, startDateISO = getTodayISO(), options = {}) {
  const forceRegenerateFuture = Boolean(options.forceRegenerateFuture);
  const targetCount = Math.max(0, Number(student.remainingTrainings) || 0);
  const coachIncome = getCoachIncomePerSession(student.activePackage, student.trainingType);
  const allSessions = Array.isArray(student.sessions) ? student.sessions : [];

  const reserved = [];
  const futurePlanned = [];

  allSessions.forEach((session) => {
    if (!session || typeof session !== "object") return;
    if (isFinalPersonalStatus(session.status)) {
      reserved.push(session);
      return;
    }

    const isPast = compareISODate(session.date, startDateISO) < 0;
    if (isPast) {
      reserved.push(session);
      return;
    }

    if (!forceRegenerateFuture && session.status === "запланировано") {
      futurePlanned.push(session);
    }
  });

  sortSessionsByDateTime(futurePlanned);

  const preservedPlanned = [];
  const occupied = new Set(reserved.map((session) => `${session.date}__${session.time}`));

  for (const session of futurePlanned) {
    if (preservedPlanned.length >= targetCount) break;

    const key = `${session.date}__${student.time}`;
    if (occupied.has(key)) continue;

    preservedPlanned.push({
      ...session,
      time: student.time,
      status: "запланировано",
      coachIncome
    });
    occupied.add(key);
  }

  const generated = [];
  let cursor = startDateISO;
  let guard = 0;
  while (preservedPlanned.length + generated.length < targetCount && guard < 3660) {
    const day = parseISODate(cursor).getDay();
    const key = `${cursor}__${student.time}`;
    if (student.scheduleDays.includes(day) && !occupied.has(key)) {
      generated.push({
        id: createId("psession"),
        date: cursor,
        time: student.time,
        status: "запланировано",
        coachIncome
      });
      occupied.add(key);
    }
    cursor = addDaysISO(cursor, 1);
    guard += 1;
  }

  student.sessions = [...reserved, ...preservedPlanned, ...generated];
  sortSessionsByDateTime(student.sessions);
}

function rebuildGroupFutureSessions(group, startDateISO = getTodayISO()) {
  const horizonISO = addDaysISO(startDateISO, 30);
  const preserved = group.sessions.filter((session) => {
    const hasMarks = Object.keys(session.attendance || {}).length > 0;
    return compareISODate(session.date, startDateISO) < 0 || hasMarks;
  });

  const occupied = new Set(preserved.map((session) => `${session.date}__${session.time}`));
  const generated = [];

  let cursor = startDateISO;
  let guard = 0;
  while (compareISODate(cursor, horizonISO) <= 0 && guard < 500) {
    const day = parseISODate(cursor).getDay();
    const key = `${cursor}__${group.time}`;
    if (group.scheduleDays.includes(day) && !occupied.has(key)) {
      generated.push({
        id: createId("gsession"),
        date: cursor,
        time: group.time,
        attendance: {}
      });
      occupied.add(key);
    }
    cursor = addDaysISO(cursor, 1);
    guard += 1;
  }

  group.sessions = [...preserved, ...generated];
  sortSessionsByDateTime(group.sessions);
}

function setSelectedDate(dateISO) {
  state.selectedDate = ensureISODate(dateISO, getTodayISO());
  state.calendarDate = monthStartISO(state.selectedDate);
  state.editMode = false;
  saveState();
  renderApp();
}

function shiftSelectedDate(deltaDays) {
  state.selectedDate = addDaysISO(state.selectedDate, Number(deltaDays) || 0);
  state.calendarDate = monthStartISO(state.selectedDate);
  saveState();
  renderApp();
}

function toggleEditMode() {
  if (state.selectedDate === getTodayISO()) return;
  if (isDateLocked(state.selectedDate)) return;
  state.editMode = !state.editMode;
  saveState();
  renderApp();
}

function isEditingAllowedForSelectedDate() {
  if (isDateLocked(state.selectedDate)) return false;
  if (state.selectedDate === getTodayISO()) return true;
  return Boolean(state.editMode);
}

function setCalendarDate(dateISO) {
  state.calendarDate = ensureISODate(dateISO, monthStartISO(getTodayISO()));
  saveState();
  renderApp();
}

function openDateJournalFromCalendar(dateISO) {
  state.selectedDate = ensureISODate(dateISO, getTodayISO());
  state.calendarDate = monthStartISO(state.selectedDate);
  state.view = "home";
  state.editMode = false;
  saveState();
  renderApp();
}

function isDateLocked(dateISO) {
  const ownerId = getCurrentUserId();
  if (!ownerId) return false;
  return state.salaryClosures.some((closure) => closure.ownerId === ownerId && closure.monthISO === monthOfDate(dateISO));
}

function addStudent(payload) {
  const ownerId = getCurrentUserId();
  if (!ownerId) return;
  const workSchedule = getUserSettings(ownerId).workSchedule;

  const trainingType = normalizeTrainingType(payload.trainingType);
  const primaryName = String(payload.primaryName || "").trim();
  const secondaryName = String(payload.secondaryName || "").trim();
  const miniMemberNames = normalizeMiniGroupNames(payload.memberNames);
  const packageCount = Number(payload.packageCount);
  const scheduleDays = sanitizeWeekDays(payload.scheduleDays);
  const time = sanitizeHourTime(payload.time);

  if ((trainingType === "personal" || trainingType === "split") && !primaryName) {
    alert("Введите имя ученика.");
    return;
  }

  if (trainingType === "split" && !secondaryName) {
    alert("Для сплита нужно указать второго участника.");
    return;
  }

  if (trainingType === "mini_group") {
    if (miniMemberNames.length < MINI_GROUP_MIN_PARTICIPANTS || miniMemberNames.length > MINI_GROUP_MAX_PARTICIPANTS) {
      alert("В мини-группе должно быть от 3 до 5 учеников.");
      return;
    }
  }

  if (!scheduleDays.length) {
    alert("Выберите хотя бы один день недели.");
    return;
  }

  if (!isScheduleWithinWorkDays(scheduleDays, workSchedule)) {
    alert("Выбраны дни вне вашего графика работы.");
    return;
  }

  if (!isTimeWithinWorkHours(time, workSchedule)) {
    alert("Выбрано время вне вашего графика работы.");
    return;
  }

  const activePackage = buildPackage(trainingType, packageCount, miniMemberNames.length);
  if (!activePackage) {
    alert("Выбранный пакет недоступен.");
    return;
  }

  const participants = trainingType === "split"
    ? [primaryName, secondaryName]
    : trainingType === "mini_group"
      ? miniMemberNames
      : [primaryName];
  const cardName = trainingType === "split"
    ? `${primaryName} / ${secondaryName}`
    : trainingType === "mini_group"
      ? (primaryName || `Мини-группа (${participants.length})`)
      : primaryName;
  const student = {
    id: createId("student"),
    ownerId,
    name: cardName,
    trainingType,
    participants,
    scheduleDays,
    time,
    totalTrainings: activePackage.count,
    remainingTrainings: activePackage.count,
    activePackage,
    packagesHistory: [{ ...activePackage }],
    sessions: [],
    createdAt: new Date().toISOString()
  };

  rebuildStudentPlannedSessions(student, getTodayISO());
  state.students.push(student);
  saveState({ dataChanged: true });
  renderApp();
}

function addStudentPackage(studentId, packageCount) {
  const ownerId = getCurrentUserId();
  const student = state.students.find((item) => item.id === studentId && item.ownerId === ownerId);
  if (!student) return;

  const participantsCount = student.trainingType === "mini_group" ? student.participants.length : null;
  const newPackage = buildPackage(student.trainingType, Number(packageCount), participantsCount);
  if (!newPackage) {
    alert("Пакет не найден.");
    return;
  }

  student.activePackage = newPackage;
  student.totalTrainings = newPackage.count;
  student.remainingTrainings = newPackage.count;
  student.packagesHistory = student.packagesHistory || [];
  student.packagesHistory.push({ ...newPackage });
  rebuildStudentPlannedSessions(student, getTodayISO(), { forceRegenerateFuture: true });

  saveState({ dataChanged: true });
  renderApp();
}

function updateStudentSchedule(studentId, scheduleDays) {
  const ownerId = getCurrentUserId();
  const student = state.students.find((item) => item.id === studentId && item.ownerId === ownerId);
  if (!student) return;
  const workSchedule = getUserSettings(ownerId).workSchedule;

  const nextDays = sanitizeWeekDays(scheduleDays);
  if (!nextDays.length) {
    alert("Выберите хотя бы один день недели.");
    return;
  }
  if (!isScheduleWithinWorkDays(nextDays, workSchedule)) {
    alert("Выбраны дни вне вашего графика работы.");
    return;
  }

  if (!isTimeWithinWorkHours(student.time, workSchedule)) {
    alert("Текущее время карточки вне вашего графика работы. Измените время.");
    return;
  }

  student.scheduleDays = nextDays;
  rebuildStudentPlannedSessions(student, getTodayISO(), { forceRegenerateFuture: true });

  saveState({ dataChanged: true });
  renderApp();
}

function updateStudentCardData(studentId, payload) {
  const ownerId = getCurrentUserId();
  const student = state.students.find((item) => item.id === studentId && item.ownerId === ownerId);
  if (!student) return;
  const workSchedule = getUserSettings(ownerId).workSchedule;

  const primaryName = String(payload?.primaryName || "").trim();
  const secondaryName = String(payload?.secondaryName || "").trim();
  const miniMemberNames = normalizeMiniGroupNames(payload?.memberNames);
  const scheduleDays = sanitizeWeekDays(payload?.scheduleDays);
  const time = sanitizeHourTime(payload?.time || student.time);

  if ((student.trainingType === "personal" || student.trainingType === "split") && !primaryName) {
    alert("Введите имя ученика.");
    return;
  }

  if (!scheduleDays.length) {
    alert("Выберите хотя бы один день недели.");
    return;
  }

  if (!isScheduleWithinWorkDays(scheduleDays, workSchedule)) {
    alert("Выбраны дни вне вашего графика работы.");
    return;
  }

  if (!isTimeWithinWorkHours(time, workSchedule)) {
    alert("Выбрано время вне вашего графика работы.");
    return;
  }

  if (student.trainingType === "split" && !secondaryName) {
    alert("Для сплита нужно указать второго участника.");
    return;
  }

  if (student.trainingType === "mini_group") {
    if (miniMemberNames.length < MINI_GROUP_MIN_PARTICIPANTS || miniMemberNames.length > MINI_GROUP_MAX_PARTICIPANTS) {
      alert("В мини-группе должно быть от 3 до 5 учеников.");
      return;
    }
  }

  if (student.trainingType === "split") {
    student.participants = [primaryName, secondaryName];
    student.name = `${primaryName} / ${secondaryName}`;
  } else if (student.trainingType === "mini_group") {
    student.participants = miniMemberNames;
    student.name = primaryName || `Мини-группа (${miniMemberNames.length})`;
    if (student.activePackage) {
      student.activePackage.participantsCount = miniMemberNames.length;
    }
  } else {
    student.participants = [primaryName];
    student.name = primaryName;
  }

  student.time = time;
  student.scheduleDays = scheduleDays;
  rebuildStudentPlannedSessions(student, getTodayISO(), { forceRegenerateFuture: true });

  saveState({ dataChanged: true });
  renderApp();
}

function deleteStudentCard(studentId) {
  const ownerId = getCurrentUserId();
  if (!ownerId) return;

  const beforeCount = state.students.length;
  state.students = state.students.filter((item) => !(item.id === studentId && item.ownerId === ownerId));
  if (state.students.length === beforeCount) return;

  saveState({ dataChanged: true });
  renderApp();
}

function addGroup(payload) {
  const ownerId = getCurrentUserId();
  if (!ownerId) return;
  const workSchedule = getUserSettings(ownerId).workSchedule;

  const name = String(payload.name || "").trim();
  const scheduleDays = sanitizeWeekDays(payload.scheduleDays);
  const time = sanitizeHourTime(payload.time);
  const rawStudents = Array.isArray(payload.students) ? payload.students : [];

  if (!name) {
    alert("Введите название группы.");
    return;
  }

  if (!scheduleDays.length) {
    alert("Выберите хотя бы один день недели.");
    return;
  }

  if (!isScheduleWithinWorkDays(scheduleDays, workSchedule)) {
    alert("Выбраны дни вне вашего графика работы.");
    return;
  }

  if (!isTimeWithinWorkHours(time, workSchedule)) {
    alert("Выбрано время вне вашего графика работы.");
    return;
  }

  const students = rawStudents
    .map((studentName) => String(studentName || "").trim())
    .filter(Boolean)
    .map((studentName) => ({
      id: createId("member"),
      name: studentName
    }));

  if (!students.length) {
    alert("Добавьте учеников в группу.");
    return;
  }

  const group = {
    id: createId("group"),
    ownerId,
    name,
    scheduleDays,
    time,
    students,
    sessions: [],
    createdAt: new Date().toISOString()
  };

  rebuildGroupFutureSessions(group, getTodayISO());
  state.groups.push(group);
  saveState({ dataChanged: true });
  renderApp();
}

function updateGroupCardData(groupId, payload) {
  const ownerId = getCurrentUserId();
  const group = state.groups.find((item) => item.id === groupId && item.ownerId === ownerId);
  if (!group) return;
  const workSchedule = getUserSettings(ownerId).workSchedule;

  const name = String(payload?.name || "").trim();
  const scheduleDays = sanitizeWeekDays(payload?.scheduleDays);
  const time = sanitizeHourTime(payload?.time || group.time);
  const rawStudents = Array.isArray(payload?.students) ? payload.students : [];
  const names = rawStudents.map((value) => String(value || "").trim()).filter(Boolean);

  if (!name) {
    alert("Введите название группы.");
    return;
  }

  if (!scheduleDays.length) {
    alert("Выберите хотя бы один день недели.");
    return;
  }

  if (!isScheduleWithinWorkDays(scheduleDays, workSchedule)) {
    alert("Выбраны дни вне вашего графика работы.");
    return;
  }

  if (!isTimeWithinWorkHours(time, workSchedule)) {
    alert("Выбрано время вне вашего графика работы.");
    return;
  }

  if (!names.length) {
    alert("Добавьте хотя бы одного ученика.");
    return;
  }

  group.name = name;
  group.time = time;
  group.scheduleDays = scheduleDays;
  group.students = syncGroupStudentsByName(group.students, names);

  const allowedIds = new Set(group.students.map((student) => student.id));
  group.sessions.forEach((session) => {
    const current = session.attendance || {};
    const filtered = {};
    Object.entries(current).forEach(([studentId, status]) => {
      if (!allowedIds.has(studentId)) return;
      filtered[studentId] = status;
    });
    session.attendance = filtered;
  });

  rebuildGroupFutureSessions(group, getTodayISO());
  saveState({ dataChanged: true });
  renderApp();
}

function syncGroupStudentsByName(currentStudents, nextNames) {
  const pool = Array.isArray(currentStudents) ? [...currentStudents] : [];
  return nextNames.map((name) => {
    const lower = name.toLowerCase();
    const matchedIndex = pool.findIndex((item) => String(item.name || "").toLowerCase() === lower);
    if (matchedIndex >= 0) {
      const [matched] = pool.splice(matchedIndex, 1);
      return {
        id: matched.id,
        name
      };
    }
    return {
      id: createId("member"),
      name
    };
  });
}

function deleteGroupCard(groupId) {
  const ownerId = getCurrentUserId();
  if (!ownerId) return;

  const beforeCount = state.groups.length;
  state.groups = state.groups.filter((item) => !(item.id === groupId && item.ownerId === ownerId));
  if (state.groups.length === beforeCount) return;

  saveState({ dataChanged: true });
  renderApp();
}

function markPersonalSession(studentId, sessionId, nextStatus) {
  const ownerId = getCurrentUserId();
  if (nextStatus !== "пришел" && nextStatus !== "не пришел") return;

  const student = state.students.find((item) => item.id === studentId && item.ownerId === ownerId);
  if (!student) return;

  const session = student.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  if (session.status !== "запланировано") return;
  if (isDateLocked(session.date)) {
    alert("Месяц этой даты уже закрыт. Редактирование недоступно.");
    return;
  }

  session.status = nextStatus;
  student.remainingTrainings = Math.max(0, Number(student.remainingTrainings || 0) - 1);
  saveState({ dataChanged: true });
  renderApp();
}

function forceSetPersonalStatus(studentId, sessionId, nextStatus) {
  const ownerId = getCurrentUserId();
  if (nextStatus !== "пришел" && nextStatus !== "не пришел") return;

  const student = state.students.find((item) => item.id === studentId && item.ownerId === ownerId);
  if (!student) return;

  const session = student.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  if (isDateLocked(session.date)) {
    alert("Месяц этой даты уже закрыт. Редактирование недоступно.");
    return;
  }

  const wasFinal = isFinalPersonalStatus(session.status);
  const willBeFinal = isFinalPersonalStatus(nextStatus);
  session.status = nextStatus;

  if (!wasFinal && willBeFinal) {
    student.remainingTrainings = Math.max(0, Number(student.remainingTrainings || 0) - 1);
  } else if (wasFinal && !willBeFinal) {
    student.remainingTrainings = Math.min(Number(student.totalTrainings), Number(student.remainingTrainings || 0) + 1);
  }

  saveState({ dataChanged: true });
  renderApp();
}

function reschedulePersonalSession(studentId, sessionId) {
  const ownerId = getCurrentUserId();
  const student = state.students.find((item) => item.id === studentId && item.ownerId === ownerId);
  if (!student) return;

  const session = student.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  if (session.status !== "запланировано") return;
  if (isDateLocked(session.date)) {
    alert("Месяц этой даты уже закрыт. Редактирование недоступно.");
    return;
  }

  const nextDate = getNextAvailableDateForStudent(student, session.date, session.id);
  session.date = nextDate;
  sortSessionsByDateTime(student.sessions);

  saveState({ dataChanged: true });
  renderApp();
}

function getNextAvailableDateForStudent(student, currentDateISO, sessionId) {
  if (!Array.isArray(student.scheduleDays) || !student.scheduleDays.length) {
    return addDaysISO(currentDateISO, 1);
  }

  let cursor = addDaysISO(currentDateISO, 1);
  let guard = 0;

  while (guard < 3660) {
    const jsDay = parseISODate(cursor).getDay();
    const hasConflict = student.sessions.some((item) => item.id !== sessionId && item.date === cursor && item.time === student.time);

    if (student.scheduleDays.includes(jsDay) && !hasConflict) {
      return cursor;
    }

    cursor = addDaysISO(cursor, 1);
    guard += 1;
  }

  return addDaysISO(currentDateISO, 1);
}

function setGroupAttendance(groupId, sessionId, studentId, status) {
  if (status !== "присутствовал" && status !== "отсутствовал") return;

  const ownerId = getCurrentUserId();
  const group = state.groups.find((item) => item.id === groupId && item.ownerId === ownerId);
  if (!group) return;

  const session = group.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const studentExists = group.students.some((student) => student.id === studentId);
  if (!studentExists) return;
  if (isDateLocked(session.date)) {
    alert("Месяц этой даты уже закрыт. Редактирование недоступно.");
    return;
  }

  session.attendance = session.attendance || {};
  session.attendance[studentId] = status;
  saveState({ dataChanged: true });
  renderApp();
}

function setSalaryMonth(monthISO) {
  state.salaryMonth = ensureMonthISO(monthISO, getTodayISO().slice(0, 7));
  saveState();
  renderApp();
}

function closeSalaryMonth(monthISO) {
  const ownerId = getCurrentUserId();
  if (!ownerId) return;

  const targetMonth = ensureMonthISO(monthISO, state.salaryMonth);
  const existing = state.salaryClosures.find((closure) => closure.ownerId === ownerId && closure.monthISO === targetMonth);
  if (existing) return;

  const snapshot = buildSalaryReport(targetMonth);
  state.salaryClosures.push({
    ownerId,
    monthISO: targetMonth,
    closedAt: new Date().toISOString(),
    snapshot
  });

  saveState({ dataChanged: true });
  renderApp();
}

function reopenSalaryMonth(monthISO) {
  const ownerId = getCurrentUserId();
  if (!ownerId) return;

  const targetMonth = ensureMonthISO(monthISO, state.salaryMonth);
  state.salaryClosures = state.salaryClosures.filter((closure) => {
    if (closure.ownerId !== ownerId) return true;
    return closure.monthISO !== targetMonth;
  });
  saveState({ dataChanged: true });
  renderApp();
}

function exportSalaryMonthCSV(monthISO) {
  const report = getSalaryReport(monthISO);
  const miniGroup = report.miniGroup || { sessions: 0, income: 0 };
  const lines = [
    "Период;Персональные занятия;Сплит занятия;Мини-группа занятия;ЗП персональные;ЗП сплит;ЗП мини-группа;Всего занятий;Итоговая ЗП",
    `${report.monthISO};${report.personal.sessions};${report.split.sessions};${miniGroup.sessions};${roundMoney(report.personal.income)};${roundMoney(report.split.income)};${roundMoney(miniGroup.income)};${report.totalSessions};${roundMoney(report.totalIncome)}`,
    "",
    "Карточка;Тип;Посещений;ЗП"
  ];

  report.rows.forEach((row) => {
    const typeLabel = row.type === "split"
      ? "Сплит"
      : row.type === "mini_group"
        ? "Мини-группа"
        : "Персональная";
    lines.push(`${escapeCsv(row.name)};${typeLabel};${row.attended};${roundMoney(row.income)}`);
  });

  downloadFile(
    `attendpro-salary-${report.monthISO}.csv`,
    `\ufeff${lines.join("\n")}`,
    "text/csv;charset=utf-8"
  );
}

function getSessionsForDate(dateISO) {
  const rows = [];
  const students = getStudentsForUser();
  const groups = getGroupsForUser();

  students.forEach((student) => {
    student.sessions.forEach((session) => {
      if (session.date !== dateISO) return;
      rows.push({
        type: "personal",
        studentId: student.id,
        studentName: student.name,
        trainingType: student.trainingType,
        data: session
      });
    });
  });

  groups.forEach((group) => {
    group.sessions.forEach((session) => {
      if (session.date !== dateISO) return;
      rows.push({
        type: "group",
        groupId: group.id,
        groupName: group.name,
        students: group.students,
        data: session
      });
    });
  });

  rows.sort((a, b) => String(a.data.time).localeCompare(String(b.data.time)));
  return rows;
}

function getSessionsByDate(dateISO) {
  return getSessionsForDate(dateISO).map((item) => {
    if (item.type === "personal") {
      const labelPrefix = item.trainingType === "split"
        ? "Сплит: "
        : item.trainingType === "mini_group"
          ? "Мини-группа: "
          : "";
      return {
        type: "personal",
        label: `${labelPrefix}${item.studentName}`,
        status: item.data.status
      };
    }

    const marks = Object.values(item.data.attendance || {});
    const attended = marks.filter((status) => status === "присутствовал").length;
    const missed = marks.filter((status) => status === "отсутствовал").length;
    const statusLabel = attended || missed ? `+${attended}/-${missed}` : "";
    return {
      type: "group",
      label: item.groupName,
      status: statusLabel
    };
  });
}

function buildSalaryReport(monthISO) {
  const month = ensureMonthISO(monthISO, getTodayISO().slice(0, 7));
  const startDateISO = monthStartISO(month);
  const endDateISO = monthEndISO(month);
  const students = getStudentsForUser();

  const rows = [];
  let personalSessions = 0;
  let splitSessions = 0;
  let miniGroupSessions = 0;
  let personalIncome = 0;
  let splitIncome = 0;
  let miniGroupIncome = 0;

  students.forEach((student) => {
    const attendedSessions = student.sessions.filter((session) => {
      return session.status === "пришел" && isDateInMonth(session.date, month);
    });

    if (!attendedSessions.length) return;

    const income = roundMoney(attendedSessions.reduce((sum, session) => sum + Number(session.coachIncome || 0), 0));
    const attended = attendedSessions.length;

    rows.push({
      id: student.id,
      name: student.name,
      type: student.trainingType,
      attended,
      income
    });

    if (student.trainingType === "split") {
      splitSessions += attended;
      splitIncome += income;
    } else if (student.trainingType === "mini_group") {
      miniGroupSessions += attended;
      miniGroupIncome += income;
    } else {
      personalSessions += attended;
      personalIncome += income;
    }
  });

  rows.sort((a, b) => b.income - a.income);

  const totalSessions = personalSessions + splitSessions + miniGroupSessions;
  const totalIncome = roundMoney(personalIncome + splitIncome + miniGroupIncome);

  return {
    monthISO: month,
    startDateISO,
    endDateISO,
    personal: {
      sessions: personalSessions,
      income: roundMoney(personalIncome)
    },
    split: {
      sessions: splitSessions,
      income: roundMoney(splitIncome)
    },
    miniGroup: {
      sessions: miniGroupSessions,
      income: roundMoney(miniGroupIncome)
    },
    totalSessions,
    totalIncome,
    rows
  };
}

function getSalaryReport(monthISO) {
  const month = ensureMonthISO(monthISO, state.salaryMonth);
  const ownerId = getCurrentUserId();
  const closure = state.salaryClosures.find((item) => item.ownerId === ownerId && item.monthISO === month);

  if (closure) {
    return {
      ...closure.snapshot,
      isClosed: true,
      closedAt: closure.closedAt
    };
  }

  return {
    ...buildSalaryReport(month),
    isClosed: false,
    closedAt: null
  };
}

function getStatistics() {
  const cards = [];
  const students = getStudentsForUser();
  const groups = getGroupsForUser();

  let totalVisits = 0;
  let totalMisses = 0;
  let totalPurchasedTrainings = 0;
  let totalRemainingTrainings = 0;
  let totalPackageRenewals = 0;
  let totalIncome = 0;
  let paidSessionCount = 0;

  students.forEach((student) => {
    const visits = student.sessions.filter((session) => session.status === "пришел");
    const misses = student.sessions.filter((session) => session.status === "не пришел");
    const lastMarked = [...visits, ...misses].sort((a, b) => compareISODate(b.date, a.date))[0];

    const purchasedTrainings = (student.packagesHistory || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
    const renewals = Math.max(0, (student.packagesHistory || []).length - 1);
    const income = roundMoney(visits.reduce((sum, session) => sum + Number(session.coachIncome || 0), 0));

    totalVisits += visits.length;
    totalMisses += misses.length;
    totalPurchasedTrainings += purchasedTrainings;
    totalRemainingTrainings += Number(student.remainingTrainings || 0);
    totalPackageRenewals += renewals;
    totalIncome += income;
    paidSessionCount += visits.length;

    cards.push({
      id: student.id,
      type: student.trainingType,
      name: student.name,
      participants: student.participants,
      visits: visits.length,
      misses: misses.length,
      purchasedTrainings,
      remainingTrainings: Number(student.remainingTrainings || 0),
      renewals,
      income,
      lastVisitDate: lastMarked ? lastMarked.date : null
    });
  });

  groups.forEach((group) => {
    let visits = 0;
    let misses = 0;
    let lastDate = null;

    group.sessions.forEach((session) => {
      const marks = Object.values(session.attendance || {});
      if (!marks.length) return;

      const presentCount = marks.filter((status) => status === "присутствовал").length;
      const absentCount = marks.filter((status) => status === "отсутствовал").length;
      visits += presentCount;
      misses += absentCount;

      if (!lastDate || compareISODate(session.date, lastDate) > 0) {
        lastDate = session.date;
      }
    });

    totalVisits += visits;
    totalMisses += misses;

    cards.push({
      id: group.id,
      type: "group",
      name: group.name,
      participants: group.students.map((student) => student.name),
      visits,
      misses,
      purchasedTrainings: 0,
      remainingTrainings: 0,
      renewals: 0,
      income: 0,
      lastVisitDate: lastDate
    });
  });

  const marksTotal = totalVisits + totalMisses;
  const attendancePercent = marksTotal ? roundMoney((totalVisits / marksTotal) * 100) : 0;
  const missesPercent = marksTotal ? roundMoney((totalMisses / marksTotal) * 100) : 0;
  const avgIncomePerSession = paidSessionCount ? roundMoney(totalIncome / paidSessionCount) : 0;

  return {
    totalVisits,
    totalMisses,
    totalPurchasedTrainings,
    totalRemainingTrainings,
    totalPackageRenewals,
    avgIncomePerSession,
    attendancePercent,
    missesPercent,
    totalIncome: roundMoney(totalIncome),
    cards
  };
}

function exportStatisticsCSV() {
  const stats = getStatistics();
  const lines = [
    "Показатель;Значение",
    `Посещаемость %;${stats.attendancePercent}`,
    `Пропуски %;${stats.missesPercent}`,
    `Продления пакетов;${stats.totalPackageRenewals}`,
    `Средний доход за занятие;${stats.avgIncomePerSession}`,
    `Всего посещений;${stats.totalVisits}`,
    `Всего пропусков;${stats.totalMisses}`,
    `Приобретено тренировок;${stats.totalPurchasedTrainings}`,
    `Осталось посещений;${stats.totalRemainingTrainings}`,
    "",
    "Карточка;Тип;Посещений;Пропусков;Приобретено;Осталось;Продлений;Доход;Последняя отметка"
  ];

  stats.cards.forEach((card) => {
    const typeLabel = card.type === "group"
      ? "Групповая"
      : card.type === "split"
        ? "Сплит"
        : card.type === "mini_group"
          ? "Мини-группа"
          : "Персональная";
    lines.push([
      escapeCsv(card.name),
      typeLabel,
      card.visits,
      card.misses,
      card.purchasedTrainings,
      card.remainingTrainings,
      card.renewals || 0,
      roundMoney(card.income || 0),
      card.lastVisitDate || ""
    ].join(";"));
  });

  downloadFile(
    `attendpro-statistics-${getTodayISO()}.csv`,
    `\ufeff${lines.join("\n")}`,
    "text/csv;charset=utf-8"
  );
}

function exportBackupJSON() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    state: {
      ...state,
      users: [currentUser],
      auth: { currentUserId: currentUser.id },
      settingsByUser: {
        [currentUser.id]: getUserSettings(currentUser.id)
      },
      students: getStudentsForUser(currentUser.id),
      groups: getGroupsForUser(currentUser.id),
      salaryClosures: getSalaryClosuresForUser(currentUser.id)
    }
  };

  downloadFile(
    `attendpro-backup-${getTodayISO()}.json`,
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8"
  );
}

function importBackupFromFile(file) {
  if (!file) return;

  file.text()
    .then((text) => {
      const parsed = JSON.parse(text);
      const incomingState = parsed?.state ? parsed.state : parsed;
      const normalizedIncoming = normalizeState(incomingState);
      const ownerId = getCurrentUserId();

      if (!ownerId) {
        state = normalizedIncoming;
      } else {
        state = normalizeState({
          ...state,
          selectedDate: normalizedIncoming.selectedDate ?? state.selectedDate,
          calendarDate: normalizedIncoming.calendarDate ?? state.calendarDate,
          salaryMonth: normalizedIncoming.salaryMonth ?? state.salaryMonth,
          editMode: false,
          students: mergeOwnedRows(state.students, pickOwnedRowsFromImport(normalizedIncoming.students, ownerId), ownerId),
          groups: mergeOwnedRows(state.groups, pickOwnedRowsFromImport(normalizedIncoming.groups, ownerId), ownerId),
          salaryClosures: mergeOwnedRows(
            state.salaryClosures,
            pickOwnedRowsFromImport(normalizedIncoming.salaryClosures, ownerId),
            ownerId
          ),
          settingsByUser: {
            ...state.settingsByUser,
            [ownerId]: normalizeUserSettings(
              normalizedIncoming.settingsByUser?.[ownerId]
                || normalizedIncoming.settings
                || state.settingsByUser?.[ownerId]
                || DEFAULT_USER_SETTINGS
            )
          },
          users: state.users,
          auth: state.auth
        });
      }
      saveState({ dataChanged: true });
      renderApp();
      alert("Бэкап успешно восстановлен.");
    })
    .catch(() => {
      alert("Не удалось загрузить файл бэкапа. Проверьте формат JSON.");
    });
}

function escapeCsv(value) {
  const raw = String(value ?? "");
  if (raw.includes(";") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

function downloadFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

