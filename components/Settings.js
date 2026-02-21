// Страница настроек приложения.
export function renderSettings(root, ctx) {
  const settings = ctx.userSettings;
  const currentTheme = ctx.state.theme === "dark" ? "Темная" : "Светлая";
  const nextTheme = ctx.state.theme === "dark" ? "light" : "dark";
  const currentEmail = String(ctx.currentUser?.email || "-");

  root.innerHTML = `
    <section class="card">
      <h2 class="section-title">Настройки</h2>

      <div class="settings-grid">
        <div class="setting-item">
          <span class="muted">Текущий аккаунт</span>
          <strong>${escapeHtml(currentEmail)}</strong>
          <button id="settings-logout" class="btn small-btn" type="button">Выйти</button>
        </div>

        <div class="setting-item">
          <span class="muted">Тема приложения</span>
          <button id="settings-theme-toggle" class="btn small-btn" type="button">
            Тема: ${currentTheme}
          </button>
        </div>

        <div class="setting-item">
          <label for="trainer-category" class="muted">Категория тренера</label>
          <select id="trainer-category">
            ${ctx.trainerCategories.map((category) => {
              const selected = settings.trainerCategory === category ? "selected" : "";
              return `<option value="${category}" ${selected}>Категория ${category}</option>`;
            }).join("")}
          </select>
        </div>

        <div class="setting-item">
          <span class="muted">Синхронизация</span>
          <button id="settings-sync-now" class="btn small-btn" type="button" ${ctx.isCloudConfigured ? "" : "disabled"}>
            Синхронизировать сейчас
          </button>
          <p id="settings-message" class="muted small-note"></p>
        </div>
      </div>
    </section>

    <section class="card section-gap">
      <h2 class="section-title">Прайсы по выбранной категории</h2>

      <div class="price-block">
        <h3>Персональные</h3>
        ${renderPriceTable(ctx.packageOptions.personal, "сом")}
      </div>

      <div class="price-block section-gap">
        <h3>Сплит (за 1 человека)</h3>
        ${renderPriceTable(ctx.packageOptions.split, "сом/чел")}
        <p class="muted small-note">Прайсы сплитов для категорий II/III временно базовые, обновим после получения вашей таблицы.</p>
      </div>

      <div class="price-block section-gap">
        <h3>Мини-группа (за 1 человека)</h3>
        ${renderPriceTable(ctx.packageOptions.mini_group, "сом/чел")}
        <p class="muted small-note">Мини-группа: от 3 до 5 участников в карточке.</p>
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

function renderPriceTable(options, suffix) {
  const rows = (options || [])
    .map((item) => `
      <tr>
        <td>${item.count}</td>
        <td>${formatMoney(getPriceValue(item))} ${suffix}</td>
      </tr>
    `)
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
