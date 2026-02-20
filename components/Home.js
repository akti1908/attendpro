import { renderSession } from "./Session.js";

// Журнал занятий на выбранную дату.
export function renderHome(root, ctx) {
  const selectedDate = ctx.state.selectedDate;
  const todayISO = ctx.getTodayISO();
  const lockedByMonth = ctx.actions.isDateLocked(selectedDate);
  const editAllowed = ctx.actions.isEditingAllowedForSelectedDate();
  const showEditToggle = selectedDate !== todayISO;
  const sessions = ctx.getSessionsForDate(selectedDate);

  root.innerHTML = `
    <section class="card">
      <h2 class="section-title">Журнал посещаемости</h2>
      <div class="date-toolbar">
        <button id="prev-day" class="btn small-btn">Предыдущий день</button>
        <input id="selected-date" type="date" value="${selectedDate}" />
        <button id="next-day" class="btn small-btn">Следующий день</button>
        ${showEditToggle
          ? `
            <button id="toggle-edit" class="btn small-btn ${ctx.state.editMode ? "btn-active" : ""}" ${lockedByMonth ? "disabled" : ""}>
              ${lockedByMonth
                ? "Месяц закрыт"
                : ctx.state.editMode
                  ? "Редактирование: ВКЛ"
                  : "Редактировать"}
            </button>
          `
          : ""}
      </div>
      <p class="muted">${ctx.formatDate(selectedDate)}</p>
      ${lockedByMonth ? `<p class="locked-note">Дата относится к закрытому месяцу. Изменения заблокированы.</p>` : ""}
      <div id="day-list" class="list-scroll"></div>
    </section>
  `;

  const dayList = root.querySelector("#day-list");
  dayList.innerHTML = sessions.length
    ? sessions.map((entry) => renderSession(entry, { editable: editAllowed })).join("")
    : `<p class="muted">На выбранный день занятий нет.</p>`;

  root.querySelector("#prev-day").addEventListener("click", () => {
    ctx.actions.shiftSelectedDate(-1);
  });

  root.querySelector("#next-day").addEventListener("click", () => {
    ctx.actions.shiftSelectedDate(1);
  });

  root.querySelector("#selected-date").addEventListener("change", (event) => {
    ctx.actions.setSelectedDate(event.currentTarget.value);
  });

  const toggleEditButton = root.querySelector("#toggle-edit");
  if (toggleEditButton) {
    toggleEditButton.addEventListener("click", () => {
      if (lockedByMonth) return;
      ctx.actions.toggleEditMode();
    });
  }

  // Локальный режим правки внутри карточки: показываем скрытые кнопки после отметки.
  dayList.querySelectorAll("[data-action='toggle-session-edit']").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editAllowed) return;

      const card = button.closest("[data-session-card]");
      if (!card || card.dataset.marked !== "1") return;

      const controls = card.querySelector("[data-editable-controls='1']");
      if (!controls) return;

      const hidden = controls.classList.contains("is-hidden");
      controls.classList.toggle("is-hidden", !hidden);
      card.classList.toggle("session-editing", hidden);
      button.textContent = hidden ? "Готово" : "Редактировать";
    });
  });

  dayList.querySelectorAll("[data-action='personal-mark']").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editAllowed) return;

      const card = button.closest("[data-session-card]");
      const currentStatus = card?.dataset.status || "";
      const isFinal = currentStatus === "пришел" || currentStatus === "не пришел";

      // Для уже отмеченной тренировки используем принудительное изменение статуса.
      if (selectedDate === todayISO && !isFinal) {
        ctx.actions.markPersonalSession(button.dataset.studentId, button.dataset.sessionId, button.dataset.status);
      } else {
        ctx.actions.forceSetPersonalStatus(button.dataset.studentId, button.dataset.sessionId, button.dataset.status);
      }
    });
  });

  dayList.querySelectorAll("[data-action='personal-reschedule']").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editAllowed) return;
      ctx.actions.reschedulePersonalSession(button.dataset.studentId, button.dataset.sessionId);
    });
  });

  dayList.querySelectorAll("[data-action='group-attendance']").forEach((input) => {
    input.addEventListener("change", () => {
      if (!editAllowed || !input.checked) return;

      ctx.actions.setGroupAttendance(
        input.dataset.groupId,
        input.dataset.sessionId,
        input.dataset.studentId,
        input.dataset.value
      );
    });
  });
}
