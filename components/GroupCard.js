// Карточка группы.
export function renderGroupCard(group, ctx) {
  const allowedWorkDays = normalizeAllowedDays(ctx.workSchedule?.days);
  const availableHours = resolveAvailableHours(
    typeof ctx.getWorkHoursForDays === "function" ? ctx.getWorkHoursForDays(group.scheduleDays) : ctx.workHours
  );
  const upcomingSessions = group.sessions
    .slice()
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 8)
    .map((session) => `<li>${ctx.formatDate(session.date)} в ${session.time}</li>`)
    .join("");

  const selectedHour = Number(String(group.time || "00:00").slice(0, 2));
  const resolvedHour = resolveSelectedHour(selectedHour, availableHours);
  const dayInputs = renderDayCheckboxes(ctx.weekDays, group.scheduleDays, `group-edit-day-${group.id}`, allowedWorkDays);
  const safeGroupName = escapeHtml(group.name);
  const safeMembers = group.students.map((student) => escapeHtml(student.name)).join(", ");

  return `
    <article class="card card-item" data-group-card="${group.id}">
      <div class="card-head">
        <h3>${safeGroupName}</h3>
        <button class="btn small-btn" type="button" data-action="toggle-group-edit" data-group-id="${group.id}">Редактировать</button>
      </div>

      <p class="muted">Дни: ${group.scheduleDays.map((day) => ctx.dayLabel(day)).join(", ")} | Время: ${group.time}</p>
      <p class="muted">Ученики: ${safeMembers}</p>

      <div class="card-edit-panel is-hidden" data-group-edit-panel="${group.id}">
        <div class="form-row">
          <input data-group-field="name" type="text" value="${escapeAttr(group.name)}" placeholder="Название группы" />
          <select data-group-field="hour">${renderHourOptions(availableHours, resolvedHour)}</select>
          <input data-group-field="students" type="text" value="${escapeAttr(group.students.map((student) => student.name).join(", "))}" placeholder="Ученики (через запятую)" />
        </div>

        <div class="days mt-8" data-group-days-container="${group.id}">
          ${dayInputs}
        </div>

        <div class="session-actions">
          <button class="btn small-btn" type="button" data-action="save-group-edit" data-group-id="${group.id}">Сохранить</button>
          <button class="btn small-btn" type="button" data-action="cancel-group-edit" data-group-id="${group.id}">Отмена</button>
          <button class="btn small-btn" type="button" data-action="delete-group" data-group-id="${group.id}">Удалить группу</button>
        </div>
      </div>

      <ul>${upcomingSessions || "<li class='muted'>Ближайших тренировок нет.</li>"}</ul>
    </article>
  `;
}

// Экран управления группами.
export function renderGroupsManager(root, ctx) {
  const allowedWorkDays = normalizeAllowedDays(ctx.workSchedule?.days);
  const availableHours = resolveAvailableHours(ctx.workHours);
  const defaultHour = getDefaultHour(availableHours);

  root.innerHTML = `
    <section class="grid grid-2">
      <div class="card">
        <h2 class="section-title">Добавить группу</h2>
        <form id="group-form">
          <div class="form-row">
            <input required name="name" placeholder="Название группы" />
            <select required name="hour">${renderHourOptions(availableHours, defaultHour)}</select>
            <input required name="students" placeholder="Ученики (через запятую)" />
          </div>
          <div id="group-days" class="days">${renderDayCheckboxes(ctx.weekDays, [], "group-day", allowedWorkDays)}</div>
          <button class="btn btn-primary" type="submit">Добавить группу</button>
        </form>
      </div>

      <div class="card">
        <h2 class="section-title">Список групп</h2>
        <div id="groups-list" class="list-scroll"></div>
      </div>
    </section>
  `;

  root.querySelector("#group-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const scheduleDays = [...root.querySelectorAll('input[name="group-day"]:checked')].map((item) => Number(item.value));

    if (!scheduleDays.length) {
      alert("Выберите хотя бы один день недели.");
      return;
    }

    const students = String(formData.get("students"))
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    if (!students.length) {
      alert("Добавьте хотя бы одного ученика.");
      return;
    }

    ctx.actions.addGroup({
      name: String(formData.get("name")).trim(),
      scheduleDays,
      time: hourToTimeString(formData.get("hour")),
      students
    });
  });

  const groupsList = root.querySelector("#groups-list");
  groupsList.innerHTML = ctx.state.groups.length
    ? ctx.state.groups.map((group) => renderGroupCard(group, ctx)).join("")
    : `<p class="muted">Групп пока нет.</p>`;

  groupsList.querySelectorAll("[data-action='toggle-group-edit']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-group-card]");
      if (!card) return;

      const panel = card.querySelector("[data-group-edit-panel]");
      if (!panel) return;

      const willOpen = panel.classList.contains("is-hidden");
      setGroupCardEditMode(card, willOpen);
      if (!willOpen) {
        resetGroupEditPanel(card);
      }
    });
  });

  groupsList.querySelectorAll("[data-action='cancel-group-edit']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-group-card]");
      if (!card) return;
      resetGroupEditPanel(card);
      setGroupCardEditMode(card, false);
    });
  });

  groupsList.querySelectorAll("[data-action='save-group-edit']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-group-card]");
      const panel = card?.querySelector("[data-group-edit-panel]");
      if (!card || !panel) return;

      const name = String(panel.querySelector('[data-group-field="name"]')?.value || "").trim();
      const hour = String(panel.querySelector('[data-group-field="hour"]')?.value || "0");
      const studentsRaw = String(panel.querySelector('[data-group-field="students"]')?.value || "");
      const students = studentsRaw.split(",").map((item) => item.trim()).filter(Boolean);
      const scheduleDays = [...panel.querySelectorAll('input[data-day-input="1"]:checked')].map((item) => Number(item.value));

      ctx.actions.updateGroupCardData(button.dataset.groupId, {
        name,
        scheduleDays,
        time: hourToTimeString(hour),
        students
      });
    });
  });

  groupsList.querySelectorAll("[data-action='delete-group']").forEach((button) => {
    button.addEventListener("click", () => {
      const isConfirmed = window.confirm("Удалить группу? Это действие нельзя отменить.");
      if (!isConfirmed) return;
      ctx.actions.deleteGroupCard(button.dataset.groupId);
    });
  });
}

