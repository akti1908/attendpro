import { renderSession } from "./Session.js";

// Журнал занятий на выбранную дату.
export function renderHome(root, ctx) {
  const selectedDate = ctx.state.selectedDate;
  const todayISO = ctx.getTodayISO();
  const lockedByMonth = ctx.actions.isDateLocked(selectedDate);
  const editAllowed = ctx.actions.isEditingAllowedForSelectedDate();
  const showEditToggle = selectedDate !== todayISO;
  const sessions = ctx.getSessionsForDate(selectedDate);
  const selectedDateLabel = ctx.formatDate(selectedDate);

  root.innerHTML = `
    <section class="card" data-journal-swipe-surface="1">
      <h2 class="section-title">Журнал посещаемости</h2>
      <div class="date-toolbar">
        <button id="prev-day" class="btn small-btn day-arrow-btn" aria-label="Предыдущий день" title="Предыдущий день">◀</button>
        <button id="selected-date-display" class="btn small-btn date-center-btn" type="button">${selectedDateLabel}</button>
        <button id="next-day" class="btn small-btn day-arrow-btn" aria-label="Следующий день" title="Следующий день">▶</button>
      </div>
      <input id="selected-date" class="date-picker-hidden" type="date" value="${selectedDate}" />
      ${showEditToggle
        ? `
          <div class="home-edit-row">
            <button id="toggle-edit" class="btn small-btn ${ctx.state.editMode ? "btn-active" : ""}" ${lockedByMonth ? "disabled" : ""}>
              ${lockedByMonth
                ? "Месяц закрыт"
                : ctx.state.editMode
                  ? "Редактирование: ВКЛ"
                  : "Редактировать"}
            </button>
          </div>
        `
        : ""}
      ${lockedByMonth ? `<p class="locked-note">Дата относится к закрытому месяцу. Изменения заблокированы.</p>` : ""}
      <div id="day-list" class="list-scroll"></div>
      <div class="tools-row section-gap">
        <button id="send-today-report" class="btn small-btn">Отправить отчет за выбранный день в Telegram</button>
        <p id="send-today-report-message" class="muted small-note"></p>
      </div>
    </section>
  `;

  bindJournalSwipeNavigation(root, ctx);

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

  const datePicker = root.querySelector("#selected-date");
  const dateDisplay = root.querySelector("#selected-date-display");
  dateDisplay?.addEventListener("click", () => {
    if (!datePicker) return;
    if (typeof datePicker.showPicker === "function") {
      datePicker.showPicker();
      return;
    }
    datePicker.focus();
    datePicker.click();
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

  const sendTodayReportButton = root.querySelector("#send-today-report");
  const sendTodayReportMessage = root.querySelector("#send-today-report-message");
  sendTodayReportButton?.addEventListener("click", async () => {
    sendTodayReportButton.disabled = true;
    if (sendTodayReportMessage) {
      sendTodayReportMessage.textContent = "Отправка...";
      sendTodayReportMessage.classList.remove("auth-error", "auth-success");
    }

    const result = await ctx.actions.sendTodayReportToTelegram(selectedDate);

    if (sendTodayReportMessage) {
      sendTodayReportMessage.textContent = result?.message || "Не удалось отправить отчет.";
      sendTodayReportMessage.classList.toggle("auth-success", Boolean(result?.ok));
      sendTodayReportMessage.classList.toggle("auth-error", !result?.ok);
    }

    sendTodayReportButton.disabled = false;
  });
}

function bindJournalSwipeNavigation(root, ctx) {
  const swipeSurface = root.querySelector("[data-journal-swipe-surface='1']");
  if (!swipeSurface) return;

  const SWIPE_DISTANCE_PX = 56;
  const SWIPE_DOMINANCE_RATIO = 1.2;
  const MAX_VERTICAL_DRIFT_PX = 96;

  const state = {
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    active: false
  };

  const readTouchPoint = (touchList) => {
    if (!touchList || !touchList.length) return null;
    const touch = touchList[0];
    if (!touch) return null;
    return { x: touch.clientX, y: touch.clientY };
  };

  swipeSurface.addEventListener(
    "touchstart",
    (event) => {
      if (!event.touches || event.touches.length !== 1) return;

      const point = readTouchPoint(event.touches);
      if (!point) return;

      state.startX = point.x;
      state.startY = point.y;
      state.lastX = point.x;
      state.lastY = point.y;
      state.active = true;
    },
    { passive: true }
  );

  swipeSurface.addEventListener(
    "touchmove",
    (event) => {
      if (!state.active) return;
      const point = readTouchPoint(event.touches);
      if (!point) return;

      state.lastX = point.x;
      state.lastY = point.y;
    },
    { passive: true }
  );

  swipeSurface.addEventListener(
    "touchend",
    (event) => {
      if (!state.active) {
        state.active = false;
        return;
      }

      const point = readTouchPoint(event.changedTouches) || { x: state.lastX, y: state.lastY };
      const deltaX = point.x - state.startX;
      const deltaY = point.y - state.startY;

      state.active = false;

      if (Math.abs(deltaX) < SWIPE_DISTANCE_PX) return;
      if (Math.abs(deltaY) > MAX_VERTICAL_DRIFT_PX) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY) * SWIPE_DOMINANCE_RATIO) return;

      if (deltaX < 0) {
        ctx.actions.shiftSelectedDate(1);
      } else {
        ctx.actions.shiftSelectedDate(-1);
      }
    },
    { passive: true }
  );

  swipeSurface.addEventListener(
    "touchcancel",
    () => {
      state.active = false;
    },
    { passive: true }
  );
}
