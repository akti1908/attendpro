import { renderSession } from "./Session.js";

// Журнал занятий на выбранную дату.
export function renderHome(root, ctx) {
  const selectedDate = ctx.state.selectedDate;
  const todayISO = ctx.getTodayISO();
  const lockedByMonth = ctx.actions.isDateLocked(selectedDate);
  const editAllowed = ctx.actions.isEditingAllowedForSelectedDate();
  const showEditToggle = selectedDate !== todayISO;
  const sessions = ctx.getSessionsForDate(selectedDate);
  const selectedWeekDay = getWeekDayLabel(selectedDate, ctx);
  const selectedDateLabel = selectedWeekDay
    ? `${ctx.formatDate(selectedDate)} (${selectedWeekDay})`
    : ctx.formatDate(selectedDate);
  root.innerHTML = `
    <div class="journal-swipe-surface" data-journal-swipe-surface="1">
      <section class="card journal-card">
        <h2 class="section-title">Журнал посещаемости</h2>
        <div class="date-toolbar">
          <button id="prev-day" class="btn small-btn day-arrow-btn" aria-label="Предыдущий день" title="Предыдущий день">◀</button>
          <div class="date-center-wrap">
            <button id="selected-date-display" class="btn small-btn date-center-btn" type="button">${selectedDateLabel}</button>
            <input id="selected-date" class="date-picker-overlay" type="date" value="${selectedDate}" aria-label="Выбрать дату" />
          </div>
          <button id="next-day" class="btn small-btn day-arrow-btn" aria-label="Следующий день" title="Следующий день">▶</button>
        </div>
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
    </div>
  `;

  bindJournalSwipeNavigation(root, ctx);

  const dayList = root.querySelector("#day-list");
  dayList.innerHTML = sessions.length
    ? sessions.map((entry) => renderSession(entry, { editable: editAllowed })).join("")
    : `<p class="muted">На выбранный день занятий нет.</p>`;
  bindJournalLongPressDelete(dayList, editAllowed);

  root.querySelector("#prev-day").addEventListener("click", () => {
    ctx.actions.shiftSelectedDate(-1);
  });

  root.querySelector("#next-day").addEventListener("click", () => {
    ctx.actions.shiftSelectedDate(1);
  });

  const datePicker = root.querySelector("#selected-date");
  const dateDisplay = root.querySelector("#selected-date-display");
  const dateWrap = root.querySelector(".date-center-wrap");

  const openDatePickerFallback = () => {
    if (!datePicker) return;

    try {
      if (typeof datePicker.showPicker === "function") {
        datePicker.showPicker();
        return;
      }
    } catch (_error) {
      // no-op: перейдем к безопасному fallback ниже
    }

    try {
      datePicker.focus({ preventScroll: true });
      datePicker.click();
    } catch (_error) {
      // no-op
    }
  };

  dateDisplay?.addEventListener("click", openDatePickerFallback);
  dateDisplay?.addEventListener("touchend", (event) => {
    event.preventDefault();
    openDatePickerFallback();
  });
  dateWrap?.addEventListener("click", () => {
    // Фолбэк для браузеров, где прозрачный input не получает tap стабильно.
    openDatePickerFallback();
  });

  datePicker?.addEventListener("change", (event) => {
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

  dayList.querySelectorAll("[data-action='personal-reschedule-toggle']").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editAllowed) return;

      const card = button.closest("[data-session-card]");
      const menu = card?.querySelector("[data-reschedule-menu='1']");
      if (!menu) return;
      menu.classList.toggle("is-hidden");
    });
  });

  dayList.querySelectorAll("[data-action='personal-reschedule-by-schedule']").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editAllowed) return;
      ctx.actions.reschedulePersonalSession(
        button.dataset.studentId,
        button.dataset.sessionId,
        { mode: "schedule" }
      );
    });
  });

  dayList.querySelectorAll("[data-action='personal-reschedule-date-toggle']").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editAllowed) return;
      const card = button.closest("[data-session-card]");
      const panel = card?.querySelector("[data-transfer-date-panel='1']");
      if (!panel) return;
      panel.classList.toggle("is-hidden");
    });
  });

  dayList.querySelectorAll("[data-action='personal-reschedule-by-date']").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editAllowed) return;
      const card = button.closest("[data-session-card]");
      const dateInput = card?.querySelector("[data-transfer-date-input='1']");
      const targetDate = String(dateInput?.value || "").trim();
      ctx.actions.reschedulePersonalSession(
        button.dataset.studentId,
        button.dataset.sessionId,
        { mode: "date", targetDate }
      );
    });
  });

  dayList.querySelectorAll("[data-action='personal-delete-session']").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editAllowed) return;
      ctx.actions.deletePersonalSessionRecord(button.dataset.studentId, button.dataset.sessionId);
    });
  });

  dayList.querySelectorAll("[data-action='personal-restore-session']").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editAllowed) return;
      ctx.actions.restorePersonalSessionRecord(button.dataset.studentId, button.dataset.sessionId);
    });
  });

  dayList.querySelectorAll("[data-action='group-attendance']").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editAllowed) return;

      ctx.actions.setGroupAttendance(
        button.dataset.groupId,
        button.dataset.sessionId,
        button.dataset.studentId,
        button.dataset.value
      );
    });
  });

  dayList.querySelectorAll("[data-action='group-delete-session']").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editAllowed) return;
      ctx.actions.deleteGroupSessionRecord(button.dataset.groupId, button.dataset.sessionId);
    });
  });

  dayList.querySelectorAll("[data-action='group-restore-session']").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editAllowed) return;
      ctx.actions.restoreGroupSessionRecord(button.dataset.groupId, button.dataset.sessionId);
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

    try {
      const result = await ctx.actions.sendTodayReportToTelegram(selectedDate);

      if (sendTodayReportMessage) {
        sendTodayReportMessage.textContent = result?.message || "Не удалось отправить отчет.";
        sendTodayReportMessage.classList.toggle("auth-success", Boolean(result?.ok));
        sendTodayReportMessage.classList.toggle("auth-error", !result?.ok);
      }
    } catch (error) {
      console.error("Send report button handler error:", error);
      if (sendTodayReportMessage) {
        sendTodayReportMessage.textContent = "Не удалось отправить отчет из-за внутренней ошибки.";
        sendTodayReportMessage.classList.remove("auth-success");
        sendTodayReportMessage.classList.add("auth-error");
      }
    } finally {
      sendTodayReportButton.disabled = false;
    }
  });
}

