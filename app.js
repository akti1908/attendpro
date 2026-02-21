import { renderHome } from "./components/Home.js";
import { renderCalendar } from "./components/Calendar.js";
import { renderStudentsManager } from "./components/StudentCard.js";
import { renderGroupsManager } from "./components/GroupCard.js";
import { renderSession } from "./components/Session.js";
import { renderStatistics } from "./components/Statistics.js";
import { renderSalary } from "./components/Salary.js";
import { renderAuth } from "./components/Auth.js";

const STORAGE_KEY = "attendpro_state_v4";
const APP_VERSION = 5;
const ALLOWED_THEMES = ["dark", "light"];
const CLOUD_SYNC_DEBOUNCE_MS = 1200;
const CLOUD_FETCH_TIMEOUT_MS = 15000;
const MOBILE_LAYOUT_MAX_WIDTH = 980;
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

const PERSONAL_PACKAGE_OPTIONS = [
  { count: 1, totalPrice: 1500 },
  { count: 5, totalPrice: 6750 },
  { count: 10, totalPrice: 12000 },
  { count: 25, totalPrice: 27500 }
];

const SPLIT_PACKAGE_OPTIONS = [
  { count: 1, pricePerPerson: 1200 },
  { count: 5, pricePerPerson: 5500 },
  { count: 10, pricePerPerson: 10000 },
  { count: 25, pricePerPerson: 24000 }
];

const packageOptions = {
  personal: PERSONAL_PACKAGE_OPTIONS,
  split: SPLIT_PACKAGE_OPTIONS
};

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
let cloudSyncInFlight = false;
let cloudSyncQueued = false;
let swRefreshTriggered = false;

const root = document.getElementById("app");
bindTopbarMenu();
bindTopNavigation();
bindThemeControl();
bindLogoutButton();
bindSyncLifecycleHandlers();
applyTheme(state.theme);
renderApp();
void bootstrapCloudSync();
registerServiceWorker();

function bindTopNavigation() {
  const navMap = {
    "go-today": "home",
    "go-students": "students",
    "go-groups": "groups",
    "go-calendar": "calendar",
    "go-stats": "stats",
    "go-salary": "salary"
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
  if (!menuToggle) return;

  menuToggle.addEventListener("click", () => {
    const isOpen = document.body.classList.contains("menu-open");
    setTopbarMenuOpen(!isOpen);
  });

  document.addEventListener("click", (event) => {
    if (!isMobileLayout()) return;
    const topbar = document.querySelector(".topbar");
    if (topbar && !topbar.contains(event.target)) {
      setTopbarMenuOpen(false);
    }
  });

  window.addEventListener("resize", () => {
    if (!isMobileLayout()) {
      setTopbarMenuOpen(false);
    }
  });
}

function isMobileLayout() {
  return window.innerWidth <= MOBILE_LAYOUT_MAX_WIDTH;
}

function setTopbarMenuOpen(isOpen) {
  const menuToggle = document.getElementById("menu-toggle");
  document.body.classList.toggle("menu-open", Boolean(isOpen));
  if (menuToggle) {
    menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }
}

function closeTopbarMenu() {
  if (!isMobileLayout()) return;
  setTopbarMenuOpen(false);
}

function bindSyncLifecycleHandlers() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void pushStateToCloud();
    }
  });

  window.addEventListener("online", () => {
    void bootstrapCloudSync();
  });
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

function bindThemeControl() {
  const button = document.getElementById("theme-toggle");
  if (!button) return;

  syncThemeToggleButton(button, normalizeTheme(state.theme));
  button.addEventListener("click", () => {
    const currentTheme = normalizeTheme(state.theme);
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    button.classList.remove("is-animating");
    void button.offsetWidth;
    button.classList.add("is-animating");
    setTheme(nextTheme);
  });
}

function bindLogoutButton() {
  const logoutButton = document.getElementById("logout-btn");
  if (!logoutButton) return;

  logoutButton.addEventListener("click", () => {
    closeTopbarMenu();
    logoutUser();
  });
}

function refreshTopbarAuthState() {
  const isLoggedIn = isAuthenticated();
  const logoutButton = document.getElementById("logout-btn");

  document.body.classList.toggle("is-auth-required", !isLoggedIn);

  if (logoutButton) {
    logoutButton.classList.toggle("is-hidden", !isLoggedIn);
  }

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
}

function applyTheme(themeName) {
  const normalizedTheme = normalizeTheme(themeName);
  document.body.setAttribute("data-theme", normalizedTheme);
  const button = document.getElementById("theme-toggle");
  if (button) {
    syncThemeToggleButton(button, normalizedTheme);
  }
}

function normalizeTheme(themeName) {
  const value = String(themeName || "").toLowerCase();
  if (ALLOWED_THEMES.includes(value)) return value;
  return "dark";
}

function syncThemeToggleButton(button, themeName) {
  const isDark = themeName === "dark";
  button.setAttribute("aria-pressed", isDark ? "true" : "false");
  button.setAttribute("title", isDark ? "Переключить на светлую тему" : "Переключить на темную тему");
  const icon = button.querySelector(".theme-toggle-icon");
  if (icon) icon.textContent = isDark ? "☾" : "☀";
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
    users: state.users,
    auth: state.auth
  });

  state = next;
  return true;
}

