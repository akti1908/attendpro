// Раздел общей статистики и выгрузок.
export function renderStatistics(root, ctx) {
  const stats = ctx.getStatistics();
  const groups = Array.isArray(ctx.state.groups)
    ? [...ctx.state.groups].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ru-RU"))
    : [];
  const defaultMonth = normalizeMonthValue(
    ctx.state.salaryMonth || String(ctx.state.selectedDate || "").slice(0, 7) || String(ctx.getTodayISO() || "").slice(0, 7)
  );
  const groupOptions = groups.length
    ? groups.map((group) => `<option value="${escapeAttr(group.id)}">${escapeHtml(group.name || "Группа")}</option>`).join("")
    : `<option value="">Групп нет</option>`;

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

      <div class="section-gap">
        <h3>Выгрузка посещаемости групп за месяц</h3>
        <div class="session-actions">
          <select id="group-monthly-export-group">${groupOptions}</select>
          <input id="group-monthly-export-month" type="month" value="${defaultMonth}" />
          <button
            id="group-monthly-export-btn"
            class="btn small-btn"
            type="button"
            ${groups.length ? "" : "disabled"}
          >
            Выгрузить отчет группы
          </button>
        </div>
        <p class="muted small-note">Формат: по датам месяца, показываются только присутствовавшие. Если присутствовавших нет, пишется «Отметок нет».</p>
      </div>
    </section>
  `;

  const backupInput = root.querySelector("#import-backup-file");

  root.querySelector("#export-stats-csv")?.addEventListener("click", () => {
    ctx.actions.exportStatisticsCSV();
  });

  root.querySelector("#export-backup-json")?.addEventListener("click", () => {
    ctx.actions.exportBackupJSON();
  });

  root.querySelector("#import-backup-btn")?.addEventListener("click", () => {
    backupInput?.click();
  });

  backupInput?.addEventListener("change", () => {
    const file = backupInput.files?.[0];
    if (!file) return;
    ctx.actions.importBackupFromFile(file);
    backupInput.value = "";
  });

  root.querySelector("#group-monthly-export-btn")?.addEventListener("click", () => {
    const groupId = String(root.querySelector("#group-monthly-export-group")?.value || "");
    const monthISO = normalizeMonthValue(root.querySelector("#group-monthly-export-month")?.value);
    ctx.actions.exportGroupAttendanceMonthlyReport(groupId, monthISO);
  });
}

function normalizeMonthValue(value) {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(raw) ? raw : "";
}

function formatMoney(value) {
  return Math.round(Number(value || 0)).toLocaleString("ru-RU");
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
