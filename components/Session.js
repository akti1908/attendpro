// Отрисовка отдельной тренировки в журнале.
const PERSONAL_PRESENT_STATUS = "пришел";
const PERSONAL_MISSED_STATUS = "не пришел";
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
  const isMarked = session.status === PERSONAL_PRESENT_STATUS || session.status === PERSONAL_MISSED_STATUS;
  const safeStudentName = escapeHtml(entry.studentName);
  const safeStatus = escapeHtml(session.status);

  const statusClass = session.status === PERSONAL_PRESENT_STATUS
    ? "status-ok"
    : session.status === PERSONAL_MISSED_STATUS
      ? "status-miss"
      : "status-plan";

  const controls = isMarked
    ? `
      <button class="btn small-btn" ${editable ? "" : "disabled"} data-action="personal-mark" data-student-id="${entry.studentId}" data-session-id="${session.id}" data-status="${PERSONAL_PRESENT_STATUS}">Пришел</button>
      <button class="btn small-btn" ${editable ? "" : "disabled"} data-action="personal-mark" data-student-id="${entry.studentId}" data-session-id="${session.id}" data-status="${PERSONAL_MISSED_STATUS}">Не пришел</button>
    `
    : `
      <button class="btn small-btn" ${editable ? "" : "disabled"} data-action="personal-mark" data-student-id="${entry.studentId}" data-session-id="${session.id}" data-status="${PERSONAL_PRESENT_STATUS}">Пришел</button>
      <button class="btn small-btn" ${editable ? "" : "disabled"} data-action="personal-mark" data-student-id="${entry.studentId}" data-session-id="${session.id}" data-status="${PERSONAL_MISSED_STATUS}">Не пришел</button>
      <button class="btn small-btn" ${editable ? "" : "disabled"} data-action="personal-reschedule" data-student-id="${entry.studentId}" data-session-id="${session.id}">Перенести</button>
    `;

  return `
    <article class="session personal ${isMarked ? "session-marked" : ""}" data-session-card="${session.id}" data-marked="${isMarked ? "1" : "0"}" data-status="${session.status}">
      <div class="session-head">
        <div><strong>${session.time}</strong> - ${safeStudentName}</div>
        <button class="btn small-btn" ${(isMarked && editable) ? "" : "disabled"} data-action="toggle-session-edit" data-session-id="${session.id}">Редактировать</button>
      </div>

      <div class="muted">Формат: ${typeBadge}</div>

      <div class="status-line">
        <span class="muted">Статус:</span>
        <span class="status-pill ${statusClass}">${safeStatus}</span>
      </div>

      ${isMarked ? `<div class="marked-note">Отметка уже произведена</div>` : ""}

      <div class="session-actions session-mark-controls ${isMarked ? "is-hidden" : ""}" data-editable-controls="1">
        ${controls}
      </div>
    </article>
  `;
}

function renderGroupSession(entry, editable) {
  const session = entry.data;
  const markedCount = entry.students.filter((student) => Boolean(session.attendance[student.id])).length;
  const hasAnyMarked = markedCount > 0;
  const allMarked = entry.students.length > 0 && markedCount >= entry.students.length;

  const presentNames = entry.students
    .filter((student) => session.attendance[student.id] === GROUP_PRESENT_STATUS)
    .map((student) => student.name);
  const absentNames = entry.students
    .filter((student) => session.attendance[student.id] === GROUP_ABSENT_STATUS)
    .map((student) => student.name);

  const summaryBlock = allMarked ? renderGroupAttendanceSummary(presentNames, absentNames) : "";

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
    <article class="session group ${hasAnyMarked ? "session-marked" : ""}" data-session-card="${session.id}" data-marked="${hasAnyMarked ? "1" : "0"}" data-status="group">
      <div class="session-head">
        <div><strong>${session.time}</strong> - Группа: ${escapeHtml(entry.groupName)}</div>
        <button class="btn small-btn" ${(allMarked && editable) ? "" : "disabled"} data-action="toggle-session-edit" data-session-id="${session.id}">Редактировать</button>
      </div>
      ${hasAnyMarked ? `<div class="marked-note">Есть проставленные отметки</div>` : ""}
      ${summaryBlock}
      <div class="${allMarked ? "is-hidden" : ""}" data-editable-controls="1">
        ${attendanceControls}
      </div>
    </article>
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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
