// Страница управления дежурствами.
export function renderDuty(root, ctx) {
  const fallbackMonth = String(ctx.getTodayISO() || "").slice(0, 7);
  const selectedMonth = normalizeMonthValue(ctx.state.dutyMonth || fallbackMonth);
  const report = ctx.getDutyReport(selectedMonth);
  const weekRows = Array.isArray(report.weekRows) ? report.weekRows : [];
  const dutyBoundsLabel = `${formatHour(report.startHour)}-${formatHour(report.endHour + 1)}`;

  root.innerHTML = `
    <section class="card">
      <h2 class="section-title">Дежурство</h2>
      <div class="salary-toolbar">
        <label>
          Месяц:
          <input id="duty-month" type="month" value="${report.monthISO}" />
        </label>
        <p class="muted">Границы дежурства: ${dutyBoundsLabel}</p>
      </div>

      <div class="stats-grid mt-8">
        <div class="stat-card"><span class="muted">Часов дежурства на этой неделе</span><strong>${report.weeklyHours}</strong></div>
        <div class="stat-card"><span class="muted">Часов дежурства за месяц</span><strong>${report.monthHours}</strong></div>
        <div class="stat-card"><span class="muted">Ставка за 1 час</span><strong>${formatMoney(report.hourlyRate)} сом</strong></div>
        <div class="stat-card"><span class="muted">ЗП за дежурство в месяце</span><strong>${formatMoney(report.monthIncome)} сом</strong></div>
      </div>
    </section>

    <section class="card section-gap">
      <div class="duty-header">
        <h3 class="section-title">График дежурства</h3>
        <div class="duty-header-actions">
          <button id="duty-edit-toggle" class="btn small-btn" type="button">Редактировать</button>
          <button id="duty-save" class="btn small-btn btn-active" type="button" disabled>Сохранить</button>
        </div>
      </div>

      <div class="session-actions duty-settings-row">
        <label>
          <span class="muted">С</span>
          <select id="duty-start-hour" disabled>${renderHourOptions(report.startHour)}</select>
        </label>
        <label>
          <span class="muted">До</span>
          <select id="duty-end-hour" disabled>${renderHourOptions(report.endHour)}</select>
        </label>
        <label class="duty-rate-field">
          <span class="muted">Ставка, сом/час</span>
          <input id="duty-hourly-rate" type="number" min="0" step="50" value="${Number(report.hourlyRate || 0)}" disabled />
        </label>
      </div>

      <p id="duty-message" class="muted small-note">Нажмите «Редактировать», чтобы изменить график.</p>

      <div class="table-wrap duty-grid-wrap">
        <table class="duty-grid-table">
          <thead>
            <tr>
              <th>Час</th>
              ${ctx.weekDays.map((day) => `<th>${escapeHtml(day.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody id="duty-grid-body"></tbody>
        </table>
      </div>
    </section>

    <section class="card section-gap">
      <h3 class="section-title">Текущая неделя</h3>
      <ul class="duty-week-list">
        ${weekRows.length
          ? weekRows.map((row) => `
              <li>
                <strong>${escapeHtml(row.dayLabel)}</strong>
                <span class="muted">${escapeHtml(formatDutyIntervals(row.intervals))}</span>
              </li>
            `).join("")
          : `<li class="muted">Дежурств на этой неделе нет.</li>`}
      </ul>
    </section>
  `;

  const monthInput = root.querySelector("#duty-month");
  const editButton = root.querySelector("#duty-edit-toggle");
  const saveButton = root.querySelector("#duty-save");
  const startHourInput = root.querySelector("#duty-start-hour");
  const endHourInput = root.querySelector("#duty-end-hour");
  const hourlyRateInput = root.querySelector("#duty-hourly-rate");
  const gridBody = root.querySelector("#duty-grid-body");
  const message = root.querySelector("#duty-message");

  let editMode = false;
  let draftSlots = cloneSlotsByDay(report.slotsByDay);

  const collectRange = () => {
    const startHour = normalizeHourValue(startHourInput?.value, report.startHour);
    const endHour = normalizeHourValue(endHourInput?.value, report.endHour);
    if (endHour < startHour) {
      return { startHour: endHour, endHour: startHour };
    }
    return { startHour, endHour };
  };

  const setEditMode = (enabled) => {
    editMode = Boolean(enabled);
    startHourInput.disabled = !editMode;
    endHourInput.disabled = !editMode;
    hourlyRateInput.disabled = !editMode;
    saveButton.disabled = !editMode;
    editButton.textContent = editMode ? "Отменить" : "Редактировать";
    renderGrid();
    if (message) {
      message.textContent = editMode
        ? "Отметьте часы дежурства в таблице и нажмите «Сохранить»."
        : "Нажмите «Редактировать», чтобы изменить график.";
      message.classList.remove("auth-error", "auth-success");
    }
  };

  const sanitizeDraftSlotsToRange = () => {
    const range = collectRange();
    const next = createEmptySlots();
    ctx.weekDays.forEach((day) => {
      const source = Array.isArray(draftSlots[String(day.jsDay)]) ? draftSlots[String(day.jsDay)] : [];
      next[String(day.jsDay)] = [...new Set(
        source
          .map((hour) => Number(hour))
          .filter((hour) => Number.isInteger(hour) && hour >= range.startHour && hour <= range.endHour)
      )].sort((a, b) => a - b);
    });
    draftSlots = next;
  };

  const toggleDraftHour = (jsDay, hour) => {
    const key = String(jsDay);
    const list = Array.isArray(draftSlots[key]) ? [...draftSlots[key]] : [];
    const index = list.indexOf(hour);
    if (index >= 0) list.splice(index, 1);
    else list.push(hour);
    draftSlots[key] = [...new Set(list)].sort((a, b) => a - b);
  };

  const renderGrid = () => {
    sanitizeDraftSlotsToRange();
    const range = collectRange();
    const rows = [];

    for (let hour = range.startHour; hour <= range.endHour; hour += 1) {
      const cells = ctx.weekDays.map((day) => {
        const key = String(day.jsDay);
        const active = Array.isArray(draftSlots[key]) && draftSlots[key].includes(hour);
        return `
          <td>
            <button
              class="duty-cell ${active ? "is-active" : ""}"
              type="button"
              data-duty-day="${day.jsDay}"
              data-duty-hour="${hour}"
              ${editMode ? "" : "disabled"}
              aria-pressed="${active ? "true" : "false"}"
            ></button>
          </td>
        `;
      }).join("");

      rows.push(`
        <tr>
          <th>${formatHour(hour)}</th>
          ${cells}
        </tr>
      `);
    }

    gridBody.innerHTML = rows.join("");
  };

  monthInput?.addEventListener("change", (event) => {
    ctx.actions.setDutyMonth(event.currentTarget.value);
  });

  editButton?.addEventListener("click", () => {
    if (editMode) {
      draftSlots = cloneSlotsByDay(report.slotsByDay);
      startHourInput.value = String(report.startHour);
      endHourInput.value = String(report.endHour);
      hourlyRateInput.value = String(Number(report.hourlyRate || 0));
      setEditMode(false);
      return;
    }
    setEditMode(true);
  });

  startHourInput?.addEventListener("change", renderGrid);
  endHourInput?.addEventListener("change", renderGrid);

  gridBody?.addEventListener("click", (event) => {
    if (!editMode) return;
    const target = event.target instanceof Element ? event.target.closest("[data-duty-day][data-duty-hour]") : null;
    if (!target) return;

    const jsDay = Number(target.getAttribute("data-duty-day"));
    const hour = Number(target.getAttribute("data-duty-hour"));
    if (!Number.isInteger(jsDay) || !Number.isInteger(hour)) return;

    toggleDraftHour(jsDay, hour);
    renderGrid();
  });

  saveButton?.addEventListener("click", () => {
    if (!editMode) return;
    const range = collectRange();
    const hourlyRate = normalizeRateValue(hourlyRateInput?.value, report.hourlyRate);

    if (range.endHour < range.startHour) {
      if (message) {
        message.textContent = "Время окончания не может быть раньше времени начала.";
        message.classList.add("auth-error");
        message.classList.remove("auth-success");
      }
      return;
    }

    ctx.actions.setDutySettings({
      startHour: range.startHour,
      endHour: range.endHour,
      hourlyRate,
      slotsByDay: draftSlots
    });
  });

  renderGrid();
}

function createEmptySlots() {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

function cloneSlotsByDay(slotsByDay) {
  const source = slotsByDay && typeof slotsByDay === "object" ? slotsByDay : createEmptySlots();
  const next = createEmptySlots();
  Object.keys(next).forEach((key) => {
    next[key] = Array.isArray(source[key]) ? [...source[key]] : [];
  });
  return next;
}

function renderHourOptions(selectedHour) {
  return Array.from({ length: 24 }, (_, hour) => {
    const selected = hour === Number(selectedHour) ? "selected" : "";
    const value = String(hour).padStart(2, "0");
    return `<option value="${hour}" ${selected}>${value}:00</option>`;
  }).join("");
}

function formatDutyIntervals(intervals) {
  if (!Array.isArray(intervals) || !intervals.length) return "дежурства нет";
  return intervals
    .map((interval) => `${formatHour(interval.startHour)}-${formatHour(interval.endHourExclusive)}`)
    .join(", ");
}

function normalizeMonthValue(value) {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(raw) ? raw : "";
}

function normalizeHourValue(value, fallbackHour) {
  const hour = Number(value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return Number(fallbackHour || 0);
  return hour;
}

function normalizeRateValue(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return Number(fallback || 0);
  return Math.round(numeric);
}

function formatHour(hour) {
  const normalized = Number(hour);
  if (!Number.isInteger(normalized)) return "00:00";
  const bounded = Math.max(0, Math.min(24, normalized));
  return `${String(bounded).padStart(2, "0")}:00`;
}

function formatMoney(value) {
  return Math.round(Number(value || 0)).toLocaleString("ru-RU");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
