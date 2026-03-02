const MINI_GROUP_MIN_PARTICIPANTS = 3;
const MINI_GROUP_MAX_PARTICIPANTS = 5;

// Карточка персональной/сплит/мини-группы тренировки.
export function renderStudentCard(student, ctx) {
  const activationDate = normalizeDateISO(student.activationDate, ctx.getTodayISO());
  const packageOptions = ctx.packageOptions[student.trainingType] || [];
  const packageSelect = renderPackageOptions(packageOptions, student.totalTrainings, student.trainingType);
  const packageHistory = renderPackageHistory(student, ctx);
  const isSplit = student.trainingType === "split";
  const isMiniGroup = student.trainingType === "mini_group";
  const allowedWorkDays = normalizeAllowedDays(ctx.workSchedule?.days);
  const availableHours = resolveAvailableHours(
    typeof ctx.getWorkHoursForDays === "function" ? ctx.getWorkHoursForDays(student.scheduleDays) : ctx.workHours
  );
  const scheduleSlots = normalizeScheduleSlots(student.scheduleSlots, student.scheduleDays, student.time);
  const scheduleSummary = formatScheduleSummary(student.scheduleDays, scheduleSlots, ctx);

  const upcomingSessions = student.sessions
    .slice()
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 8)
    .map((session) => `<li>${ctx.formatDate(session.date)} в ${session.time} - <strong>${escapeHtml(session.status)}</strong></li>`)
    .join("");

  const editDayInputs = renderDayTimeRows(
    ctx.weekDays,
    student.scheduleDays,
    scheduleSlots,
    `student-edit-day-${student.id}`,
    allowedWorkDays,
    availableHours
  );
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
      <p class="muted">Расписание: ${scheduleSummary}</p>

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
          <input data-student-field="activation-date" type="date" value="${activationDate}" />
        </div>

        <p class="muted mt-8">Дни и часы</p>
        <div class="day-time-grid mt-8" data-day-time-root="1" data-edit-days-container="${student.id}">
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

function renderStudentCardPreview(student, ctx) {
  const isSplit = student.trainingType === "split";
  const isMiniGroup = student.trainingType === "mini_group";
  const typeLabel = isSplit ? "Сплит" : isMiniGroup ? "Мини-группа" : "Персональная";
  const participantsLabel = isSplit
    ? `${student.participants[0] || ""} + ${student.participants[1] || ""}`
    : isMiniGroup
      ? student.participants.join(", ")
      : student.participants[0] || "";
  const searchText = `${student.name} ${participantsLabel} ${typeLabel}`.toLowerCase();
  const activationDate = normalizeDateISO(student.activationDate, ctx.getTodayISO());
  const scheduleSlots = normalizeScheduleSlots(student.scheduleSlots, student.scheduleDays, student.time);
  const scheduleSummary = formatScheduleSummary(student.scheduleDays, scheduleSlots, ctx);

  return `
    <article class="card card-item" data-student-preview="${student.id}" data-search-text="${escapeAttr(searchText)}">
      <div class="card-head">
        <h3>${escapeHtml(student.name)}</h3>
        <button class="btn small-btn" type="button" data-action="open-student-popup" data-student-id="${student.id}">Открыть</button>
      </div>
      <p class="muted">Формат: ${typeLabel}</p>
      <p class="muted">Участники: ${escapeHtml(participantsLabel || "-")}</p>
      <p class="muted">Дата активации: ${ctx.formatDate(activationDate)}</p>
      <p class="muted">Осталось: ${student.remainingTrainings} / ${student.totalTrainings}</p>
      <p class="muted">Расписание: ${scheduleSummary}</p>
    </article>
  `;
}

