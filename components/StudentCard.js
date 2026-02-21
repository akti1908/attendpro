const MINI_GROUP_MIN_PARTICIPANTS = 3;
const MINI_GROUP_MAX_PARTICIPANTS = 5;

// Карточка персональной/сплит/мини-группы тренировки.
export function renderStudentCard(student, ctx) {
  const packageOptions = ctx.packageOptions[student.trainingType] || [];
  const packageSelect = renderPackageOptions(packageOptions, student.totalTrainings, student.trainingType);
  const packageHistory = renderPackageHistory(student, ctx);
  const isSplit = student.trainingType === "split";
  const isMiniGroup = student.trainingType === "mini_group";

  const upcomingSessions = student.sessions
    .slice()
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 8)
    .map((session) => `<li>${ctx.formatDate(session.date)} в ${session.time} - <strong>${escapeHtml(session.status)}</strong></li>`)
    .join("");

  const editDayInputs = renderDayCheckboxes(ctx.weekDays, student.scheduleDays, `student-edit-day-${student.id}`);
  const typeLabel = isSplit ? "Сплит" : isMiniGroup ? "Мини-группа" : "Персональная";
  const participantsLabel = isSplit
    ? `${student.participants[0] || ""} + ${student.participants[1] || ""}`
    : isMiniGroup
      ? student.participants.join(", ")
      : student.participants[0] || "";

  const safeName = escapeHtml(student.name);
  const safeParticipantsLabel = escapeHtml(participantsLabel);
  const searchText = `${student.name} ${participantsLabel} ${typeLabel}`.toLowerCase();
  const activePackagePrice = (isSplit || isMiniGroup)
    ? `${formatMoney(student.activePackage?.pricePerPerson || 0)} сом/чел`
    : `${formatMoney(student.activePackage?.totalPrice || 0)} сом`;

  const activePackageCategory = String(student.activePackage?.trainerCategory || "I");
  const selectedHour = Number(String(student.time || "00:00").slice(0, 2));
  const miniMembersValue = escapeAttr((student.participants || []).join(", "));
  const primaryFieldValue = isMiniGroup
    ? (student.name || "")
    : (student.participants[0] || student.name || "");
  const miniParticipantsCount = Number(student.activePackage?.participantsCount || student.participants.length || 0);

  return `
    <article
      class="card card-item"
      data-student-card="${student.id}"
      data-training-type="${student.trainingType}"
      data-search-text="${escapeAttr(searchText)}"
    >
      <div class="card-head">
        <h3>${safeName}</h3>
        <button class="btn small-btn" type="button" data-action="toggle-student-edit" data-student-id="${student.id}">Редактировать</button>
      </div>

      <p class="muted">Формат: ${typeLabel}</p>
      <p class="muted">Участники: ${safeParticipantsLabel}</p>
      <p class="muted">Осталось: ${student.remainingTrainings} / ${student.totalTrainings}</p>
      <p class="muted">Текущий пакет: ${student.totalTrainings} тренировок / ${activePackagePrice} / Категория ${activePackageCategory}</p>
      ${isMiniGroup ? `<p class="muted">Размер мини-группы в пакете: ${miniParticipantsCount} чел.</p>` : ""}
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
          <input
            data-student-field="primary-name"
            type="text"
            value="${escapeAttr(primaryFieldValue)}"
            placeholder="${isMiniGroup ? "Название мини-группы (необязательно)" : "Имя ученика"}"
          />
          ${isSplit
            ? `<input data-student-field="secondary-name" type="text" value="${escapeAttr(student.participants[1] || "")}" placeholder="Имя второго участника" />`
            : ""}
          ${isMiniGroup
            ? `<input data-student-field="mini-members" type="text" value="${miniMembersValue}" placeholder="Участники мини-группы через запятую (3-5)" />`
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

// Экран управления карточками персональных/сплит/мини-групп тренировок.
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
              <option value="mini_group">Мини-группа (3-5 человек)</option>
            </select>
            <input id="primary-name" required name="primaryName" placeholder="Имя ученика" />
            <input id="secondary-name" name="secondaryName" placeholder="Имя второго участника (для сплита)" disabled />
            <input id="mini-members" name="miniMembers" placeholder="Участники мини-группы через запятую (3-5)" disabled />
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
        <input id="students-search" type="text" placeholder="Поиск по карточкам: имя, участники, формат" />
        <p id="students-search-empty" class="muted mt-8 is-hidden">Ничего не найдено.</p>
        <div id="students-list" class="list-scroll"></div>
      </div>
    </section>
  `;

  const typeSelect = root.querySelector("#training-type");
  const packageSelect = root.querySelector("#package-select");
  const primaryName = root.querySelector("#primary-name");
  const secondName = root.querySelector("#secondary-name");
  const miniMembers = root.querySelector("#mini-members");

  const syncFormByType = () => {
    const type = String(typeSelect.value || "personal");

    secondName.disabled = type !== "split";
    secondName.required = type === "split";
    if (type !== "split") secondName.value = "";

    miniMembers.disabled = type !== "mini_group";
    miniMembers.required = type === "mini_group";
    if (type !== "mini_group") miniMembers.value = "";

    if (type === "mini_group") {
      primaryName.required = false;
      primaryName.placeholder = "Название мини-группы (необязательно)";
    } else if (type === "split") {
      primaryName.required = true;
      primaryName.placeholder = "Имя первого участника";
    } else {
      primaryName.required = true;
      primaryName.placeholder = "Имя ученика";
    }

    packageSelect.innerHTML = renderPackageOptions(ctx.packageOptions[type], 10, type);
  };

  typeSelect.addEventListener("change", syncFormByType);
  syncFormByType();

  root.querySelector("#student-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const trainingType = String(formData.get("trainingType") || "personal");
    const scheduleDays = [...root.querySelectorAll('input[name="student-day"]:checked')].map((item) => Number(item.value));
    const miniNames = parseParticipantsInput(formData.get("miniMembers"));

    if (!scheduleDays.length) {
      alert("Выберите хотя бы один день недели.");
      return;
    }

    if (trainingType === "split" && !String(formData.get("secondaryName") || "").trim()) {
      alert("Для сплита нужно указать второго участника.");
      return;
    }

    if (trainingType === "mini_group") {
      if (miniNames.length < MINI_GROUP_MIN_PARTICIPANTS || miniNames.length > MINI_GROUP_MAX_PARTICIPANTS) {
        alert("В мини-группе должно быть от 3 до 5 учеников.");
        return;
      }
    }

    ctx.actions.addStudent({
      trainingType,
      primaryName: formData.get("primaryName"),
      secondaryName: formData.get("secondaryName"),
      memberNames: miniNames,
      packageCount: Number(formData.get("packageCount")),
      scheduleDays,
      time: hourToTimeString(formData.get("hour"))
    });
  });

  const studentsList = root.querySelector("#students-list");
  studentsList.innerHTML = ctx.state.students.length
    ? ctx.state.students.map((student) => renderStudentCard(student, ctx)).join("")
    : `<p class="muted">Карточек пока нет.</p>`;

  const studentsSearchInput = root.querySelector("#students-search");
  const studentsSearchEmpty = root.querySelector("#students-search-empty");
  const applyStudentsFilter = () => {
    const query = String(studentsSearchInput?.value || "").trim().toLowerCase();
    const cards = [...studentsList.querySelectorAll("[data-student-card]")];
    if (!cards.length) {
      studentsSearchEmpty?.classList.add("is-hidden");
      return;
    }

    let visibleCount = 0;
    cards.forEach((card) => {
      const searchText = String(card.dataset.searchText || "").toLowerCase();
      const matched = !query || searchText.includes(query);
      card.classList.toggle("is-hidden", !matched);
      if (matched) visibleCount += 1;
    });

    if (studentsSearchEmpty) {
      const shouldShowEmpty = Boolean(query) && visibleCount === 0;
      studentsSearchEmpty.classList.toggle("is-hidden", !shouldShowEmpty);
    }
  };

  studentsSearchInput?.addEventListener("input", applyStudentsFilter);
  applyStudentsFilter();

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

      const primaryNameValue = String(panel.querySelector('[data-student-field="primary-name"]')?.value || "").trim();
      const secondaryNameValue = String(panel.querySelector('[data-student-field="secondary-name"]')?.value || "").trim();
      const miniMembersValue = parseParticipantsInput(panel.querySelector('[data-student-field="mini-members"]')?.value || "");
      const hour = String(panel.querySelector('[data-student-field="hour"]')?.value || "0");
      const scheduleDays = [...panel.querySelectorAll('input[data-day-input="1"]:checked')].map((item) => Number(item.value));

      ctx.actions.updateStudentCardData(button.dataset.studentId, {
        primaryName: primaryNameValue,
        secondaryName: secondaryNameValue,
        memberNames: miniMembersValue,
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
  return (options || [])
    .map((item) => {
      const selected = Number(selectedCount) === Number(item.count) ? "selected" : "";
      const isPerPerson = type === "split" || type === "mini_group";
      const label = isPerPerson
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
      const isPerPerson = student.trainingType === "split" || student.trainingType === "mini_group";
      const priceText = isPerPerson
        ? `${formatMoney(item.pricePerPerson || 0)} сом/чел`
        : `${formatMoney(item.totalPrice || 0)} сом`;
      const packageCategory = String(item.trainerCategory || "I");
      const participantsPart = student.trainingType === "mini_group"
        ? `, Участников: ${Number(item.participantsCount || student.participants.length || 0)}`
        : "";

      return `<li>${dateText}: ${item.count} тренировок - ${priceText}, Категория ${packageCategory}${participantsPart}</li>`;
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

function parseParticipantsInput(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