function bindJournalLongPressDelete(dayList, editAllowed) {
  if (!dayList || !editAllowed) return;

  const cards = [...dayList.querySelectorAll("[data-session-card]")];
  if (!cards.length) return;

  const LONG_PRESS_MS = 550;
  const interactiveSelector = "button, input, select, textarea, label, a, [role='button']";

  let timerId = null;
  let holdCard = null;

  const hideAllDeletePanels = () => {
    cards.forEach((card) => {
      const panel = card.querySelector("[data-long-press-delete='1']");
      if (panel) panel.classList.add("is-hidden");
      card.classList.remove("session-delete-mode");
    });
  };

  const clearHoldTimer = () => {
    if (!timerId) return;
    clearTimeout(timerId);
    timerId = null;
  };

  const showDeletePanel = (card) => {
    if (!card) return;
    hideAllDeletePanels();
    const panel = card.querySelector("[data-long-press-delete='1']");
    if (!panel) return;
    panel.classList.remove("is-hidden");
    card.classList.add("session-delete-mode");
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(12);
    }
  };

  cards.forEach((card) => {
    card.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest(interactiveSelector)) return;

      clearHoldTimer();
      holdCard = card;
      timerId = setTimeout(() => {
        showDeletePanel(holdCard);
      }, LONG_PRESS_MS);
    });

    const cancelHold = () => {
      clearHoldTimer();
      holdCard = null;
    };

    card.addEventListener("pointerup", cancelHold);
    card.addEventListener("pointercancel", cancelHold);
    card.addEventListener("pointerleave", cancelHold);
  });

  dayList.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("[data-long-press-delete='1']")) return;
    if (target.closest("[data-session-card].session-delete-mode")) return;
    hideAllDeletePanels();
  });
}

function getWeekDayLabel(dateISO, ctx) {
  const parts = String(dateISO || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return "";
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return "";

  if (typeof ctx.dayLabel === "function") {
    return String(ctx.dayLabel(date.getDay()) || "").trim();
  }
  return "";
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

  let windowListenersAttached = false;
  const removeWindowTouchListeners = () => {
    if (!windowListenersAttached) return;
    window.removeEventListener("touchmove", onWindowTouchMove);
    window.removeEventListener("touchend", onWindowTouchEnd);
    window.removeEventListener("touchcancel", onWindowTouchCancel);
    windowListenersAttached = false;
  };

  const finalizeSwipe = (point) => {
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
  };

  const onWindowTouchMove = (event) => {
    if (!state.active) return;
    const point = readTouchPoint(event.touches);
    if (!point) return;

    state.lastX = point.x;
    state.lastY = point.y;
  };

  const onWindowTouchEnd = (event) => {
    if (!state.active) {
      removeWindowTouchListeners();
      return;
    }

    const point = readTouchPoint(event.changedTouches) || { x: state.lastX, y: state.lastY };
    removeWindowTouchListeners();
    finalizeSwipe(point);
  };

  const onWindowTouchCancel = () => {
    state.active = false;
    removeWindowTouchListeners();
  };

  swipeSurface.addEventListener(
    "touchstart",
    (event) => {
      if (!event.touches || event.touches.length !== 1) return;

      const targetElement = event.target instanceof Element ? event.target : null;
      const interactiveTarget = targetElement
        ? targetElement.closest("button, input, select, textarea, label, a, [role='button']")
        : null;
      if (interactiveTarget) {
        state.active = false;
        removeWindowTouchListeners();
        return;
      }

      const point = readTouchPoint(event.touches);
      if (!point) return;

      state.startX = point.x;
      state.startY = point.y;
      state.lastX = point.x;
      state.lastY = point.y;
      state.active = true;
      if (!windowListenersAttached) {
        window.addEventListener("touchmove", onWindowTouchMove, { passive: true });
        window.addEventListener("touchend", onWindowTouchEnd, { passive: true });
        window.addEventListener("touchcancel", onWindowTouchCancel, { passive: true });
        windowListenersAttached = true;
      }
    },
    { passive: true }
  );
}
