// Раздел общей статистики.
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
  `;

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
}

function formatMoney(value) {
  return Math.round(Number(value || 0)).toLocaleString("ru-RU");
}
