const express = require("express");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const dotenvPath = path.join(__dirname, ".env");
if (fs.existsSync(dotenvPath)) {
  // Optional local-only env file, not committed to git.
  // eslint-disable-next-line global-require
  require("dotenv").config({ path: dotenvPath, override: true });
}

const app = express();
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8080);
const rootDir = __dirname;

const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID = String(process.env.TELEGRAM_CHAT_ID || "").trim();
const TELEGRAM_MESSAGE_THREAD_ID = String(process.env.TELEGRAM_MESSAGE_THREAD_ID || "").trim();

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SUPABASE_TABLE = String(process.env.SUPABASE_TABLE || "attendpro_accounts").trim();
const SUPABASE_REPORT_RUNS_TABLE = String(process.env.SUPABASE_REPORT_RUNS_TABLE || "attendpro_report_runs").trim();

const AUTO_REPORT_SCHEDULER_ENABLED = String(process.env.AUTO_REPORT_SCHEDULER_ENABLED || "true").trim().toLowerCase() !== "false";
const AUTO_REPORT_POLL_MS = clampInt(process.env.AUTO_REPORT_POLL_MS, 60000, 5000, 3600000);
const REPORTS_TIMEZONE = normalizeTimeZone(String(process.env.REPORTS_TIMEZONE || "Asia/Bishkek").trim());
const AUTO_REPORT_RUN_TOKEN = String(process.env.AUTO_REPORT_RUN_TOKEN || "").trim();

const TELEGRAM_REPORT_MAX_LENGTH = 3900;
const IDEMPOTENCY_TTL_MS = 1000 * 60 * 60 * 36;

const idempotencyFallback = new Map();
const schedulerState = {
  enabled: AUTO_REPORT_SCHEDULER_ENABLED,
  configured: false,
  inFlight: false,
  lastRunAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  lastStats: null
};

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://api.telegram.org https://*.supabase.co"
  );
  next();
});

app.use(express.json({ limit: "256kb" }));

app.get("/api/health", (_req, res) => {
  return res.json({
    ok: true,
    time: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    scheduler: {
      ...schedulerState,
      timezone: REPORTS_TIMEZONE,
      pollMs: AUTO_REPORT_POLL_MS
    },
    integrations: {
      telegramConfigured: hasTelegramConfig(),
      supabaseConfigured: hasSupabaseAdminConfig(),
      supabaseTable: SUPABASE_TABLE,
      idempotencyTable: SUPABASE_REPORT_RUNS_TABLE
    }
  });
});

app.post("/api/internal/auto-report/run", async (req, res) => {
  if (AUTO_REPORT_RUN_TOKEN) {
    const token = String(req.headers["x-run-token"] || "").trim();
    if (!token || token !== AUTO_REPORT_RUN_TOKEN) {
      return res.status(403).json({
        ok: false,
        message: "Forbidden."
      });
    }
  }

  const result = await runAutoReportScheduler({ trigger: "manual-api" });
  return res.status(result.ok ? 200 : 500).json(result);
});

app.post("/api/telegram/send-report", async (req, res) => {
  if (!hasTelegramConfig()) {
    return res.status(400).json({
      ok: false,
      message: "Telegram не настроен на сервере: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID."
    });
  }

  const text = String(req.body?.text || "").trim();
  if (!text) {
    return res.status(400).json({
      ok: false,
      message: "Пустой отчет не может быть отправлен."
    });
  }

  const dateISO = String(req.body?.dateISO || "").trim();
  const userEmail = String(req.body?.userEmail || "").trim().toLowerCase();
  const rawIdempotencyKey = String(req.body?.idempotencyKey || req.headers["x-idempotency-key"] || "").trim();

  try {
    const result = await dispatchTelegramReport({
      text,
      dateISO,
      userEmail,
      source: "manual",
      idempotencyKey: rawIdempotencyKey
    });

    return res.json({
      ok: true,
      message: result.duplicate
        ? "Дубликат подавлен: отчет уже отправлялся."
        : "Отчет отправлен в Telegram.",
      duplicate: Boolean(result.duplicate)
    });
  } catch (error) {
    console.error("Telegram send-report error:", error);
    return res.status(502).json({
      ok: false,
      message: error?.message || "Не удалось связаться с Telegram API."
    });
  }
});

