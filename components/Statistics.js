// Раздел статистики + поиск по карточкам.
export function renderStatistics(root, ctx) {
  const stats = ctx.getStatistics();

  root.innerHTML = `
    <section class="card">
      <h2 class="section-title">Общая статистика посещаемости</h2>
      <div class="stats-grid">
        <div class="stat-card"><span class="muted">Посещаемость %</span><strong>${stats.attendancePercent}%</strong></div>
        <div class="stat-card"><span class="muted">Пропуски %</span><strong>${stats.missesPercent}%</strong></div>
        <div class="stat-card"><span class="muted">Продления пакетов</span><strong>${stats.totalPackageRenewals}</strong></div>
        <div class="stat-card"><span class="muted">Средний доход за занятие</span><strong>${formatMoney(stats.avgIncomePerSession)} сом</strong></div>
        <div class="stat-card"><span class="muted">Посещений</span><strong>${stats.totalVisits}</strong></div>
        <div class="stat-card"><span class="muted">Пропусков</span><strong>${stats.totalMisses}</strong></div>
        <div class="stat-card"><span class="muted">Приобретено тренировок</span><strong>${stats.totalPurchasedTrainings}</strong></div>
        <div class="stat-card"><span class="muted">Осталось посещений</span><strong>${stats.totalRemainingTrainings}</strong></div>
      </div>

      <div class="tools-row">
        <button id="export-stats-csv" class="btn small-btn">Экспорт статистики CSV</button>
        <button id="export-backup-json" class="btn small-btn">Скачать бэкап JSON</button>
        <input id="import-backup-file" type="file" accept=".json,application/json" class="is-hidden" />
        <button id="import-backup-btn" class="btn small-btn">Восстановить из бэкапа</button>
      </div>
    </section>

    <section class="card section-gap">
      <h2 class="section-title">Поиск по карточкам</h2>
      <input id="stats-search" type="text" placeholder="Введите имя ученика или название группы" />
      <div id="stats-list" class="list-scroll mt-10"></div>
    </section>
  `;

  const list = root.querySelector("#stats-list");
  const input = root.querySelector("#stats-search");
  const backupInput = root.querySelector("#import-backup-file");

  root.querySelector("#export-stats-csv").addEventListener("click", () => {
    ctx.actions.exportStatisticsCSV();
  });

  root.querySelector("#export-backup-json").addEventListener("click", () => {
    ctx.actions.exportBackupJSON();
  });

  root.querySelector("#import-backup-btn").addEventListener("click", () => {
    backupInput.click();
  });

  backupInput.addEventListener("change", () => {
    const file = backupInput.files?.[0];
    if (!file) return;
    ctx.actions.importBackupFromFile(file);
    backupInput.value = "";
  });

  const draw = () => {
    const query = input.value.trim().toLowerCase();
    const filtered = stats.cards.filter((item) => {
      const main = item.name.toLowerCase();
      const members = (item.participants || []).join(" ").toLowerCase();
      return main.includes(query) || members.includes(query);
    });

    list.innerHTML = filtered.length
      ? filtered.map((item) => renderStatCard(item, ctx)).join("")
      : `<p class="muted">Ничего не найдено.</p>`;
  };

  input.addEventListener("input", draw);
  draw();
}

function renderStatCard(item, ctx) {
  const typeLabel = item.type === "personal"
    ? "Персональная"
    : item.type === "split"
      ? "Сплит"
      : "Групповая";

  const purchasedLine = item.type === "group"
    ? ""
    : `<p><span class="muted">Приобретено тренировок:</span> ${item.purchasedTrainings}</p>`;

  const remainingLine = item.type === "group"
    ? ""
    : `<p><span class="muted">Осталось посещений:</span> ${item.remainingTrainings}</p>`;

  const renewalsLine = item.type === "group"
    ? ""
    : `<p><span class="muted">Продления пакетов:</span> ${item.renewals || 0}</p>`;

  const incomeLine = item.type === "group"
    ? ""
    : `<p><span class="muted">Доход тренера:</span> ${formatMoney(item.income || 0)} сом</p>`;

  return `
    <article class="card stat-result card-item">
      <h3>${escapeHtml(item.name)}</h3>
      <p><span class="muted">Тип:</span> ${typeLabel}</p>
      <p><span class="muted">Посещений:</span> ${item.visits}</p>
      <p><span class="muted">Пропусков:</span> ${item.misses}</p>
      ${purchasedLine}
      ${remainingLine}
      ${renewalsLine}
      ${incomeLine}
      <p><span class="muted">Последнее посещение по графику:</span> ${item.lastVisitDate ? ctx.formatDate(item.lastVisitDate) : "-"}</p>
    </article>
  `;
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