function scheduleCloudSync() {
  if (!isAuthenticated() || !isCloudConfigured()) return;

  cloudSyncQueued = true;
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    void pushStateToCloud();
  }, CLOUD_SYNC_DEBOUNCE_MS);
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
    return false;
  } finally {
    cloudSyncInFlight = false;
    if (cloudSyncQueued) scheduleCloudSync();
  }
}

async function pullStateFromCloudForUser(user) {
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

    // Если есть локальные несинхронизированные изменения, не перетираем их облаком.
    if (sync.pendingDataSync && (localHasData || !remoteHasData)) {
      await pushStateToCloud();
      return false;
    }

    if (remoteUpdatedAt && sync.lastDataChangeAt && localHasData) {
      if (toEpochMs(remoteUpdatedAt) <= toEpochMs(sync.lastDataChangeAt)) {
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

  const sync = getSyncStateForUser(currentUser.id);
  if (sync.pendingDataSync) {
    const pushed = await pushStateToCloud();
    if (!pushed) return;
  }

  await pullStateFromCloudForUser(currentUser);
}

function renderApp() {
  if (!root) return;
  applyTheme(state.theme);
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
    salary: "go-salary"
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
  return {
    state: scopedState,
    currentUser: getCurrentUser(),
    weekDays,
    packageOptions,
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

function getMigrationFallbackOwnerId(users) {
  if (!Array.isArray(users) || !users.length) return null;
  return users[0]?.id || null;
}

function isAllowedView(value) {
  return ["home", "students", "groups", "calendar", "stats", "salary"].includes(value);
}

function normalizeOwnerId(ownerId, fallbackOwnerId = null) {
  const value = String(ownerId || fallbackOwnerId || "").trim();
  return value || null;
}

function normalizeStudent(rawStudent, fallbackOwnerId = null) {
  const trainingType = rawStudent.trainingType === "split" ? "split" : "personal";
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
    return [cleaned[0] || String(normalizeLegacyText(rawStudent.name || "Ученик")).trim()];
  }

  const studentName = String(normalizeLegacyText(rawStudent.name || "Ученик")).trim();
  if (trainingType === "split") {
    const [first, second] = studentName.split("/").map((item) => item.trim()).filter(Boolean);
    return [first || "Участник 1", second || "Участник 2"];
  }
  return [studentName];
}

function normalizePackageCount(value) {
  const count = Number(value);
  if (Number.isFinite(count) && count > 0) return count;
  return 10;
}

function normalizeActivePackage(rawPackage, trainingType, countFallback) {
  const packageFromOption = getPackageByCount(trainingType, countFallback) || getPackageByCount(trainingType, 10);
  const purchasedAt = rawPackage?.purchasedAt || new Date().toISOString();

  if (trainingType === "split") {
    return {
      count: Number(rawPackage?.count || packageFromOption.count),
      pricePerPerson: Number(rawPackage?.pricePerPerson || packageFromOption.pricePerPerson),
      purchasedAt
    };
  }

  return {
    count: Number(rawPackage?.count || packageFromOption.count),
    totalPrice: Number(rawPackage?.totalPrice || packageFromOption.totalPrice),
    purchasedAt
  };
}

function normalizePackagesHistory(history, activePackage, trainingType) {
  const rows = Array.isArray(history) ? history : [];

  const normalized = rows
    .map((item) => {
      if (trainingType === "split") {
        return {
          count: Number(item.count || activePackage.count),
          pricePerPerson: Number(item.pricePerPerson || activePackage.pricePerPerson),
          purchasedAt: item.purchasedAt || new Date().toISOString()
        };
      }
      return {
        count: Number(item.count || activePackage.count),
        totalPrice: Number(item.totalPrice || activePackage.totalPrice),
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

function getPackageByCount(type, count) {
  const list = packageOptions[type] || [];
  const numericCount = Number(count);
  return list.find((item) => Number(item.count) === numericCount) || null;
}

function buildPackage(type, count) {
  const option = getPackageByCount(type, count);
  if (!option) return null;

  if (type === "split") {
    return {
      count: option.count,
      pricePerPerson: option.pricePerPerson,
      purchasedAt: new Date().toISOString()
    };
  }

  return {
    count: option.count,
    totalPrice: option.totalPrice,
    purchasedAt: new Date().toISOString()
  };
}

function getCoachIncomePerSession(activePackage, trainingType) {
  if (!activePackage) return 0;

  const count = Number(activePackage.count) || 1;
  if (trainingType === "split") {
    const perPerson = Number(activePackage.pricePerPerson || 0);
    const totalPerSession = (perPerson * 2) / count;
    return roundMoney(totalPerSession * 0.5);
  }

  const totalPrice = Number(activePackage.totalPrice || 0);
  return roundMoney((totalPrice / count) * 0.5);
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getTodayISO() {
  return toISODate(new Date());
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
    syncMeta: {
      dataUpdatedAt: nowISO
    }
  };
}

function claimLegacyOrphanDataForUser(userId) {
  if (!userId) return;

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

function rebuildStudentPlannedSessions(student, startDateISO = getTodayISO()) {
  const reserved = student.sessions.filter((session) => {
    if (isFinalPersonalStatus(session.status)) return true;
    return compareISODate(session.date, startDateISO) < 0;
  });

  const occupied = new Set(reserved.map((session) => `${session.date}__${session.time}`));
  const generated = [];
  const targetCount = Number(student.remainingTrainings) || 0;
  const coachIncome = getCoachIncomePerSession(student.activePackage, student.trainingType);

  let cursor = startDateISO;
  let guard = 0;
  while (generated.length < targetCount && guard < 3660) {
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

  student.sessions = [...reserved, ...generated];
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

  const trainingType = payload.trainingType === "split" ? "split" : "personal";
  const primaryName = String(payload.primaryName || "").trim();
  const secondaryName = String(payload.secondaryName || "").trim();
  const packageCount = Number(payload.packageCount);
  const scheduleDays = sanitizeWeekDays(payload.scheduleDays);
  const time = sanitizeHourTime(payload.time);

  if (!primaryName) {
    alert("Введите имя ученика.");
    return;
  }

  if (trainingType === "split" && !secondaryName) {
    alert("Для сплита нужно указать второго участника.");
    return;
  }

  if (!scheduleDays.length) {
    alert("Выберите хотя бы один день недели.");
    return;
  }

  const activePackage = buildPackage(trainingType, packageCount);
  if (!activePackage) {
    alert("Выбранный пакет недоступен.");
    return;
  }

  const participants = trainingType === "split" ? [primaryName, secondaryName] : [primaryName];
  const student = {
    id: createId("student"),
    ownerId,
    name: trainingType === "split" ? `${primaryName} / ${secondaryName}` : primaryName,
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

  const newPackage = buildPackage(student.trainingType, Number(packageCount));
  if (!newPackage) {
    alert("Пакет не найден.");
    return;
  }

  student.activePackage = newPackage;
  student.totalTrainings = newPackage.count;
  student.remainingTrainings = newPackage.count;
  student.packagesHistory = student.packagesHistory || [];
  student.packagesHistory.push({ ...newPackage });
  rebuildStudentPlannedSessions(student, getTodayISO());

  saveState({ dataChanged: true });
  renderApp();
}

function updateStudentSchedule(studentId, scheduleDays) {
  const ownerId = getCurrentUserId();
  const student = state.students.find((item) => item.id === studentId && item.ownerId === ownerId);
  if (!student) return;

  const nextDays = sanitizeWeekDays(scheduleDays);
  if (!nextDays.length) {
    alert("Выберите хотя бы один день недели.");
    return;
  }
  student.scheduleDays = nextDays;
  rebuildStudentPlannedSessions(student, getTodayISO());

  saveState({ dataChanged: true });
  renderApp();
}

function updateStudentCardData(studentId, payload) {
  const ownerId = getCurrentUserId();
  const student = state.students.find((item) => item.id === studentId && item.ownerId === ownerId);
  if (!student) return;

  const primaryName = String(payload?.primaryName || "").trim();
  const secondaryName = String(payload?.secondaryName || "").trim();
  const scheduleDays = sanitizeWeekDays(payload?.scheduleDays);
  const time = sanitizeHourTime(payload?.time || student.time);

  if (!primaryName) {
    alert("Введите имя ученика.");
    return;
  }

  if (!scheduleDays.length) {
    alert("Выберите хотя бы один день недели.");
    return;
  }

  if (student.trainingType === "split" && !secondaryName) {
    alert("Для сплита нужно указать второго участника.");
    return;
  }

  if (student.trainingType === "split") {
    student.participants = [primaryName, secondaryName];
    student.name = `${primaryName} / ${secondaryName}`;
  } else {
    student.participants = [primaryName];
    student.name = primaryName;
  }

  student.time = time;
  student.scheduleDays = scheduleDays;
  rebuildStudentPlannedSessions(student, getTodayISO());

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
  const lines = [
    "Период;Персональные занятия;Сплит занятия;ЗП персональные;ЗП сплит;Всего занятий;Итоговая ЗП",
    `${report.monthISO};${report.personal.sessions};${report.split.sessions};${roundMoney(report.personal.income)};${roundMoney(report.split.income)};${report.totalSessions};${roundMoney(report.totalIncome)}`,
    "",
    "Карточка;Тип;Посещений;ЗП"
  ];

  report.rows.forEach((row) => {
    const typeLabel = row.type === "split" ? "Сплит" : "Персональная";
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
      return {
        type: "personal",
        label: item.trainingType === "split" ? `Сплит: ${item.studentName}` : item.studentName,
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
  let personalIncome = 0;
  let splitIncome = 0;

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
    } else {
      personalSessions += attended;
      personalIncome += income;
    }
  });

  rows.sort((a, b) => b.income - a.income);

  const totalSessions = personalSessions + splitSessions;
  const totalIncome = roundMoney(personalIncome + splitIncome);

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
    const typeLabel = card.type === "group" ? "Групповая" : card.type === "split" ? "Сплит" : "Персональная";
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

