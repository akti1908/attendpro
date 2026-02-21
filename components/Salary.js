// Раздел расчета заработной платы за выбранный месяц.
export function renderSalary(root, ctx) {
  const monthValue = ctx.state.salaryMonth;
  const report = ctx.getSalaryReport(monthValue);
  const miniGroup = report.miniGroup || { sessions: 0, income: 0 };

  root.innerHTML = `
    <section class="card">
      <h2 class="section-title">Заработная плата за месяц</h2>
      <div class="salary-toolbar">
        <label>
          Месяц:
          <input id="salary-month" type="month" value="${report.monthISO}" />
        </label>
        <p class="muted">Период: ${ctx.formatDate(report.startDateISO)} - ${ctx.formatDate(report.endDateISO)}</p>
        <button id="salary-export-month" class="btn small-btn">Экспорт месяца CSV</button>
        ${report.isClosed
          ? `<button id="salary-reopen-month" class="btn small-btn">Открыть месяц</button>`
          : `<button id="salary-close-month" class="btn small-btn">Закрыть месяц</button>`}
      </div>
      <p class="salary-lock-note ${report.isClosed ? "salary-lock-closed" : ""}">
        ${report.isClosed
          ? `Месяц закрыт ${new Date(report.closedAt).toLocaleString("ru-RU")}. Редактирование занятий этого месяца заблокировано.`
          : "Месяц открыт. Данные пересчитываются в реальном времени."}
      </p>

      <div class="stats-grid mt-8">
        <div class="stat-card"><span class="muted">Персональных занятий</span><strong>${report.personal.sessions}</strong></div>
        <div class="stat-card"><span class="muted">Сплит-занятий</span><strong>${report.split.sessions}</strong></div>
        <div class="stat-card"><span class="muted">Мини-группа занятий</span><strong>${miniGroup.sessions}</strong></div>
        <div class="stat-card"><span class="muted">ЗП с персональных</span><strong>${formatMoney(report.personal.income)} сом</strong></div>
        <div class="stat-card"><span class="muted">ЗП со сплитов</span><strong>${formatMoney(report.split.income)} сом</strong></div>
        <div class="stat-card"><span class="muted">ЗП с мини-групп</span><strong>${formatMoney(miniGroup.income)} сом</strong></div>
        <div class="stat-card"><span class="muted">Всего занятий</span><strong>${report.totalSessions}</strong></div>
        <div class="stat-card"><span class="muted">Итоговая ЗП</span><strong>${formatMoney(report.totalIncome)} сом</strong></div>
      </div>
    </section>

    <section class="card section-gap">
      <h2 class="section-title">Детализация по карточкам</h2>
      <div id="salary-list" class="list-scroll"></div>
    </section>
  `;

  root.querySelector("#salary-month").addEventListener("change", (event) => {
    ctx.actions.setSalaryMonth(event.currentTarget.value);
  });

  root.querySelector("#salary-export-month").addEventListener("click", () => {
    ctx.actions.exportSalaryMonthCSV(report.monthISO);
  });

  const closeButton = root.querySelector("#salary-close-month");
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      ctx.actions.closeSalaryMonth(report.monthISO);
    });
  }

  const reopenButton = root.querySelector("#salary-reopen-month");
  if (reopenButton) {
    reopenButton.addEventListener("click", () => {
      ctx.actions.reopenSalaryMonth(report.monthISO);
    });
  }

  const list = root.querySelector("#salary-list");
  list.innerHTML = report.rows.length
    ? report.rows.map((row) => renderSalaryRow(row)).join("")
    : `<p class="muted">За выбранный месяц посещений пока нет.</p>`;
}

function renderSalaryRow(row) {
  const label = row.type === "split"
    ? "Сплит"
    : row.type === "mini_group"
      ? "Мини-группа"
      : "Персональная";

  return `
    <article class="card stat-result card-item">
      <h3>${escapeHtml(row.name)}</h3>
      <p><span class="muted">Тип:</span> ${label}</p>
      <p><span class="muted">Занятий в месяце:</span> ${row.attended}</p>
      <p><span class="muted">ЗП:</span> ${formatMoney(row.income)} сом</p>
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
