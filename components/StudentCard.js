// Карточка персональной/сплит тренировки.
export function renderStudentCard(student, ctx) {
  const packageOptions = ctx.packageOptions[student.trainingType] || [];
  const packageSelect = renderPackageOptions(packageOptions, student.totalTrainings, student.trainingType);
  const packageHistory = renderPackageHistory(student, ctx);

  const upcomingSessions = student.sessions
    .slice()
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 8)
    .map((session) => `<li>${ctx.formatDate(session.date)} в ${session.time} - <strong>${session.status}</strong></li>`)
    .join("");

  const dayInputs = renderDayCheckboxes(ctx.weekDays, student.scheduleDays);
  const typeLabel = student.trainingType === "split" ? "Сплит" : "Персональная";
  const participantsLabel = student.trainingType === "split"
    ? `${student.participants[0]} + ${student.participants[1]}`
    : student.participants[0];
  const activePackagePrice = student.trainingType === "split"
    ? `${formatMoney(student.activePackage?.pricePerPerson || 0)} сом/чел`
    : `${formatMoney(student.activePackage?.totalPrice || 0)} сом`;

  return `
    <article class="card card-item">
      <h3>${student.name}</h3>
      <p class="muted">Формат: ${typeLabel}</p>
      <p class="muted">Участники: ${participantsLabel}</p>
      <p class="muted">Осталось: ${student.remainingTrainings} / ${student.totalTrainings}</p>
      <p class="muted">Текущий пакет: ${student.totalTrainings} тренировок / ${activePackagePrice}</p>
      <p class="muted">Продления пакетов: ${Math.max(0, (student.packagesHistory || []).length - 1)}</p>
      <p class="muted">Дни: ${student.scheduleDays.map((day) => ctx.dayLabel(day)).join(", ")} | Время: ${student.time}</p>

      <div class="session-actions package-controls">
        <select data-package-select-for="${student.id}">
          ${packageSelect}
        </select>
        <button class="btn small-btn" data-action="apply-package" data-student-id="${student.id}">Добавить новый пакет</button>
      </div>

      <div class="days mt-8" data-days-container="${student.id}">
        ${dayInputs}
      </div>

      <div class="session-actions">
        <button class="btn small-btn" data-action="update-days" data-student-id="${student.id}">Обновить дни</button>
        <button class="btn small-btn" data-action="delete-student" data-student-id="${student.id}">Удалить карточку</button>
      </div>

      <div class="history-list">
        <strong>История пакетов</strong>
        <ul>${packageHistory}</ul>
      </div>

      <ul>${upcomingSessions || "<li class='muted'>Ближайших тренировок нет.</li>"}</ul>
    </article>
  `;
}

