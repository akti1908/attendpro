import { renderSession } from "./Session.js";

// Журнал занятий на выбранную дату.
export function renderHome(root, ctx) {
  document.body.classList.remove("journal-delete-active");
  const selectedDate = ctx.state.selectedDate;
  const todayISO = ctx.getTodayISO();
  const lockedByMonth = ctx.actions.isDateLocked(selectedDate);
  const editAllowed = ctx.actions.isEditingAllowedForSelectedDate();
  const showEditToggle = selectedDate !== todayISO;
  const sessions = ctx.getSessionsForDate(selectedDate);
  const dutyHours = Array.isArray(ctx.getDutyHoursForDate?.(selectedDate))
    ? ctx.getDutyHoursForDate(selectedDate)
    : [];
  const workHours = getWorkHoursForJournalDate(selectedDate, ctx);
  const selectedWeekDay = getWeekDayLabel(selectedDate, ctx);
  const selectedDateLabel = selectedWeekDay
    ? `${ctx.formatDate(selectedDate)} (${selectedWeekDay})`
    : ctx.formatDate(selectedDate);
  root.innerHTML = `
    <div class="journal-swipe-surface" data-journal-swipe-surface="1">
      <div class="journal-focus-overlay is-hidden" data-journal-focus-overlay="1" aria-hidden="true"></div>
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
      <div class="journal-delete-toolbar is-hidden" data-journal-delete-toolbar="1" role="dialog" aria-label="Удаление посещения" aria-modal="true">
        <div class="journal-delete-toolbar-title" data-journal-delete-title="1">Удалить посещение?</div>
        <div class="journal-delete-toolbar-actions">
          <button class="btn small-btn journal-delete-cancel" type="button" data-action="cancel-session-delete-mode">Отмена</button>
          <button class="btn small-btn journal-delete-confirm" type="button" data-action="confirm-session-delete">Удалить посещение</button>
        </div>
      </div>
    </div>
  `;

  bindJournalSwipeNavigation(root, ctx);

  const dayList = root.querySelector("#day-list");
  dayList.innerHTML = renderJournalByHours({
    sessions,
    selectedDate,
    workHours,
    dutyHours,
    editable: editAllowed
  });
  bindJournalLongPressDelete(dayList, editAllowed, ctx);

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

function renderJournalByHours({ sessions, selectedDate, workHours, dutyHours, editable }) {
  const rows = Array.isArray(sessions) ? sessions : [];
  const dutySet = new Set(
    (Array.isArray(dutyHours) ? dutyHours : [])
      .map((hour) => Number(hour))
      .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23)
  );
  const bucket = new Map();
  const sessionHours = [];

  rows.forEach((entry) => {
    const hour = getSessionStartHour(entry);
    if (!Number.isInteger(hour)) return;
    sessionHours.push(hour);
    if (!bucket.has(hour)) bucket.set(hour, []);
    bucket.get(hour).push(entry);
  });

  const rangeHours = buildJournalHourRange({
    workHours,
    sessionHours,
    dutyHours: [...dutySet]
  });

  if (!rangeHours.length) {
    return `<p class="muted">На выбранный день занятий нет.</p>`;
  }

  return rangeHours
    .map((hour) => {
      const entries = bucket.get(hour) || [];
      const hasSessions = entries.length > 0;
      const isDutyHour = dutySet.has(hour);
      const hourLabel = formatHour(hour);
      const blockClass = [
        "journal-hour-block",
        hasSessions ? "has-sessions" : "is-empty",
        isDutyHour ? "is-duty-hour" : ""
      ].filter(Boolean).join(" ");

      const content = hasSessions
        ? entries.map((entry) => renderSession(entry, { editable })).join("")
        : `
          <article class="journal-empty-slot ${isDutyHour ? "is-duty-window" : ""}">
            <strong>${isDutyHour ? "Дежурство" : "Окошко"}</strong>
            <span class="muted">${isDutyHour ? "Свободно" : "Никого"}</span>
          </article>
        `;

      return `
        <section class="${blockClass}" data-hour-block="${hour}" data-date="${selectedDate}">
          <header class="journal-hour-head">
            <strong class="journal-hour-label">${hourLabel}</strong>
            ${isDutyHour ? `<span class="journal-hour-duty-tag">Дежурство</span>` : ""}
          </header>
          <div class="journal-hour-content">
            ${content}
          </div>
        </section>
      `;
    })
    .join("");
}

