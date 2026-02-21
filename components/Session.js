// Отрисовка отдельной тренировки в журнале.
export function renderSession(entry, options = {}) {
  const editable = options.editable !== false;

  if (entry.type === "personal") {
    const session = entry.data;
    const typeBadge = entry.trainingType === "split" ? "Сплит" : "Персональная";
    const isMarked = session.status === "пришел" || session.status === "не пришел";
    const safeStudentName = escapeHtml(entry.studentName);
    const safeStatus = escapeHtml(session.status);

    const statusClass = session.status === "пришел"
      ? "status-ok"
      : session.status === "не пришел"
        ? "status-miss"
        : "status-plan";

    const controls = isMarked
      ? `
        <button class="btn small-btn" ${editable ? "" : "disabled"} data-action="personal-mark" data-student-id="${entry.studentId}" data-session-id="${session.id}" data-status="пришел">Пришел</button>
        <button class="btn small-btn" ${editable ? "" : "disabled"} data-action="personal-mark" data-student-id="${entry.studentId}" data-session-id="${session.id}" data-status="не пришел">Не пришел</button>
      `
      : `
        <button class="btn small-btn" ${editable ? "" : "disabled"} data-action="personal-mark" data-student-id="${entry.studentId}" data-session-id="${session.id}" data-status="пришел">Пришел</button>
        <button class="btn small-btn" ${editable ? "" : "disabled"} data-action="personal-mark" data-student-id="${entry.studentId}" data-session-id="${session.id}" data-status="не пришел">Не пришел</button>
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

  const session = entry.data;
  const hasAnyMarked = entry.students.some((student) => Boolean(session.attendance[student.id]));

  const attendanceControls = entry.students
    .map((student) => {
      const currentStatus = session.attendance[student.id] || "-";
      const safeStudentName = escapeHtml(student.name);
      const safeCurrentStatus = escapeHtml(currentStatus);

      return `
        <div class="group-student-row">
          <strong>${safeStudentName}</strong> <span class="muted">(${safeCurrentStatus})</span>

          <div class="session-actions">
            <label class="group-check">
              <input type="checkbox" ${editable ? "" : "disabled"} data-action="group-attendance" data-group-id="${entry.groupId}" data-session-id="${session.id}" data-student-id="${student.id}" data-value="присутствовал" ${currentStatus === "присутствовал" ? "checked" : ""} />
              Присутствовал
            </label>

            <label class="group-check">
              <input type="checkbox" ${editable ? "" : "disabled"} data-action="group-attendance" data-group-id="${entry.groupId}" data-session-id="${session.id}" data-student-id="${student.id}" data-value="отсутствовал" ${currentStatus === "отсутствовал" ? "checked" : ""} />
              Отсутствовал
            </label>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <article class="session group ${hasAnyMarked ? "session-marked" : ""}" data-session-card="${session.id}" data-marked="${hasAnyMarked ? "1" : "0"}" data-status="group">
      <div class="session-head">
        <div><strong>${session.time}</strong> - ${escapeHtml(entry.groupName)}</div>
        <button class="btn small-btn" ${(hasAnyMarked && editable) ? "" : "disabled"} data-action="toggle-session-edit" data-session-id="${session.id}">Редактировать</button>
      </div>
      ${hasAnyMarked ? `<div class="marked-note">Есть проставленные отметки</div>` : ""}
      <div class="${hasAnyMarked ? "is-hidden" : ""}" data-editable-controls="1">
        ${attendanceControls}
      </div>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