// Экран управления карточками персональных и сплит тренировок.
export function renderStudentsManager(root, ctx) {
  root.innerHTML = `
    <section class="grid grid-2">
      <div class="card">
        <h2 class="section-title">Добавить карточку</h2>
        <form id="student-form">
          <div class="form-row">
            <select id="training-type" name="trainingType" required>
              <option value="personal">Персональная</option>
              <option value="split">Сплит (2 человека)</option>
            </select>
            <input required name="primaryName" placeholder="Имя ученика" />
            <input id="secondary-name" name="secondaryName" placeholder="Имя второго участника (для сплита)" disabled />
            <select id="package-select" name="packageCount" required>
              ${renderPackageOptions(ctx.packageOptions.personal, 10, "personal")}
            </select>
            <select required name="hour">${renderHourOptions()}</select>
          </div>

          <div id="student-days" class="days">${renderDayCheckboxes(ctx.weekDays)}</div>
          <button class="btn btn-primary" type="submit">Создать карточку</button>
        </form>
      </div>

      <div class="card">
        <h2 class="section-title">Карточки</h2>
        <div id="students-list" class="list-scroll"></div>
      </div>
    </section>
  `;

  const typeSelect = root.querySelector("#training-type");
  const packageSelect = root.querySelector("#package-select");
  const secondName = root.querySelector("#secondary-name");

  const syncFormByType = () => {
    const type = typeSelect.value === "split" ? "split" : "personal";
    secondName.disabled = type !== "split";
    secondName.required = type === "split";
    if (type !== "split") secondName.value = "";
    packageSelect.innerHTML = renderPackageOptions(ctx.packageOptions[type], 10, type);
  };

  typeSelect.addEventListener("change", syncFormByType);
  syncFormByType();

  root.querySelector("#student-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const scheduleDays = [...root.querySelectorAll('input[name="student-day"]:checked')].map((item) => Number(item.value));

    if (!scheduleDays.length) {
      alert("Выберите хотя бы один день недели.");
      return;
    }

    if (formData.get("trainingType") === "split" && !String(formData.get("secondaryName") || "").trim()) {
      alert("Для сплита нужно указать второго участника.");
      return;
    }

    ctx.actions.addStudent({
      trainingType: formData.get("trainingType"),
      primaryName: formData.get("primaryName"),
      secondaryName: formData.get("secondaryName"),
      packageCount: Number(formData.get("packageCount")),
      scheduleDays,
      time: hourToTimeString(formData.get("hour"))
    });
  });

  const studentsList = root.querySelector("#students-list");
  studentsList.innerHTML = ctx.state.students.length
    ? ctx.state.students.map((student) => renderStudentCard(student, ctx)).join("")
    : `<p class="muted">Карточек пока нет.</p>`;

  studentsList.querySelectorAll("[data-action='apply-package']").forEach((button) => {
    button.addEventListener("click", () => {
      const select = studentsList.querySelector(`[data-package-select-for='${button.dataset.studentId}']`);
      ctx.actions.addStudentPackage(button.dataset.studentId, Number(select.value));
    });
  });

  studentsList.querySelectorAll("[data-action='update-days']").forEach((button) => {
    button.addEventListener("click", () => {
      const container = studentsList.querySelector(`[data-days-container='${button.dataset.studentId}']`);
      const selectedDays = [...container.querySelectorAll("input:checked")].map((item) => Number(item.value));

      if (!selectedDays.length) {
        alert("Выберите хотя бы один день недели.");
        return;
      }

      ctx.actions.updateStudentSchedule(button.dataset.studentId, selectedDays);
    });
  });

  studentsList.querySelectorAll("[data-action='delete-student']").forEach((button) => {
    button.addEventListener("click", () => {
      const isConfirmed = window.confirm("Удалить карточку? Это действие нельзя отменить.");
      if (!isConfirmed) return;
      ctx.actions.deleteStudentCard(button.dataset.studentId);
    });
  });
}

function renderDayCheckboxes(weekDays, selected = []) {
  return weekDays
    .map(
      (day) => `
      <label>
        <input type="checkbox" name="student-day" value="${day.jsDay}" ${selected.includes(day.jsDay) ? "checked" : ""} /> ${day.label}
      </label>
    `
    )
    .join("");
}

function renderPackageOptions(options, selectedCount, type) {
  return options
    .map((item) => {
      const selected = Number(selectedCount) === Number(item.count) ? "selected" : "";
      const label = type === "split"
        ? `${item.count} тренировок — ${formatMoney(item.pricePerPerson)} сом/чел`
        : `${item.count} тренировок — ${formatMoney(item.totalPrice)} сом`;

      return `<option value="${item.count}" ${selected}>${label}</option>`;
    })
    .join("");
}

function renderPackageHistory(student, ctx) {
  const history = [...(student.packagesHistory || [])]
    .sort((a, b) => String(b.purchasedAt || "").localeCompare(String(a.purchasedAt || "")))
    .slice(0, 8);

  if (!history.length) {
    return "<li class='muted'>История пока пустая.</li>";
  }

  return history
    .map((item) => {
      const dateText = item.purchasedAt ? ctx.formatDate(item.purchasedAt.slice(0, 10)) : "-";
      const priceText = student.trainingType === "split"
        ? `${formatMoney(item.pricePerPerson || 0)} сом/чел`
        : `${formatMoney(item.totalPrice || 0)} сом`;

      return `<li>${dateText}: ${item.count} тренировок - ${priceText}</li>`;
    })
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

function formatMoney(value) {
  return Number(value).toLocaleString("ru-RU");
}