app.use(express.static(rootDir, { extensions: ["html"] }));

app.get("*", (_req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

app.listen(port, host, () => {
  console.log(`AttendPro local server started: http://${host}:${port}`);
  console.log(`Auto-report scheduler: ${AUTO_REPORT_SCHEDULER_ENABLED ? "enabled" : "disabled"} (timezone: ${REPORTS_TIMEZONE})`);
  startAutoReportScheduler();
});

function startAutoReportScheduler() {
  schedulerState.configured = AUTO_REPORT_SCHEDULER_ENABLED && hasTelegramConfig() && hasSupabaseAdminConfig();
  if (!AUTO_REPORT_SCHEDULER_ENABLED) return;

  void runAutoReportScheduler({ trigger: "startup" });
  setInterval(() => {
    void runAutoReportScheduler({ trigger: "interval" });
  }, AUTO_REPORT_POLL_MS);
}

async function runAutoReportScheduler(context = {}) {
  const trigger = String(context.trigger || "unknown");
  schedulerState.lastRunAt = new Date().toISOString();
  schedulerState.configured = AUTO_REPORT_SCHEDULER_ENABLED && hasTelegramConfig() && hasSupabaseAdminConfig();

  if (!AUTO_REPORT_SCHEDULER_ENABLED) {
    return { ok: true, message: "Scheduler disabled.", skipped: true };
  }
  if (!hasSupabaseAdminConfig()) {
    return { ok: false, message: "Supabase service role is not configured." };
  }
  if (!hasTelegramConfig()) {
    return { ok: false, message: "Telegram token/chat is not configured." };
  }
  if (schedulerState.inFlight) {
    return { ok: true, message: "Scheduler run already in progress.", skipped: true };
  }

  schedulerState.inFlight = true;
  try {
    const now = getNowInTimezone(REPORTS_TIMEZONE);
    const accounts = await listCloudAccounts();
    let due = 0;
    let sent = 0;
    let failed = 0;
    let duplicate = 0;

    for (const account of accounts) {
      const appState = normalizeObject(account?.app_state);
      const autoReport = normalizeAutoReportSettings(appState?.settings?.autoReport);
      if (!isAutoReportDue(autoReport, now)) continue;

      const slotKey = `${now.dateISO}__${String(autoReport.hour).padStart(2, "0")}`;
      if (autoReport.lastSentSlotKey === slotKey) continue;

      due += 1;
      const text = buildAttendanceReportText({
        appState,
        dateISO: now.dateISO,
        userEmail: String(account?.email || "")
      });

      try {
        const result = await dispatchTelegramReport({
          text,
          dateISO: now.dateISO,
          userEmail: String(account?.email || "").toLowerCase(),
          source: "auto",
          slotKey,
          idempotencyKey: `attendpro:auto:${String(account?.id || account?.email || "unknown")}:${slotKey}`
        });

        if (result.duplicate) {
          duplicate += 1;
        } else {
          sent += 1;
        }
      } catch (error) {
        failed += 1;
        console.error(`Auto-report failed for ${account?.email || "unknown"}:`, error?.message || error);
      }
    }

    const stats = {
      trigger,
      checkedAccounts: accounts.length,
      due,
      sent,
      duplicate,
      failed,
      ranAt: new Date().toISOString()
    };

    schedulerState.lastStats = stats;
    schedulerState.lastSuccessAt = stats.ranAt;
    schedulerState.lastError = null;
    return { ok: true, ...stats };
  } catch (error) {
    schedulerState.lastErrorAt = new Date().toISOString();
    schedulerState.lastError = error?.message || String(error);
    return { ok: false, message: schedulerState.lastError };
  } finally {
    schedulerState.inFlight = false;
  }
}

async function dispatchTelegramReport(payload) {
  const text = String(payload?.text || "").trim();
  if (!text) {
    throw new Error("Empty report text.");
  }

  const source = String(payload?.source || "manual").trim().toLowerCase();
  const dateISO = String(payload?.dateISO || "").trim();
  const slotKey = normalizeSlotKey(payload?.slotKey);
  const userEmail = String(payload?.userEmail || "").trim().toLowerCase();
  const providedKey = String(payload?.idempotencyKey || "").trim();
  const idempotencyKey = providedKey || (source === "auto"
    ? buildDeterministicIdempotencyKey({ source, dateISO, userEmail, text, slotKey })
    : "");

  const reserve = await reserveIdempotencyKey({
    idempotencyKey,
    source,
    slotKey,
    dateISO,
    userEmail
  });
  if (!reserve.reserved) {
    return { ok: true, duplicate: true };
  }

  try {
    const response = await sendTelegramMessage(text);
    await markIdempotencyStatus(idempotencyKey, {
      status: "sent",
      sent_at: new Date().toISOString(),
      telegram_message_id: response?.result?.message_id || null,
      last_error: null
    });
    return { ok: true, duplicate: false };
  } catch (error) {
    await markIdempotencyStatus(idempotencyKey, {
      status: "failed",
      last_error: String(error?.message || error || "Unknown telegram error"),
      sent_at: null
    });
    throw error;
  }
}

async function sendTelegramMessage(text) {
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: limitTelegramText(text),
    disable_web_page_preview: true,
    allow_sending_without_reply: true
  };

  const messageThreadId = Number(TELEGRAM_MESSAGE_THREAD_ID);
  if (Number.isInteger(messageThreadId) && messageThreadId > 0) {
    payload.message_thread_id = messageThreadId;
  }

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();
  let parsed = null;
  try {
    parsed = responseText ? JSON.parse(responseText) : null;
  } catch (_error) {
    parsed = null;
  }

  if (!response.ok || !parsed?.ok) {
    const detail = parsed?.description || `HTTP ${response.status}`;
    throw new Error(`Ошибка Telegram API: ${detail}`);
  }

  return parsed;
}

function buildDeterministicIdempotencyKey(payload) {
  const source = String(payload?.source || "manual");
  const dateISO = String(payload?.dateISO || "");
  const slotKey = String(payload?.slotKey || "");
  const userEmail = String(payload?.userEmail || "");
  const text = String(payload?.text || "");
  const digest = crypto
    .createHash("sha256")
    .update(`${source}|${dateISO}|${slotKey}|${userEmail}|${text}`)
    .digest("hex");
  return `attendpro:${source}:${digest.slice(0, 40)}`;
}

async function reserveIdempotencyKey(payload) {
  const idempotencyKey = String(payload?.idempotencyKey || "").trim();
  if (!idempotencyKey) return { reserved: true, transport: "none" };

  if (hasSupabaseAdminConfig()) {
    try {
      const rows = await supabaseFetch(
        `/rest/v1/${SUPABASE_REPORT_RUNS_TABLE}?on_conflict=dedupe_key`,
        {
          method: "POST",
          headers: {
            Prefer: "resolution=ignore-duplicates,return=representation"
          },
          body: JSON.stringify({
            dedupe_key: idempotencyKey,
            source: String(payload?.source || "manual"),
            slot_key: normalizeSlotKey(payload?.slotKey) || null,
            report_date: normalizeISODate(payload?.dateISO) || null,
            account_email: String(payload?.userEmail || "").toLowerCase() || null,
            status: "pending",
            created_at: new Date().toISOString()
          })
        }
      );

      if (Array.isArray(rows) && rows.length > 0) {
        return { reserved: true, transport: "supabase" };
      }
      return { reserved: false, transport: "supabase" };
    } catch (error) {
      console.error("Idempotency reserve via Supabase failed, fallback to memory:", error?.message || error);
    }
  }

  const nowMs = Date.now();
  clearExpiredFallbackKeys(nowMs);
  if (idempotencyFallback.has(idempotencyKey)) {
    return { reserved: false, transport: "memory" };
  }
  idempotencyFallback.set(idempotencyKey, nowMs);
  return { reserved: true, transport: "memory" };
}

async function markIdempotencyStatus(idempotencyKey, patch) {
  if (!idempotencyKey || !hasSupabaseAdminConfig()) return;
  try {
    const encodedKey = encodeURIComponent(idempotencyKey);
    await supabaseFetch(`/rest/v1/${SUPABASE_REPORT_RUNS_TABLE}?dedupe_key=eq.${encodedKey}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        ...patch,
        updated_at: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error("Idempotency status update failed:", error?.message || error);
  }
}

function clearExpiredFallbackKeys(nowMs = Date.now()) {
  for (const [key, createdAtMs] of idempotencyFallback.entries()) {
    if (nowMs - Number(createdAtMs || 0) > IDEMPOTENCY_TTL_MS) {
      idempotencyFallback.delete(key);
    }
  }
}

async function listCloudAccounts() {
  const rows = await supabaseFetch(
    `/rest/v1/${SUPABASE_TABLE}?select=id,email,name,app_state,updated_at&limit=1000`,
    { method: "GET" }
  );
  return Array.isArray(rows) ? rows : [];
}

async function supabaseFetch(pathname, options = {}) {
  if (!hasSupabaseAdminConfig()) {
    throw new Error("Supabase service role is not configured.");
  }
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (_error) {
      parsed = null;
    }
  }

  if (!response.ok) {
    const detail = parsed?.message || parsed?.error_description || parsed?.hint || text || `HTTP ${response.status}`;
    throw new Error(`Supabase request failed (${response.status}): ${detail}`);
  }

  return parsed;
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeAutoReportSettings(raw) {
  const source = normalizeObject(raw);
  const days = Array.isArray(source.days)
    ? source.days
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  const hourRaw = Number(source.hour);
  const hour = Number.isInteger(hourRaw) && hourRaw >= 0 && hourRaw <= 23 ? hourRaw : 18;
  const lastSentSlotKey = normalizeSlotKey(source.lastSentSlotKey);
  return {
    enabled: Boolean(source.enabled) && days.length > 0,
    days,
    hour,
    lastSentSlotKey
  };
}

function isAutoReportDue(autoReport, now) {
  if (!autoReport.enabled) return false;
  if (!Array.isArray(autoReport.days) || !autoReport.days.length) return false;
  if (!autoReport.days.includes(now.jsDay)) return false;
  return now.hour >= autoReport.hour;
}

function normalizeSlotKey(value) {
  const slotKey = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}__\d{2}$/.test(slotKey) ? slotKey : "";
}

function normalizeISODate(value) {
  const dateISO = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(dateISO) ? dateISO : "";
}

function getNowInTimezone(timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const map = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  });

  const weekdayMap = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 0
  };

  return {
    dateISO: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour || 0),
    jsDay: Number.isInteger(weekdayMap[map.weekday]) ? weekdayMap[map.weekday] : new Date().getDay()
  };
}

function buildAttendanceReportText(payload) {
  const appState = normalizeObject(payload?.appState);
  const dateISO = normalizeISODate(payload?.dateISO);
  const userEmail = String(payload?.userEmail || "").trim() || "-";
  const sessions = getSessionsForDate(appState, dateISO);
  const personalTypeLabel = {
    personal: "персональная",
    split: "сплит",
    mini_group: "мини-группа"
  };

  const lines = [
    "AttendPro: отчет посещаемости",
    `Дата: ${formatRuDate(dateISO)}`,
    `Аккаунт: ${userEmail}`,
    ""
  ];

  if (!sessions.length) {
    lines.push("Сегодня занятий нет.");
    return limitTelegramText(lines.join("\n"));
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
      const trainingType = personalTypeLabel[entry.trainingType] ? entry.trainingType : "personal";
      const status = String(entry.data?.status || "запланировано");
      if (status === "запланировано") {
        personalPlannedCount += 1;
        unmarkedLines.push(`- ${entry.data.time} ${entry.studentName} (${personalTypeLabel[trainingType]})`);
      }
      return `- ${entry.data.time} ${entry.studentName}: ${status}`;
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
      const marks = Object.values(entry.data?.attendance || {});
      const presentCount = marks.filter((item) => item === "присутствовал").length;
      const absentCount = marks.filter((item) => item === "отсутствовал").length;
      const groupSize = Array.isArray(entry.students) ? entry.students.length : 0;
      const unmarkedCount = Math.max(0, groupSize - presentCount - absentCount);
      groupPresent += presentCount;
      groupAbsent += absentCount;
      groupUnmarked += unmarkedCount;

      if (unmarkedCount > 0) {
        unmarkedLines.push(`- ${entry.data.time} ${entry.groupName}: без отметки ${unmarkedCount}`);
      }

      return `- ${entry.data.time} ${entry.groupName}: +${presentCount}/-${absentCount}, без отметки ${unmarkedCount}`;
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

  lines.push(`Персональные/сплиты/мини-группы без отметки: ${personalPlannedCount}`);
  lines.push(`Группы: ${groupTotal} (присутствовали: ${groupPresent}, отсутствовали: ${groupAbsent}, без отметки: ${groupUnmarked})`);

  return limitTelegramText(lines.join("\n"));
}

function getSessionsForDate(appState, dateISO) {
  const rows = [];
  const students = Array.isArray(appState?.students) ? appState.students : [];
  const groups = Array.isArray(appState?.groups) ? appState.groups : [];

  students.forEach((student) => {
    const sessions = Array.isArray(student?.sessions) ? student.sessions : [];
    sessions.forEach((session) => {
      if (String(session?.date || "") !== dateISO) return;
      rows.push({
        type: "personal",
        studentName: String(student?.name || "Ученик").trim(),
        trainingType: normalizeTrainingType(student?.trainingType),
        data: {
          time: String(session?.time || "00:00"),
          status: String(session?.status || "запланировано")
        }
      });
    });
  });

  groups.forEach((group) => {
    const sessions = Array.isArray(group?.sessions) ? group.sessions : [];
    sessions.forEach((session) => {
      if (String(session?.date || "") !== dateISO) return;
      rows.push({
        type: "group",
        groupName: String(group?.name || "Группа").trim(),
        students: Array.isArray(group?.students) ? group.students : [],
        data: {
          time: String(session?.time || "00:00"),
          attendance: normalizeObject(session?.attendance)
        }
      });
    });
  });

  rows.sort((a, b) => String(a.data.time).localeCompare(String(b.data.time)));
  return rows;
}

function normalizeTrainingType(value) {
  if (value === "split") return "split";
  if (value === "mini_group") return "mini_group";
  return "personal";
}

function formatRuDate(isoDate) {
  if (!isoDate) return "-";
  const [year, month, day] = String(isoDate).split("-");
  if (!year || !month || !day) return String(isoDate);
  return `${day}.${month}.${year}`;
}

function limitTelegramText(text) {
  const value = String(text || "");
  if (value.length <= TELEGRAM_REPORT_MAX_LENGTH) return value;
  const marker = "\n...\n[Отчет сокращен из-за ограничения Telegram]";
  const maxBaseLength = Math.max(0, TELEGRAM_REPORT_MAX_LENGTH - marker.length);
  return `${value.slice(0, maxBaseLength)}${marker}`;
}

function hasTelegramConfig() {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
}

function hasSupabaseAdminConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function clampInt(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeTimeZone(value) {
  try {
    // Throws on invalid timezone.
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch (_error) {
    return "UTC";
  }
}
