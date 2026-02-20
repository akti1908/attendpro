import { renderHome } from "./components/Home.js";
import { renderCalendar } from "./components/Calendar.js";
import { renderStudentsManager } from "./components/StudentCard.js";
import { renderGroupsManager } from "./components/GroupCard.js";
import { renderSession } from "./components/Session.js";
import { renderStatistics } from "./components/Statistics.js";
import { renderSalary } from "./components/Salary.js";

const STORAGE_KEY = "attendpro_state_v4";
const APP_VERSION = 4;
const ALLOWED_THEMES = ["dark", "light", "ocean", "sunset"];

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

const root = document.getElementById("app");
bindTopNavigation();
bindThemeControl();
applyTheme(state.theme);
renderApp();

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
      if (state.view === view) return;
      state.view = view;
      if (view !== "home") state.editMode = false;
      saveState();
      renderApp();
    });
  });
}

function bindThemeControl() {
  const select = document.getElementById("theme-select");
  if (!select) return;

  select.value = normalizeTheme(state.theme);
  select.addEventListener("change", (event) => {
    setTheme(event.currentTarget.value);
  });
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

  const select = document.getElementById("theme-select");
  if (select && select.value !== normalizedTheme) {
    select.value = normalizedTheme;
  }
}

function normalizeTheme(themeName) {
  const value = String(themeName || "").toLowerCase();
  if (ALLOWED_THEMES.includes(value)) return value;
  return "dark";
}

function renderApp() {
  if (!root) return;
  applyTheme(state.theme);

  const ctx = buildContext();

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

  const activeButton = document.getElementById(viewToButtonId[state.view] || "go-today");
  if (activeButton) activeButton.classList.add("btn-active");
}