function setGroupCardEditMode(card, isOpen) {
  const panel = card.querySelector("[data-group-edit-panel]");
  const toggle = card.querySelector("[data-action='toggle-group-edit']");
  if (!panel || !toggle) return;

  panel.classList.toggle("is-hidden", !isOpen);
  card.classList.toggle("card-editing", isOpen);
  toggle.textContent = isOpen ? "Скрыть" : "Редактировать";
}

function resetGroupEditPanel(card) {
  const panel = card.querySelector("[data-group-edit-panel]");
  if (!panel) return;

  panel.querySelectorAll("input, select").forEach((control) => {
    if (control.type === "checkbox" || control.type === "radio") {
      control.checked = control.defaultChecked;
      return;
    }
    control.value = control.defaultValue;
  });
}

function renderDayCheckboxes(weekDays, selected = [], inputName = "group-day", allowedDays = []) {
  const allowedSet = new Set(normalizeAllowedDays(allowedDays));
  const selectedSet = new Set((Array.isArray(selected) ? selected : []).map((item) => Number(item)));

  return weekDays
    .map((day) => {
      const isAllowed = !allowedSet.size || allowedSet.has(day.jsDay);
      const checked = selectedSet.has(day.jsDay) && isAllowed ? "checked" : "";
      const disabled = isAllowed ? "" : "disabled";
      return `
      <label>
        <input type="checkbox" data-day-input="1" name="${inputName}" value="${day.jsDay}" ${checked} ${disabled} /> ${day.label}
      </label>
    `;
    })
    .join("");
}

function normalizeAllowedDays(allowedDays) {
  const list = Array.isArray(allowedDays) ? allowedDays : [];
  return list
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

function resolveAvailableHours(hoursSource) {
  const source = Array.isArray(hoursSource) ? hoursSource : [];
  const hours = source
    .map((hour) => Number(hour))
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23)
    .sort((a, b) => a - b);
  if (hours.length) return [...new Set(hours)];
  return Array.from({ length: 24 }, (_, hour) => hour);
}

function getDefaultHour(availableHours) {
  if (availableHours.includes(10)) return 10;
  return availableHours[0] ?? 0;
}

function resolveSelectedHour(selectedHour, availableHours) {
  const hour = Number(selectedHour);
  if (Number.isInteger(hour) && availableHours.includes(hour)) return hour;
  return getDefaultHour(availableHours);
}

function renderHourOptions(availableHours, selectedHour = 0) {
  return resolveAvailableHours(availableHours)
    .map((hour) => {
      const value = String(hour);
      const label = `${String(hour).padStart(2, "0")}:00`;
      const selected = Number(selectedHour) === hour ? "selected" : "";
      return `<option value="${value}" ${selected}>${label}</option>`;
    })
    .join("");
}

function hourToTimeString(hourValue) {
  const hour = Number(hourValue);
  return `${String(hour).padStart(2, "0")}:00`;
}

function escapeAttr(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