function getSessionStartHour(entry) {
  const raw = String(entry?.data?.time || "").trim();
  if (!raw) return null;
  const hour = Number(raw.slice(0, 2));
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

function getWorkHoursForJournalDate(dateISO, ctx) {
  const workSchedule = ctx?.workSchedule || {};
  const days = Array.isArray(workSchedule.days) ? workSchedule.days.map((day) => Number(day)) : [];
  const startHour = Number(workSchedule.startHour);
  const endHour = Number(workSchedule.endHour);
  if (!Number.isInteger(startHour) || !Number.isInteger(endHour)) return [];

  const date = parseISODateSafe(dateISO);
  if (!date) return [];
  if (days.length && !days.includes(date.getDay())) return [];

  const minHour = Math.max(0, Math.min(23, Math.min(startHour, endHour)));
  const maxHour = Math.max(0, Math.min(23, Math.max(startHour, endHour)));
  const hours = [];
  for (let hour = minHour; hour <= maxHour; hour += 1) {
    hours.push(hour);
  }
  return hours;
}

function buildJournalHourRange({ workHours, sessionHours, dutyHours }) {
  const source = [
    ...(Array.isArray(workHours) ? workHours : []),
    ...(Array.isArray(sessionHours) ? sessionHours : []),
    ...(Array.isArray(dutyHours) ? dutyHours : [])
  ]
    .map((hour) => Number(hour))
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23);

  if (!source.length) return [];
  const minHour = Math.min(...source);
  const maxHour = Math.max(...source);
  const range = [];
  for (let hour = minHour; hour <= maxHour; hour += 1) {
    range.push(hour);
  }
  return range;
}

