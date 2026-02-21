// Карточка персональной/сплит тренировки.
export function renderStudentCard(student, ctx) {
  const packageOptions = ctx.packageOptions[student.trainingType] || [];
  const packageSelect = renderPackageOptions(packageOptions, student.totalTrainings, student.trainingType);
  const packageHistory = renderPackageHistory(student, ctx);

  const upcomingSessions = student.sessions
    .slice()
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 8)
    .map((session) => `<li>${ctx.formatDate(session.date)} в ${session.time} - <strong>${escapeHtml(session.status)}</strong></li>`)
    .join("");

  const editDayInputs = renderDayCheckboxes(ctx.weekDays, student.scheduleDays, `student-edit-day-${student.id}`);
  const typeLabel = student.trainingType === "split" ? "Сплит" : "Персональная";
  const participantsLabel = student.trainingType === "split"
    ? `${student.participants[0]} + ${student.participants[1]}`
    : student.participants[0];
  const safeName = escapeHtml(student.name);
  const safeParticipantsLabel = escapeHtml(participantsLabel);
  const activePackagePrice = student.trainingType === "split"
    ? `${formatMoney(student.activePackage?.pricePerPerson || 0)} сом/чел`
    : `${formatMoney(student.activePackage?.totalPrice || 0)} сом`;
  const activePackageCategory = String(student.activePackage?.trainerCategory || "I");
  const activeCoachPercent = Number(student.activePackage?.coachPercent || 50);
  const selectedHour = Number(String(student.time || "00:00").slice(0, 2));

  return `
    <article class="card card-item" data-student-card="${student.id}">
      <div class="card-head">
        <h3>${safeName}</h3>
        <button class="btn small-btn" type="button" data-action="toggle-student-edit" data-student-id="${student.id}">Редактировать</button>
      </div>

      <p class="muted">Формат: ${typeLabel}</p>
      <p class="muted">Участники: ${safeParticipantsLabel}</p>
      <p class="muted">Осталось: ${student.remainingTrainings} / ${student.totalTrainings}</p>
      <p class="muted">Текущий пакет: ${student.totalTrainings} тренировок / ${activePackagePrice} / Категория ${activePackageCategory}</p>
      <p class="muted">Доля тренера в пакете: ${activeCoachPercent}%</p>
      <p class="muted">Продления пакетов: ${Math.max(0, (student.packagesHistory || []).length - 1)}</p>
      <p class="muted">Дни: ${student.scheduleDays.map((day) => ctx.dayLabel(day)).join(", ")} | Время: ${student.time}</p>

      <div class="session-actions package-controls">
        <select data-package-select-for="${student.id}">
          ${packageSelect}
        </select>
        <button class="btn small-btn" type="button" data-action="apply-package" data-student-id="${student.id}">Добавить новый пакет</button>
      </div>

      <div class="card-edit-panel is-hidden" data-student-edit-panel="${student.id}">
        <div class="form-row">
          <input data-student-field="primary-name" type="text" value="${escapeAttr(student.participants[0] || "")}" placeholder="Имя ученика" />
          ${student.trainingType === "split"
            ? `<input data-student-field="secondary-name" type="text" value="${escapeAttr(student.participants[1] || "")}" placeholder="Имя второго участника" />`
            : ""}
          <select data-student-field="hour">${renderHourOptions(selectedHour)}</select>
        </div>

        <div class="days mt-8" data-edit-days-container="${student.id}">
          ${editDayInputs}
        </div>

        <div class="session-actions">
          <button class="btn small-btn" type="button" data-action="save-student-edit" data-student-id="${student.id}">Сохранить</button>
          <button class="btn small-btn" type="button" data-action="cancel-student-edit" data-student-id="${student.id}">Отмена</button>
          <button class="btn small-btn" type="button" data-action="delete-student" data-student-id="${student.id}">Удалить карточку</button>
        </div>
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

          <div id="student-days" class="days">${renderDayCheckboxes(ctx.weekDays, [], "student-day")}</div>
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

  studentsList.querySelectorAll("[data-action='toggle-student-edit']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-student-card]");
      if (!card) return;

      const panel = card.querySelector("[data-student-edit-panel]");
      if (!panel) return;

      const willOpen = panel.classList.contains("is-hidden");
      setStudentCardEditMode(card, willOpen);
      if (!willOpen) {
        resetStudentEditPanel(card);
      }
    });
  });

  studentsList.querySelectorAll("[data-action='cancel-student-edit']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-student-card]");
      if (!card) return;
      resetStudentEditPanel(card);
      setStudentCardEditMode(card, false);
    });
  });

  studentsList.querySelectorAll("[data-action='save-student-edit']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-student-card]");
      const panel = card?.querySelector("[data-student-edit-panel]");
      if (!card || !panel) return;

      const primaryName = String(panel.querySelector('[data-student-field="primary-name"]')?.value || "").trim();
      const secondaryName = String(panel.querySelector('[data-student-field="secondary-name"]')?.value || "").trim();
      const hour = String(panel.querySelector('[data-student-field="hour"]')?.value || "0");
      const scheduleDays = [...panel.querySelectorAll('input[data-day-input="1"]:checked')].map((item) => Number(item.value));

      ctx.actions.updateStudentCardData(button.dataset.studentId, {
        primaryName,
        secondaryName,
        scheduleDays,
        time: hourToTimeString(hour)
      });
    });
  });

  studentsList.querySelectorAll("[data-action='apply-package']").forEach((button) => {
    button.addEventListener("click", () => {
      const select = studentsList.querySelector(`[data-package-select-for='${button.dataset.studentId}']`);
      ctx.actions.addStudentPackage(button.dataset.studentId, Number(select.value));
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

function setStudentCardEditMode(card, isOpen) {
  const panel = card.querySelector("[data-student-edit-panel]");
  const toggle = card.querySelector("[data-action='toggle-student-edit']");
  if (!panel || !toggle) return;

  panel.classList.toggle("is-hidden", !isOpen);
  card.classList.toggle("card-editing", isOpen);
  toggle.textContent = isOpen ? "Скрыть" : "Редактировать";
}

function resetStudentEditPanel(card) {
  const panel = card.querySelector("[data-student-edit-panel]");
  if (!panel) return;

  panel.querySelectorAll("input, select").forEach((control) => {
    if (control.type === "checkbox" || control.type === "radio") {
      control.checked = control.defaultChecked;
      return;
    }
    control.value = control.defaultValue;
  });
}

function renderDayCheckboxes(weekDays, selected = [], inputName = "student-day") {
  return weekDays
    .map(
      (day) => `
      <label>
        <input type="checkbox" data-day-input="1" name="${inputName}" value="${day.jsDay}" ${selected.includes(day.jsDay) ? "checked" : ""} /> ${day.label}
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
      const packageCategory = String(item.trainerCategory || "I");
      const coachPercent = Number(item.coachPercent || 50);

      return `<li>${dateText}: ${item.count} тренировок - ${priceText}, Категория ${packageCategory}, Доля ${coachPercent}%</li>`;
    })
    .join("");
}

function renderHourOptions(selectedHour = 0) {
  return Array.from({ length: 24 }, (_, hour) => {
    const value = String(hour);
    const label = `${String(hour).padStart(2, "0")}:00`;
    const selected = Number(selectedHour) === hour ? "selected" : "";
    return `<option value="${value}" ${selected}>${label}</option>`;
  }).join("");
}

function hourToTimeString(hourValue) {
  const hour = Number(hourValue);
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatMoney(value) {
  return Number(value).toLocaleString("ru-RU");
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