// Экран управления карточками персональных/сплит/мини-групп тренировок.
export function renderStudentsManager(root, ctx) {
  const allowedWorkDays = normalizeAllowedDays(ctx.workSchedule?.days);
  const availableHours = resolveAvailableHours(ctx.workHours);
  const defaultHour = getDefaultHour(availableHours);
  const defaultActivationDate = normalizeDateISO(ctx.state?.selectedDate, ctx.getTodayISO());

  root.innerHTML = `
    <section class="card">
      <div class="card-head">
        <h2 class="section-title">Карточки</h2>
        <button id="open-student-modal" class="btn small-btn" type="button">Добавить карточку</button>
      </div>
      <input id="students-search" type="text" placeholder="Поиск по карточкам: имя, участники, формат" />
      <p id="students-search-empty" class="muted mt-8 is-hidden">Ничего не найдено.</p>
      <div id="students-list" class="list-scroll"></div>
    </section>

    <div id="student-create-modal" class="form-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="student-modal-title">
      <div class="form-modal-card">
        <div class="form-modal-head">
          <h3 id="student-modal-title">Новая карточка</h3>
          <button class="btn small-btn" type="button" data-action="close-student-modal">Закрыть</button>
        </div>

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
            <input id="activation-date" name="activationDate" type="date" required value="${defaultActivationDate}" />
          </div>

          <p class="muted">Дни и часы</p>
          <div id="student-days" class="day-time-grid" data-day-time-root="1">
            ${renderDayTimeRows(ctx.weekDays, [], {}, "student-day", allowedWorkDays, availableHours, defaultHour)}
          </div>
          <div class="session-actions">
            <button class="btn btn-primary" type="submit">Создать карточку</button>
            <button class="btn" type="button" data-action="close-student-modal">Отмена</button>
          </div>
        </form>
      </div>
    </div>

    <div id="student-view-modal" class="form-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="student-view-title">
      <div class="form-modal-card student-view-modal-card">
        <div class="form-modal-head">
          <h3 id="student-view-title">Карточка</h3>
          <button class="btn small-btn" type="button" data-action="close-student-view-modal">Закрыть</button>
        </div>
        <div id="student-view-content"></div>
      </div>
    </div>
  `;

  const typeSelect = root.querySelector("#training-type");
  const packageSelect = root.querySelector("#package-select");
  const primaryName = root.querySelector("#primary-name");
  const secondName = root.querySelector("#secondary-name");
  const miniMembers = root.querySelector("#mini-members");
  const activationDateInput = root.querySelector("#activation-date");
  const studentCreateModal = root.querySelector("#student-create-modal");
  const studentViewModal = root.querySelector("#student-view-modal");
  const studentViewContent = root.querySelector("#student-view-content");
  const openStudentModalButton = root.querySelector("#open-student-modal");
  const studentForm = root.querySelector("#student-form");
  const studentDaysContainer = root.querySelector("#student-days");

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
  bindDayTimeRowEvents(studentDaysContainer);
  syncDayTimeRows(studentDaysContainer);

  const resetStudentForm = () => {
    studentForm?.reset();
    syncFormByType();
    syncDayTimeRows(studentDaysContainer);
    if (activationDateInput) {
      activationDateInput.value = defaultActivationDate;
    }
  };

  const closeStudentModal = () => {
    studentCreateModal?.classList.add("is-hidden");
    document.body.classList.remove("modal-open");
    resetStudentForm();
  };

  const openStudentModal = () => {
    studentViewModal?.classList.add("is-hidden");
    studentCreateModal?.classList.remove("is-hidden");
    document.body.classList.add("modal-open");
    syncFormByType();
    if (activationDateInput) {
      activationDateInput.value = defaultActivationDate;
    }
    primaryName?.focus();
  };

  openStudentModalButton?.addEventListener("click", openStudentModal);
  root.querySelectorAll("[data-action='close-student-modal']").forEach((button) => {
    button.addEventListener("click", closeStudentModal);
  });

  studentCreateModal?.addEventListener("click", (event) => {
    if (event.target === studentCreateModal) closeStudentModal();
  });

  const closeStudentViewModal = () => {
    studentViewModal?.classList.add("is-hidden");
    if (studentViewContent) {
      studentViewContent.innerHTML = "";
    }
    document.body.classList.remove("modal-open");
  };

  const openStudentViewModal = (studentId) => {
    const student = ctx.state.students.find((item) => item.id === studentId);
    if (!student || !studentViewContent) return;

    studentCreateModal?.classList.add("is-hidden");
    studentViewContent.innerHTML = renderStudentCard(student, ctx);
    bindStudentCardActions(studentViewContent, ctx);
    studentViewModal?.classList.remove("is-hidden");
    document.body.classList.add("modal-open");
  };

  root.querySelectorAll("[data-action='close-student-view-modal']").forEach((button) => {
    button.addEventListener("click", closeStudentViewModal);
  });

  studentViewModal?.addEventListener("click", (event) => {
    if (event.target === studentViewModal) closeStudentViewModal();
  });

  studentForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const trainingType = String(formData.get("trainingType") || "personal");
    const scheduleConfig = collectScheduleConfig(studentDaysContainer);
    const { scheduleDays, scheduleSlots, time } = scheduleConfig;
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
    document.body.classList.remove("modal-open");
    ctx.actions.addStudent({
      trainingType,
      primaryName: formData.get("primaryName"),
      secondaryName: formData.get("secondaryName"),
      memberNames: miniNames,
      packageCount: Number(formData.get("packageCount")),
      activationDate: String(formData.get("activationDate") || ""),
      scheduleDays,
      scheduleSlots,
      time
    });
  });

  const studentsList = root.querySelector("#students-list");
  studentsList.innerHTML = ctx.state.students.length
    ? ctx.state.students.map((student) => renderStudentCardPreview(student, ctx)).join("")
    : `<p class="muted">Карточек пока нет.</p>`;

  const studentsSearchInput = root.querySelector("#students-search");
  const studentsSearchEmpty = root.querySelector("#students-search-empty");
  const applyStudentsFilter = () => {
    const query = String(studentsSearchInput?.value || "").trim().toLowerCase();
    const cards = [...studentsList.querySelectorAll("[data-student-preview]")];
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

  studentsList.querySelectorAll("[data-action='open-student-popup']").forEach((button) => {
    button.addEventListener("click", () => {
      openStudentViewModal(button.dataset.studentId);
    });
  });
}

