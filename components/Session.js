// Отрисовка отдельной тренировки в журнале.
const PERSONAL_PRESENT_STATUS = "пришел";
const PERSONAL_MISSED_STATUS = "не пришел";
const PERSONAL_PLANNED_STATUS = "запланировано";
const PERSONAL_TRANSFERRED_STATUS = "перенесено";
const PERSONAL_DELETED_STATUS = "удалено";
const GROUP_PRESENT_STATUS = "присутствовал";
const GROUP_ABSENT_STATUS = "отсутствовал";

export function renderSession(entry, options = {}) {
  const editable = options.editable !== false;

  if (entry.type === "personal") {
    return renderPersonalSession(entry, editable);
  }

  return renderGroupSession(entry, editable);
}

function renderPersonalSession(entry, editable) {
  const session = entry.data;
  const typeBadge = entry.trainingType === "split"
    ? "Сплит"
    : entry.trainingType === "mini_group"
      ? "Мини-группа"
      : "Персональная";

  const isDeleted = Boolean(session.deletedAt) || session.status === PERSONAL_DELETED_STATUS;
  const isFinal = session.status === PERSONAL_PRESENT_STATUS || session.status === PERSONAL_MISSED_STATUS;
  const isTransferred = session.status === PERSONAL_TRANSFERRED_STATUS;
  const isMarked = isFinal || isTransferred || isDeleted;
  const canReschedule = !isDeleted && session.status === PERSONAL_PLANNED_STATUS;
  const safeStudentName = escapeHtml(entry.studentName);
  const safeStatus = escapeHtml(resolvePersonalStatusLabel(session.status, isDeleted));
  const transferInfo = renderTransferInfo(session);
  const historyBlock = renderSessionHistory(session.history);

  const statusClass = isDeleted
    ? "status-deleted"
    : session.status === PERSONAL_PRESENT_STATUS
      ? "status-ok"
      : session.status === PERSONAL_MISSED_STATUS
        ? "status-miss"
        : session.status === PERSONAL_TRANSFERRED_STATUS
          ? "status-transfer"
          : "status-plan";

  const transferControls = canReschedule
    ? `
      <div class="reschedule-wrap">
        <button
          class="btn small-btn"
          ${editable ? "" : "disabled"}
          type="button"
          data-action="personal-reschedule-toggle"
          data-student-id="${entry.studentId}"
          data-session-id="${session.id}"
        >
          Перенести
        </button>
        <div class="session-actions transfer-menu is-hidden" data-reschedule-menu="1">
          <button
            class="btn small-btn"
            ${editable ? "" : "disabled"}
            type="button"
            data-action="personal-reschedule-by-schedule"
            data-student-id="${entry.studentId}"
            data-session-id="${session.id}"
          >
            Перенести по графику
          </button>
          <button
            class="btn small-btn"
            ${editable ? "" : "disabled"}
            type="button"
            data-action="personal-reschedule-date-toggle"
            data-student-id="${entry.studentId}"
            data-session-id="${session.id}"
          >
            Перенести на дату
          </button>
          <div class="transfer-date-panel is-hidden" data-transfer-date-panel="1">
            <input
              type="date"
              data-transfer-date-input="1"
              value="${escapeHtml(session.date)}"
              ${editable ? "" : "disabled"}
            />
            <button
              class="btn small-btn"
              ${editable ? "" : "disabled"}
              type="button"
              data-action="personal-reschedule-by-date"
              data-student-id="${entry.studentId}"
              data-session-id="${session.id}"
            >
              Подтвердить дату
            </button>
          </div>
        </div>
      </div>
    `
    : "";

  const controls = `
    <button class="btn small-btn" ${editable ? "" : "disabled"} data-action="personal-mark" data-student-id="${entry.studentId}" data-session-id="${session.id}" data-status="${PERSONAL_PRESENT_STATUS}">Пришел</button>
    <button class="btn small-btn" ${editable ? "" : "disabled"} data-action="personal-mark" data-student-id="${entry.studentId}" data-session-id="${session.id}" data-status="${PERSONAL_MISSED_STATUS}">Не пришел</button>
    ${transferControls}
  `;

  return `
    <article
      class="session personal ${isMarked ? "session-marked" : ""} ${isDeleted ? "session-deleted" : ""}"
      data-entry-type="personal"
      data-student-id="${entry.studentId}"
      data-session-card="${session.id}"
      data-marked="${isMarked ? "1" : "0"}"
      data-status="${session.status}"
    >
      <div class="session-head">
        <div><strong>${session.time}</strong> - ${safeStudentName}</div>
        <button class="btn small-btn" ${(isMarked && editable) ? "" : "disabled"} data-action="toggle-session-edit" data-session-id="${session.id}">Редактировать</button>
      </div>

      <div class="muted">Формат: ${typeBadge}</div>

      <div class="status-line">
        <span class="muted">Статус:</span>
        <span class="status-pill ${statusClass}">${safeStatus}</span>
      </div>

      ${transferInfo}
      ${isMarked && !isDeleted ? `<div class="marked-note">Отметка уже произведена</div>` : ""}

      <div class="session-actions session-mark-controls ${isMarked ? "is-hidden" : ""}" data-editable-controls="1">
        ${controls}
      </div>

      ${historyBlock}
    </article>
  `;
}

