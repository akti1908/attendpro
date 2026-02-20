// Карточка группы.
export function renderGroupCard(group, ctx) {
  const upcomingSessions = group.sessions
    .slice()
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 8)
    .map((session) => `<li>${ctx.formatDate(session.date)} в ${session.time}</li>`)
    .join("");

  return `
    <article class="card" style="margin-bottom:8px;">
      <h3>${group.name}</h3>
      <p class="muted">Дни: ${group.scheduleDays.map((day) => ctx.dayLabel(day)).join(", ")} | Время: ${group.time}</p>
      <p class="muted">Ученики: ${group.students.map((student) => student.name).join(", ")}</p>
      <ul>${upcomingSessions || "<li class='muted'>Ближайших тренировок нет.</li>"}</ul>
    </article>
  `;
}

// Экран управления группами.
export function renderGroupsManager(root, ctx) {
  root.innerHTML = `
    <section class="grid grid-2">
      <div class="card">
        <h2 class="section-title">Добавить группу</h2>
        <form id="group-form">
          <div class="form-row">
            <input required name="name" placeholder="Название группы" />
            <select required name="hour">${renderHourOptions()}</select>
            <input required name="students" placeholder="Ученики (через запятую)" />
          </div>
          <div id="group-days" class="days">${renderDayCheckboxes(ctx.weekDays)}</div>
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
}

function renderDayCheckboxes(weekDays, selected = []) {
  return weekDays
    .map(
      (day) => `
      <label>
        <input type="checkbox" name="group-day" value="${day.jsDay}" ${selected.includes(day.jsDay) ? "checked" : ""} /> ${day.label}
      </label>
    `
    )
    .join("");
}

function renderHourOptions() {
  return Array.from({ length: 24 }, (_, hour) => {
    const value = String(hour);
    const label = `${String(hour).padStart(2, "0")}:00`;
    return `<option value="${value}">${label}</option>`;
  }).join("");
}

function hourToTimeString(hourValue) {
  const hour = Number(hourValue);
  return `${String(hour).padStart(2, "0")}:00`;
}