function bindStudentCardActions(container, ctx) {
  if (!container) return;

  container.querySelectorAll("[data-action='toggle-student-edit']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-student-card]");
      if (!card) return;

      const panel = card.querySelector("[data-student-edit-panel]");
      if (!panel) return;

      const willOpen = panel.classList.contains("is-hidden");
      setStudentCardEditMode(card, willOpen);
      if (!willOpen) {
        resetStudentEditPanel(card);
        return;
      }
      bindDayTimeRowEvents(panel);
      syncDayTimeRows(panel);
    });
  });

  container.querySelectorAll("[data-action='cancel-student-edit']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-student-card]");
      if (!card) return;
      resetStudentEditPanel(card);
      setStudentCardEditMode(card, false);
    });
  });

  container.querySelectorAll("[data-action='save-student-edit']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-student-card]");
      const panel = card?.querySelector("[data-student-edit-panel]");
      if (!card || !panel) return;

      const primaryNameValue = String(panel.querySelector('[data-student-field="primary-name"]')?.value || "").trim();
      const secondaryNameValue = String(panel.querySelector('[data-student-field="secondary-name"]')?.value || "").trim();
      const miniMembersValue = parseParticipantsInput(panel.querySelector('[data-student-field="mini-members"]')?.value || "");
      const activationDateValue = String(panel.querySelector('[data-student-field="activation-date"]')?.value || "").trim();
      const scheduleConfig = collectScheduleConfig(panel);
      const { scheduleDays, scheduleSlots, time } = scheduleConfig;

      ctx.actions.updateStudentCardData(button.dataset.studentId, {
        primaryName: primaryNameValue,
        secondaryName: secondaryNameValue,
        memberNames: miniMembersValue,
        activationDate: activationDateValue,
        scheduleDays,
        scheduleSlots,
        time
      });
      document.body.classList.remove("modal-open");
    });
  });

  container.querySelectorAll("[data-action='apply-package']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-student-card]");
      const select = card?.querySelector(`[data-package-select-for='${button.dataset.studentId}']`);
      if (!select) return;
      ctx.actions.addStudentPackage(button.dataset.studentId, Number(select.value));
      document.body.classList.remove("modal-open");
    });
  });

  container.querySelectorAll("[data-action='delete-student']").forEach((button) => {
    button.addEventListener("click", () => {
      const isConfirmed = window.confirm("Удалить карточку? Это действие нельзя отменить.");
      if (!isConfirmed) return;
      ctx.actions.deleteStudentCard(button.dataset.studentId);
      document.body.classList.remove("modal-open");
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
  syncDayTimeRows(panel);
}

function normalizeScheduleSlots(slots, scheduleDays, fallbackTime = "10:00") {
  const source = slots && typeof slots === "object" && !Array.isArray(slots) ? slots : {};
  const normalizedDays = (Array.isArray(scheduleDays) ? scheduleDays : []).map((day) => Number(day));
  const fallback = typeof fallbackTime === "string" ? fallbackTime : "10:00";
  const normalized = {};

  normalizedDays.forEach((day) => {
    if (!Number.isInteger(day)) return;
    const key = String(day);
    const rawTime = source[key] ?? source[day] ?? fallback;
    normalized[key] = normalizeTimeString(rawTime, fallback);
  });

  return normalized;
}

function getScheduleSlotTime(scheduleSlots, dayValue, fallbackTime = "10:00") {
  const day = Number(dayValue);
  const key = String(day);
  const rawTime = scheduleSlots?.[key] ?? scheduleSlots?.[day] ?? fallbackTime;
  return normalizeTimeString(rawTime, fallbackTime);
}

function getPrimaryScheduleTime(scheduleDays, scheduleSlots, fallbackTime = "10:00") {
  const normalizedDays = (Array.isArray(scheduleDays) ? scheduleDays : []).map((day) => Number(day));
  for (const day of normalizedDays) {
    if (!Number.isInteger(day)) continue;
    const key = String(day);
    const raw = scheduleSlots?.[key] ?? scheduleSlots?.[day];
    if (typeof raw === "string") {
      return normalizeTimeString(raw, fallbackTime);
    }
  }
  return normalizeTimeString(fallbackTime, "10:00");
}

function formatScheduleSummary(scheduleDays, scheduleSlots, ctx) {
  if (!Array.isArray(scheduleDays) || !scheduleDays.length) return "-";
  return scheduleDays
    .map((day) => `${ctx.dayLabel(day)} ${getScheduleSlotTime(scheduleSlots, day)}`)
    .join(", ");
}

function renderDayTimeRows(
  weekDays,
  selected = [],
  scheduleSlots = {},
  inputName = "student-day",
  allowedDays = [],
  availableHours = [],
  defaultHour = 10
) {
  const allowedSet = new Set(normalizeAllowedDays(allowedDays));
  const selectedSet = new Set((Array.isArray(selected) ? selected : []).map((item) => Number(item)));
  const resolvedHours = resolveAvailableHours(availableHours);
  const fallbackTime = hourToTimeString(defaultHour);

  return weekDays
    .map((day) => {
      const dayValue = Number(day.jsDay);
      const key = String(dayValue);
      const isAllowed = !allowedSet.size || allowedSet.has(dayValue);
      const checked = selectedSet.has(dayValue) && isAllowed;
      const rowDisabled = !isAllowed ? " is-disabled" : "";
      const slotTime = getScheduleSlotTime(scheduleSlots, dayValue, fallbackTime);
      const selectedHour = Number(slotTime.slice(0, 2));
      const resolvedHour = resolveSelectedHour(selectedHour, resolvedHours);
      const disabled = !isAllowed || !checked ? "disabled" : "";
      const checkboxChecked = checked ? "checked" : "";
      const checkboxDisabled = isAllowed ? "" : "disabled";

      return `
      <div class="day-time-row${rowDisabled}" data-day-time-row="1" data-day-value="${dayValue}">
        <label class="day-time-label">
          <input
            type="checkbox"
            data-day-input="1"
            data-day-checkbox="1"
            name="${inputName}"
            value="${dayValue}"
            ${checkboxChecked}
            ${checkboxDisabled}
          />
          <span>${day.label}</span>
        </label>
        <select data-day-hour-select="1" data-day-value="${key}" ${disabled}>${renderHourOptions(resolvedHours, resolvedHour)}</select>
      </div>
    `;
    })
    .join("");
}

function syncDayTimeRows(container) {
  if (!container) return;
  const rows = container.querySelectorAll("[data-day-time-row='1']");
  rows.forEach((row) => {
    const checkbox = row.querySelector("[data-day-checkbox='1']");
    const select = row.querySelector("[data-day-hour-select='1']");
    if (!checkbox || !select) return;
    const selectShouldBeDisabled = checkbox.disabled || !checkbox.checked;
    select.disabled = selectShouldBeDisabled;
    row.classList.toggle("is-disabled", selectShouldBeDisabled);
  });
}

function bindDayTimeRowEvents(container) {
  if (!container || container.dataset.dayTimeBound === "1") return;
  container.dataset.dayTimeBound = "1";
  container.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.matches("[data-day-checkbox='1']")) return;
    syncDayTimeRows(container);
  });
}