function renderGroupSession(entry, editable) {
  const session = entry.data;
  const isDeleted = Boolean(session.deletedAt);
  const markedCount = isDeleted ? 0 : entry.students.filter((student) => Boolean(session.attendance[student.id])).length;
  const hasAnyMarked = markedCount > 0;
  const allMarked = !isDeleted && entry.students.length > 0 && markedCount >= entry.students.length;

  const presentNames = isDeleted
    ? []
    : entry.students
      .filter((student) => session.attendance[student.id] === GROUP_PRESENT_STATUS)
      .map((student) => student.name);
  const absentNames = isDeleted
    ? []
    : entry.students
      .filter((student) => session.attendance[student.id] === GROUP_ABSENT_STATUS)
      .map((student) => student.name);

  const summaryBlock = allMarked ? renderGroupAttendanceSummary(presentNames, absentNames) : "";
  const historyBlock = renderSessionHistory(session.history);

  const attendanceControls = entry.students
    .map((student) => {
      const currentStatus = session.attendance[student.id] || "";
      const isPresent = currentStatus === GROUP_PRESENT_STATUS;
      const isAbsent = currentStatus === GROUP_ABSENT_STATUS;
      const rowStateClass = isPresent
        ? "group-student-row-present"
        : isAbsent
          ? "group-student-row-absent"
          : "";

      return `
        <div class="group-student-row ${rowStateClass}">
          <strong class="group-student-name">${escapeHtml(student.name)}</strong>

          <div class="group-mark-actions">
            <button
              class="btn small-btn group-mark-btn ${isPresent ? "group-mark-btn-active-plus" : ""}"
              type="button"
              ${editable ? "" : "disabled"}
              data-action="group-attendance"
              data-group-id="${entry.groupId}"
              data-session-id="${session.id}"
              data-student-id="${student.id}"
              data-value="${GROUP_PRESENT_STATUS}"
              aria-label="Присутствовал"
              title="Присутствовал"
            >
              +
            </button>

            <button
              class="btn small-btn group-mark-btn ${isAbsent ? "group-mark-btn-active-minus" : ""}"
              type="button"
              ${editable ? "" : "disabled"}
              data-action="group-attendance"
              data-group-id="${entry.groupId}"
              data-session-id="${session.id}"
              data-student-id="${student.id}"
              data-value="${GROUP_ABSENT_STATUS}"
              aria-label="Отсутствовал"
              title="Отсутствовал"
            >
              -
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <article
      class="session group ${hasAnyMarked ? "session-marked" : ""} ${isDeleted ? "session-deleted" : ""}"
      data-entry-type="group"
      data-group-id="${entry.groupId}"
      data-session-card="${session.id}"
      data-marked="${hasAnyMarked ? "1" : "0"}"
      data-status="${isDeleted ? "удалено" : "group"}"
    >
      <div class="session-head">
        <div><strong>${session.time}</strong> - Группа: ${escapeHtml(entry.groupName)}</div>
        <button class="btn small-btn" ${(allMarked && editable && !isDeleted) ? "" : "disabled"} data-action="toggle-session-edit" data-session-id="${session.id}">Редактировать</button>
      </div>
      ${hasAnyMarked ? `<div class="marked-note">Есть проставленные отметки</div>` : ""}
      ${summaryBlock}
      <div class="${allMarked || isDeleted ? "is-hidden" : ""}" data-editable-controls="1">
        ${attendanceControls}
      </div>
      ${historyBlock}
    </article>
  `;
}

function renderTransferInfo(session) {
  if (String(session.status || "").trim() !== PERSONAL_TRANSFERRED_STATUS) return "";
  const targetDate = String(session.transferToDate || "").trim();
  if (!targetDate) return "";

  const targetTime = String(session.transferToTime || "").trim() || "00:00";
  const safeDate = escapeHtml(formatDate(targetDate));
  const safeTime = escapeHtml(targetTime);
  return `<div class="transfer-note muted">Перенесено на ${safeDate} в ${safeTime}</div>`;
}

function renderSessionHistory(history) {
  const rows = Array.isArray(history) ? history.slice(0, 6) : [];
  if (!rows.length) return "";

  const items = rows
    .map((entry) => {
      const at = formatHistoryDateTime(entry?.at);
      const text = escapeHtml(entry?.text || "");
      if (!text) return "";
      return `<li><span class="muted">${escapeHtml(at)}</span> - ${text}</li>`;
    })
    .filter(Boolean)
    .join("");
  if (!items) return "";

  return `
    <details class="session-history">
      <summary>История действий</summary>
      <ul>${items}</ul>
    </details>
  `;
}

function renderGroupAttendanceSummary(presentNames, absentNames) {
  const presentCount = Array.isArray(presentNames) ? presentNames.length : 0;
  const absentCount = Array.isArray(absentNames) ? absentNames.length : 0;

  return `
    <section class="group-attendance-summary" aria-label="Итог посещаемости группы">
      <div class="group-summary-section group-summary-present">
        <h4 class="group-summary-title">Присутствовали <span class="group-summary-count">${presentCount}</span></h4>
        <ul class="group-summary-list">
          ${renderGroupSummaryList(presentNames)}
        </ul>
      </div>
      <div class="group-summary-section group-summary-absent">
        <h4 class="group-summary-title">Отсутствовали <span class="group-summary-count">${absentCount}</span></h4>
        <ul class="group-summary-list">
          ${renderGroupSummaryList(absentNames)}
        </ul>
      </div>
    </section>
  `;
}

function renderGroupSummaryList(names) {
  if (!Array.isArray(names) || !names.length) {
    return `<li class="group-summary-empty">-</li>`;
  }

  return names
    .map((name) => `<li class="group-summary-name">${escapeHtml(name)}</li>`)
    .join("");
}

function resolvePersonalStatusLabel(status, isDeleted) {
  if (isDeleted) return "удалено";
  const value = String(status || "").trim();
  if (!value) return PERSONAL_PLANNED_STATUS;
  return value;
}

function formatHistoryDateTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDate(dateISO) {
  const [year, month, day] = String(dateISO || "").split("-");
  if (!year || !month || !day) return String(dateISO || "-");
  return `${day}.${month}.${year}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