function buildContext() {
  return {
    state,
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
      addGroup,
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
      setTheme
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

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  next.editMode = Boolean(next.editMode);
  next.students = Array.isArray(next.students) ? next.students.map(normalizeStudent) : [];
  next.groups = Array.isArray(next.groups) ? next.groups.map(normalizeGroup) : [];
  next.salaryClosures = Array.isArray(next.salaryClosures)
    ? next.salaryClosures
      .map(normalizeSalaryClosure)
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

function isAllowedView(value) {
  return ["home", "students", "groups", "calendar", "stats", "salary"].includes(value);
}

function normalizeStudent(rawStudent) {
  const trainingType = rawStudent.trainingType === "split" ? "split" : "personal";
  const participants = normalizeParticipants(rawStudent, trainingType);
  const packageCount = normalizePackageCount(rawStudent.totalTrainings);
  const activePackage = normalizeActivePackage(rawStudent.activePackage, trainingType, packageCount);

  const student = {
    id: String(rawStudent.id || createId("student")),
    name: String(rawStudent.name || participants.join(" / ")).trim(),
    trainingType,
    participants,
    scheduleDays: sanitizeWeekDays(rawStudent.scheduleDays),
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

function normalizeGroup(rawGroup) {
  return {
    id: String(rawGroup.id || createId("group")),
    name: String(rawGroup.name || "Группа").trim(),
    scheduleDays: sanitizeWeekDays(rawGroup.scheduleDays),
    time: sanitizeHourTime(rawGroup.time),
    students: Array.isArray(rawGroup.students)
      ? rawGroup.students.map((item) => ({
        id: String(item.id || createId("member")),
        name: String(item.name || "").trim()
      })).filter((item) => item.name)
      : [],
    sessions: Array.isArray(rawGroup.sessions) ? rawGroup.sessions.map(normalizeGroupSession) : [],
    createdAt: rawGroup.createdAt || new Date().toISOString()
  };
}

function normalizeSalaryClosure(rawClosure) {
  if (!rawClosure || !rawClosure.monthISO || !rawClosure.snapshot) return null;
  return {
    monthISO: ensureMonthISO(rawClosure.monthISO, getTodayISO().slice(0, 7)),
    closedAt: rawClosure.closedAt || new Date().toISOString(),
    snapshot: rawClosure.snapshot
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
    if (status === "присутствовал" || status === "отсутствовал") {
      map[String(studentId)] = status;
    }
  });
  return map;
}

function normalizePersonalStatus(status) {
  if (status === "пришел" || status === "не пришел" || status === "запланировано") {
    return status;
  }
  return "запланировано";
}

function normalizeParticipants(rawStudent, trainingType) {
  if (Array.isArray(rawStudent.participants) && rawStudent.participants.length) {
    const cleaned = rawStudent.participants.map((item) => String(item || "").trim()).filter(Boolean);
    if (trainingType === "split") return cleaned.slice(0, 2);
    return [cleaned[0] || String(rawStudent.name || "Ученик").trim()];
  }

  const studentName = String(rawStudent.name || "Ученик").trim();
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

function sanitizeWeekDays(days) {
  if (!Array.isArray(days)) return [1, 3, 5];

  const valid = new Set(days.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0 && item <= 6));
  const order = weekDays.map((day) => day.jsDay);
  const result = order.filter((day) => valid.has(day));
  return result.length ? result : [1, 3, 5];
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
  return state.salaryClosures.some((closure) => closure.monthISO === monthOfDate(dateISO));
}

function addStudent(payload) {
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

  const activePackage = buildPackage(trainingType, packageCount);
  if (!activePackage) {
    alert("Выбранный пакет недоступен.");
    return;
  }

  const participants = trainingType === "split" ? [primaryName, secondaryName] : [primaryName];
  const student = {
    id: createId("student"),
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
  saveState();
  renderApp();
}

function addStudentPackage(studentId, packageCount) {
  const student = state.students.find((item) => item.id === studentId);
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

  saveState();
  renderApp();
}

function updateStudentSchedule(studentId, scheduleDays) {
  const student = state.students.find((item) => item.id === studentId);
  if (!student) return;

  student.scheduleDays = sanitizeWeekDays(scheduleDays);
  rebuildStudentPlannedSessions(student, getTodayISO());

  saveState();
  renderApp();
}

function addGroup(payload) {
  const name = String(payload.name || "").trim();
  const scheduleDays = sanitizeWeekDays(payload.scheduleDays);
  const time = sanitizeHourTime(payload.time);
  const rawStudents = Array.isArray(payload.students) ? payload.students : [];

  if (!name) {
    alert("Введите название группы.");
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
    name,
    scheduleDays,
    time,
    students,
    sessions: [],
    createdAt: new Date().toISOString()
  };

  rebuildGroupFutureSessions(group, getTodayISO());
  state.groups.push(group);
  saveState();
  renderApp();
}

function markPersonalSession(studentId, sessionId, nextStatus) {
  if (nextStatus !== "пришел" && nextStatus !== "не пришел") return;

  const student = state.students.find((item) => item.id === studentId);
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
  saveState();
  renderApp();
}

function forceSetPersonalStatus(studentId, sessionId, nextStatus) {
  if (nextStatus !== "пришел" && nextStatus !== "не пришел") return;

  const student = state.students.find((item) => item.id === studentId);
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

  saveState();
  renderApp();
}

function reschedulePersonalSession(studentId, sessionId) {
  const student = state.students.find((item) => item.id === studentId);
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

  saveState();
  renderApp();
}

function getNextAvailableDateForStudent(student, currentDateISO, sessionId) {
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

  const group = state.groups.find((item) => item.id === groupId);
  if (!group) return;

  const session = group.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  if (isDateLocked(session.date)) {
    alert("Месяц этой даты уже закрыт. Редактирование недоступно.");
    return;
  }

  session.attendance = session.attendance || {};
  session.attendance[studentId] = status;
  saveState();
  renderApp();
}

function setSalaryMonth(monthISO) {
  state.salaryMonth = ensureMonthISO(monthISO, getTodayISO().slice(0, 7));
  saveState();
  renderApp();
}

function closeSalaryMonth(monthISO) {
  const targetMonth = ensureMonthISO(monthISO, state.salaryMonth);
  const existing = state.salaryClosures.find((closure) => closure.monthISO === targetMonth);
  if (existing) return;

  const snapshot = buildSalaryReport(targetMonth);
  state.salaryClosures.push({
    monthISO: targetMonth,
    closedAt: new Date().toISOString(),
    snapshot
  });

  saveState();
  renderApp();
}

function reopenSalaryMonth(monthISO) {
  const targetMonth = ensureMonthISO(monthISO, state.salaryMonth);
  state.salaryClosures = state.salaryClosures.filter((closure) => closure.monthISO !== targetMonth);
  saveState();
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

  state.students.forEach((student) => {
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

  state.groups.forEach((group) => {
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

  const rows = [];
  let personalSessions = 0;
  let splitSessions = 0;
  let personalIncome = 0;
  let splitIncome = 0;

  state.students.forEach((student) => {
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
  const closure = state.salaryClosures.find((item) => item.monthISO === month);

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

  let totalVisits = 0;
  let totalMisses = 0;
  let totalPurchasedTrainings = 0;
  let totalRemainingTrainings = 0;
  let totalPackageRenewals = 0;
  let totalIncome = 0;
  let paidSessionCount = 0;

  state.students.forEach((student) => {
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

  state.groups.forEach((group) => {
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
  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    state
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
      state = normalizeState(incomingState);
      saveState();
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