function parseISODateSafe(value) {
  const parts = String(value || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatHour(hour) {
  const normalized = Number(hour);
  if (!Number.isInteger(normalized)) return "00:00";
  return `${String(normalized).padStart(2, "0")}:00`;
}

function bindJournalLongPressDelete(dayList, editAllowed, ctx) {
  if (!dayList || !editAllowed || !ctx?.actions) return;

  const cards = [...dayList.querySelectorAll("[data-session-card]")];
  if (!cards.length) return;

  const overlay = document.querySelector("[data-journal-focus-overlay='1']");
  const toolbar = document.querySelector("[data-journal-delete-toolbar='1']");
  const toolbarTitle = toolbar?.querySelector("[data-journal-delete-title='1']");
  const cancelButton = toolbar?.querySelector("[data-action='cancel-session-delete-mode']");
  const confirmButton = toolbar?.querySelector("[data-action='confirm-session-delete']");
  if (!overlay || !toolbar || !confirmButton || !cancelButton) return;

  const LONG_PRESS_MS = 550;
  const interactiveSelector = "button, input, select, textarea, label, a, [role='button']";

  let timerId = null;
  let holdCard = null;
  let activeCard = null;
  let activeDeleteMeta = null;

  const clearHoldTimer = () => {
    if (!timerId) return;
    clearTimeout(timerId);
    timerId = null;
  };

  const hideDeleteMode = () => {
    clearHoldTimer();
    holdCard = null;
    activeCard = null;
    activeDeleteMeta = null;

    cards.forEach((card) => {
      card.classList.remove("session-delete-mode", "session-delete-focused");
    });

    toolbar.classList.add("is-hidden");
    overlay.classList.add("is-hidden");
    document.body.classList.remove("journal-delete-active");
    toolbar.style.removeProperty("left");
    toolbar.style.removeProperty("top");
    toolbar.style.removeProperty("width");
    confirmButton.textContent = "Удалить посещение";
    confirmButton.classList.remove("is-restore");
    if (toolbarTitle) toolbarTitle.textContent = "Удалить посещение?";
  };

  const placeDeleteDialogNearCard = () => {
    if (!activeCard) return;
    const rect = activeCard.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const viewportPadding = 12;
    const dialogWidth = Math.min(
      Math.max(280, rect.width),
      window.innerWidth - viewportPadding * 2
    );

    toolbar.style.width = `${dialogWidth}px`;
    toolbar.style.left = `${Math.max(
      viewportPadding,
      Math.min(rect.left, window.innerWidth - dialogWidth - viewportPadding)
    )}px`;

    let top = rect.bottom + 10;
    const dialogHeight = Math.max(96, toolbar.offsetHeight || 126);
    if (top + dialogHeight > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, rect.top - dialogHeight - 10);
    }
    toolbar.style.top = `${top}px`;
  };

  const resolveDeleteMeta = (card) => {
    const entryType = String(card?.dataset.entryType || "").trim();
    const status = String(card?.dataset.status || "").trim();
    const sessionId = String(card?.dataset.sessionCard || "").trim();
    if (!entryType || !sessionId) return null;

    const isDeleted = status === "удалено";
    if (entryType === "personal") {
      const studentId = String(card?.dataset.studentId || "").trim();
      if (!studentId) return null;
      return {
        label: isDeleted ? "Вернуть посещение" : "Удалить посещение",
        isRestore: isDeleted,
        run: () => {
          if (isDeleted) ctx.actions.restorePersonalSessionRecord(studentId, sessionId);
          else ctx.actions.deletePersonalSessionRecord(studentId, sessionId);
        }
      };
    }

    if (entryType === "group") {
      const groupId = String(card?.dataset.groupId || "").trim();
      if (!groupId) return null;
      return {
        label: isDeleted ? "Вернуть посещение" : "Удалить посещение",
        isRestore: isDeleted,
        run: () => {
          if (isDeleted) ctx.actions.restoreGroupSessionRecord(groupId, sessionId);
          else ctx.actions.deleteGroupSessionRecord(groupId, sessionId);
        }
      };
    }

    return null;
  };

  const showDeleteMode = (card) => {
    if (!card) return;
    const meta = resolveDeleteMeta(card);
    if (!meta) return;

    hideDeleteMode();
    activeCard = card;
    activeDeleteMeta = meta;
    activeCard.classList.add("session-delete-mode", "session-delete-focused");

    if (toolbarTitle) {
      toolbarTitle.textContent = meta.isRestore ? "Вернуть посещение?" : "Удалить посещение?";
    }
    confirmButton.textContent = meta.label;
    confirmButton.classList.toggle("is-restore", Boolean(meta.isRestore));

    overlay.classList.remove("is-hidden");
    toolbar.classList.remove("is-hidden");
    placeDeleteDialogNearCard();
    document.body.classList.add("journal-delete-active");

    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(14);
    }
  };

  cards.forEach((card) => {
    card.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest(interactiveSelector)) return;

      clearHoldTimer();
      holdCard = card;
      timerId = setTimeout(() => {
        showDeleteMode(holdCard);
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
    if (!activeCard) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("[data-session-card].session-delete-focused")) return;
    hideDeleteMode();
  });

  cancelButton.addEventListener("click", () => {
    hideDeleteMode();
  });

  confirmButton.addEventListener("click", () => {
    const deleteMeta = activeDeleteMeta;
    hideDeleteMode();
    if (!deleteMeta) return;
    deleteMeta.run();
  });

  overlay.addEventListener("click", () => {
    hideDeleteMode();
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
