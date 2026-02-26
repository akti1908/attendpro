// Страница настроек приложения.
export function renderSettings(root, ctx) {
  const settings = ctx.userSettings;
  const serverAutoReportEnabled = Boolean(ctx.isServerAutoReportEnabled);
  const currentTheme = ctx.state.theme === "dark" ? "Темная" : "Светлая";
  const nextTheme = ctx.state.theme === "dark" ? "light" : "dark";
  const currentEmail = String(ctx.currentUser?.email || "-");

  const workSchedule = settings.workSchedule || {
    days: [1, 2, 3, 4, 5, 6, 0],
    startHour: 0,
    endHour: 23
  };
  const workDays = Array.isArray(workSchedule.days) ? workSchedule.days.map((day) => Number(day)) : [];
  const workStartHour = Number.isInteger(Number(workSchedule.startHour)) ? Number(workSchedule.startHour) : 0;
  const workEndHour = Number.isInteger(Number(workSchedule.endHour)) ? Number(workSchedule.endHour) : 23;

  const autoReport = settings.autoReport || {
    enabled: false,
    days: [],
    hour: 18,
    lastSentSlotKey: ""
  };
  const autoReportDays = Array.isArray(autoReport.days) ? autoReport.days.map((day) => Number(day)) : [];
  const autoReportHour = Number.isInteger(Number(autoReport.hour)) ? Number(autoReport.hour) : 18;

  root.innerHTML = `
    <section class="card">
      <h2 class="section-title">Настройки</h2>

      <div class="settings-accordion">
        <details class="setting-collapse">
          <summary class="setting-summary">Аккаунт</summary>
          <div class="setting-collapse-body">
            <div class="setting-item">
              <span class="muted">Текущий аккаунт</span>
              <strong>${escapeHtml(currentEmail)}</strong>
              <button id="settings-logout" class="btn small-btn" type="button">Выйти</button>
            </div>
          </div>
        </details>

        <details class="setting-collapse">
          <summary class="setting-summary">Тема приложения</summary>
          <div class="setting-collapse-body">
            <div class="setting-item">
              <button id="settings-theme-toggle" class="btn small-btn" type="button">Тема: ${currentTheme}</button>
            </div>
          </div>
        </details>

        <details class="setting-collapse">
          <summary class="setting-summary">Категория тренера</summary>
          <div class="setting-collapse-body">
            <div class="setting-item">
              <label for="trainer-category" class="muted">Выберите категорию</label>
              <select id="trainer-category">
                ${ctx.trainerCategories
                  .map((category) => {
                    const selected = settings.trainerCategory === category ? "selected" : "";
                    return `<option value="${category}" ${selected}>Категория ${category}</option>`;
                  })
                  .join("")}
              </select>
            </div>
          </div>
        </details>

        <details class="setting-collapse">
          <summary class="setting-summary">График работы</summary>
          <div class="setting-collapse-body">
            <div class="setting-item">
              <div class="days settings-days">
                ${ctx.weekDays
                  .map(
                    (day) => `
                      <label>
                        <input type="checkbox" name="work-day" value="${day.jsDay}" ${
                      workDays.includes(Number(day.jsDay)) ? "checked" : ""
                    } />
                        ${day.label}
                      </label>
                    `
                  )
                  .join("")}
              </div>

              <div class="session-actions settings-time-range">
                <label>
                  <span class="muted">С</span>
                  <select id="work-start-hour">${renderHourOptions(workStartHour)}</select>
                </label>
                <label>
                  <span class="muted">До</span>
                  <select id="work-end-hour">${renderHourOptions(workEndHour)}</select>
                </label>
              </div>

              <button id="settings-save-work-schedule" class="btn small-btn" type="button">Сохранить график</button>
              <p id="settings-work-schedule-message" class="muted small-note"></p>
            </div>
          </div>
        </details>

        <details class="setting-collapse">
          <summary class="setting-summary">Автоотчет в Telegram</summary>
          <div class="setting-collapse-body">
            <div class="setting-item">
              <label class="setting-inline" for="auto-report-enabled">
                <input id="auto-report-enabled" type="checkbox" ${autoReport.enabled ? "checked" : ""} />
                <span>Включить автоматическую отправку</span>
              </label>

              <div class="days settings-days">
                ${ctx.weekDays
                  .map(
                    (day) => `
                      <label>
                        <input type="checkbox" name="auto-report-day" value="${day.jsDay}" ${
                      autoReportDays.includes(Number(day.jsDay)) ? "checked" : ""
                    } />
                        ${day.label}
                      </label>
                    `
                  )
                  .join("")}
              </div>

              <label for="auto-report-hour" class="muted">Час отправки</label>
              <select id="auto-report-hour">${renderHourOptions(autoReportHour)}</select>

              <button id="settings-save-auto-report" class="btn small-btn" type="button">Сохранить автоотчет</button>
              <p id="settings-auto-report-message" class="muted small-note"></p>
              <p class="muted small-note">${serverAutoReportEnabled ? "Автоотчет работает на сервере 24/7 и не зависит от открытого браузера." : "Внимание: без серверного scheduler автоотчет зависит от открытого приложения."}</p>
            </div>
          </div>
        </details>

        <details class="setting-collapse">
          <summary class="setting-summary">Синхронизация</summary>
          <div class="setting-collapse-body">
            <div class="setting-item">
              <button id="settings-sync-now" class="btn small-btn" type="button" ${ctx.isCloudConfigured ? "" : "disabled"}>
                Синхронизировать сейчас
              </button>
              <p id="settings-message" class="muted small-note"></p>
            </div>
          </div>
        </details>
      </div>
    </section>

    <section class="card section-gap">
      <h2 class="section-title">Прайсы по выбранной категории</h2>

      <div class="settings-accordion">
        <details class="setting-collapse">
          <summary class="setting-summary">Персональные</summary>
          <div class="setting-collapse-body">
            <div class="setting-item">
              ${renderPriceTable(ctx.packageOptions.personal, "сом")}
            </div>
          </div>
        </details>

        <details class="setting-collapse">
          <summary class="setting-summary">Сплит (за 1 человека)</summary>
          <div class="setting-collapse-body">
            <div class="setting-item">
              ${renderPriceTable(ctx.packageOptions.split, "сом/чел")}
              <p class="muted small-note">Прайсы сплитов для категорий II/III временно базовые, обновим после получения вашей таблицы.</p>
            </div>
          </div>
        </details>

        <details class="setting-collapse">
          <summary class="setting-summary">Мини-группа (за 1 человека)</summary>
          <div class="setting-collapse-body">
            <div class="setting-item">
              ${renderPriceTable(ctx.packageOptions.mini_group, "сом/чел")}
              <p class="muted small-note">Мини-группа: от 3 до 5 участников в карточке.</p>
            </div>
          </div>
        </details>
      </div>

      <p class="muted small-note">При смене категории цены применяются к новым пакетам. История уже купленных пакетов не меняется.</p>
    </section>
  `;

  root.querySelector("#settings-theme-toggle")?.addEventListener("click", () => {
    ctx.actions.setTheme(nextTheme);
  });

  root.querySelector("#trainer-category")?.addEventListener("change", (event) => {
    ctx.actions.setTrainerCategory(event.currentTarget.value);
  });

  root.querySelector("#settings-logout")?.addEventListener("click", () => {
    ctx.actions.logoutUser();
  });

  root.querySelector("#settings-save-work-schedule")?.addEventListener("click", () => {
    const checkedDays = Array.from(root.querySelectorAll("input[name='work-day']:checked"));
    const days = checkedDays
      .map((input) => Number(input.value))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    const startHour = Number(root.querySelector("#work-start-hour")?.value ?? workStartHour);
    const endHour = Number(root.querySelector("#work-end-hour")?.value ?? workEndHour);

    const message = root.querySelector("#settings-work-schedule-message");
    if (!days.length) {
      if (message) {
        message.textContent = "Выберите хотя бы один рабочий день.";
        message.classList.add("auth-error");
        message.classList.remove("auth-success");
      }
      return;
    }

    if (endHour < startHour) {
      if (message) {
        message.textContent = "Время окончания не может быть раньше времени начала.";
        message.classList.add("auth-error");
        message.classList.remove("auth-success");
      }
      return;
    }

    ctx.actions.setWorkScheduleSettings({
      days,
      startHour,
      endHour
    });

    if (message) {
      message.textContent = `График сохранен: ${String(startHour).padStart(2, "0")}:00-${String(endHour).padStart(2, "0")}:00`;
      message.classList.remove("auth-error");
      message.classList.add("auth-success");
    }
  });

  root.querySelector("#settings-save-auto-report")?.addEventListener("click", () => {
    const enabled = Boolean(root.querySelector("#auto-report-enabled")?.checked);
    const checkedDays = Array.from(root.querySelectorAll("input[name='auto-report-day']:checked"));
    const days = checkedDays
      .map((input) => Number(input.value))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    const hour = Number(root.querySelector("#auto-report-hour")?.value ?? autoReportHour);

    const message = root.querySelector("#settings-auto-report-message");
    if (enabled && !days.length) {
      if (message) {
        message.textContent = "Выберите хотя бы один день недели для автоотчета.";
        message.classList.add("auth-error");
        message.classList.remove("auth-success");
      }
      return;
    }

    ctx.actions.setAutoReportSettings({
      enabled,
      days,
      hour
    });

    if (message) {
      message.textContent = enabled
        ? `Автоотчет сохранен: ${String(hour).padStart(2, "0")}:00`
        : "Автоотчет отключен.";
      message.classList.remove("auth-error");
      message.classList.add("auth-success");
    }
  });

  root.querySelector("#settings-sync-now")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const message = root.querySelector("#settings-message");
    button.disabled = true;
    if (message) {
      message.textContent = "Синхронизация...";
      message.classList.remove("auth-error", "auth-success");
    }

    const result = await ctx.actions.syncCloudNow();

    if (message) {
      message.textContent = result.message;
      message.classList.toggle("auth-success", Boolean(result.ok));
      message.classList.toggle("auth-error", !result.ok);
    }

    button.disabled = !ctx.isCloudConfigured;
  });
}

function renderHourOptions(selectedHour) {
  return Array.from({ length: 24 }, (_, hour) => {
    const selected = hour === Number(selectedHour) ? "selected" : "";
    const value = String(hour).padStart(2, "0");
    return `<option value="${hour}" ${selected}>${value}:00</option>`;
  }).join("");
}

function renderPriceTable(options, suffix) {
  const rows = (options || [])
    .map(
      (item) => `
      <tr>
        <td>${item.count}</td>
        <td>${formatMoney(getPriceValue(item))} ${suffix}</td>
      </tr>
    `
    )
    .join("");

  return `
    <div class="table-wrap">
      <table class="price-table">
        <thead>
          <tr>
            <th>Пакет</th>
            <th>Стоимость</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function getPriceValue(item) {
  if (Number.isFinite(Number(item?.totalPrice))) {
    return Number(item.totalPrice);
  }
  return Number(item?.pricePerPerson || 0);
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