function collectScheduleConfig(container) {
  const rows = container ? [...container.querySelectorAll("[data-day-time-row='1']")] : [];
  const scheduleDays = [];
  const scheduleSlots = {};
  let fallbackTime = "";

  rows.forEach((row) => {
    const checkbox = row.querySelector("[data-day-checkbox='1']");
    const select = row.querySelector("[data-day-hour-select='1']");
    if (!checkbox || !select) return;

    const currentTime = hourToTimeString(select.value);
    if (!fallbackTime) fallbackTime = currentTime;
    if (checkbox.disabled || !checkbox.checked) return;

    const dayValue = Number(checkbox.value);
    if (!Number.isInteger(dayValue)) return;
    scheduleDays.push(dayValue);
    scheduleSlots[String(dayValue)] = currentTime;
  });

  const time = getPrimaryScheduleTime(scheduleDays, scheduleSlots, fallbackTime || "10:00");
  return { scheduleDays, scheduleSlots, time };
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

function parseParticipantsInput(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hourToTimeString(hourValue) {
  const hour = Number(hourValue);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return "10:00";
  return `${String(hour).padStart(2, "0")}:00`;
}

function normalizeTimeString(value, fallback = "10:00") {
  const raw = String(value || "").trim();
  if (/^\d{2}:\d{2}$/.test(raw)) {
    return hourToTimeString(raw.slice(0, 2));
  }
  return hourToTimeString(String(fallback).slice(0, 2));
}

function normalizeDateISO(value, fallback) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return String(fallback || "");
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
