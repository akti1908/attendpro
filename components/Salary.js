// Раздел расчета заработной платы за выбранный месяц.
export function renderSalary(root, ctx) {
  const monthValue = ctx.state.salaryMonth;
  const report = ctx.getSalaryReport(monthValue);
  const duty = report.duty || { hours: 0, ratePerHour: 0, income: 0 };
  const salarySharePercent = Number(report.salarySharePercent || 50);

  root.innerHTML = `
    <section class="card">
      <h2 class="section-title">ЗП за месяц</h2>
      <div class="salary-toolbar">
        <label>
          Месяц:
          <input id="salary-month" type="month" value="${report.monthISO}" />
        </label>
        <p class="muted">Период: ${ctx.formatDate(report.startDateISO)} - ${ctx.formatDate(report.endDateISO)}</p>
      </div>

      <div class="stats-grid mt-8">
        <div class="stat-card"><span class="muted">Продажи персональных пакетов</span><strong>${formatMoney(report.sales.personal)} сом</strong></div>
        <div class="stat-card"><span class="muted">Продажи сплит-пакетов</span><strong>${formatMoney(report.sales.split)} сом</strong></div>
        <div class="stat-card"><span class="muted">Продажи мини-групп</span><strong>${formatMoney(report.sales.miniGroup)} сом</strong></div>
        <div class="stat-card"><span class="muted">Сумма продаж за месяц</span><strong>${formatMoney(report.totalSales)} сом</strong></div>
        <div class="stat-card"><span class="muted">ЗП с тренировок (${salarySharePercent}%)</span><strong>${formatMoney(report.totalTrainingIncome || 0)} сом</strong></div>
        <div class="stat-card"><span class="muted">Всего занятий</span><strong>${report.totalSessions}</strong></div>
        <div class="stat-card"><span class="muted">Отработанные часы (тренировки)</span><strong>${report.totalWorkedHours}</strong></div>
        <div class="stat-card"><span class="muted">Часы дежурства (месяц)</span><strong>${Number(duty.hours || 0)}</strong></div>
        <div class="stat-card"><span class="muted">Ставка дежурства</span><strong>${formatMoney(duty.ratePerHour || 0)} сом/ч</strong></div>
        <div class="stat-card"><span class="muted">ЗП за дежурство</span><strong>${formatMoney(duty.income || 0)} сом</strong></div>
        <div class="stat-card"><span class="muted">Итоговая ЗП (тренировки + дежурство)</span><strong>${formatMoney(report.totalIncome)} сом</strong></div>
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

  const list = root.querySelector("#salary-list");
  list.innerHTML = report.rows.length
    ? report.rows.map((row) => renderSalaryRow(row, salarySharePercent)).join("")
    : `<p class="muted">За выбранный месяц по карточкам пока нет продаж и отмеченных занятий.</p>`;
}

function renderSalaryRow(row, salarySharePercent) {
  const label = row.type === "split"
    ? "Сплит"
    : row.type === "mini_group"
      ? "Мини-группа"
      : "Персональная";

  return `
    <article class="card stat-result card-item">
      <h3>${escapeHtml(row.name)}</h3>
      <p><span class="muted">Тип:</span> ${label}</p>
      <p><span class="muted">Занятий (часов):</span> ${Number(row.attended || 0)}</p>
      <p><span class="muted">Продажи за месяц:</span> ${formatMoney(row.sales || 0)} сом</p>
      <p><span class="muted">ЗП (${salarySharePercent}%):</span> ${formatMoney(row.income || 0)} сом</p>
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
