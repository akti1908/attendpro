// Экран календаря: клик по дню открывает журнал этой даты.
export function renderCalendar(root, ctx) {
  const baseDate = parseLocalISODate(ctx.state.calendarDate);
  const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const monthEnd = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);

  const startOffset = (monthStart.getDay() + 6) % 7;
  const cells = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push(`<div class="calendar-cell"></div>`);
  }

  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    const isoDate = toLocalISODate(new Date(baseDate.getFullYear(), baseDate.getMonth(), day));
    const sessions = ctx.getSessionsByDate(isoDate);

    const items = sessions
      .map((session) => `<div class="badge ${session.type}">${session.label}${session.status ? ` (${session.status})` : ""}</div>`)
      .join("");

    const selectedClass = isoDate === ctx.state.selectedDate ? "calendar-cell-selected" : "";

    cells.push(`
      <button class="calendar-cell calendar-cell-btn ${selectedClass}" data-action="open-day" data-date="${isoDate}">
        <div class="calendar-day">${day}</div>
        ${items || `<span class="muted">Нет тренировок</span>`}
      </button>
    `);
  }

  root.innerHTML = `
    <section class="card">
      <div class="calendar-toolbar">
        <button id="prev-month" class="btn">Назад</button>
        <h2>${baseDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</h2>
        <button id="next-month" class="btn">Вперед</button>
      </div>

      <div class="calendar-scroll">
        <div class="calendar-grid">
          <div class="calendar-day">Пн</div>
          <div class="calendar-day">Вт</div>
          <div class="calendar-day">Ср</div>
          <div class="calendar-day">Чт</div>
          <div class="calendar-day">Пт</div>
          <div class="calendar-day">Сб</div>
          <div class="calendar-day">Вс</div>
        </div>

        <div class="calendar-grid calendar-body">
          ${cells.join("")}
        </div>
      </div>
    </section>
  `;

  root.querySelector("#prev-month").addEventListener("click", () => {
    const prev = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1);
    ctx.actions.setCalendarDate(toLocalISODate(prev));
  });

  root.querySelector("#next-month").addEventListener("click", () => {
    const next = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
    ctx.actions.setCalendarDate(toLocalISODate(next));
  });

  root.querySelectorAll("[data-action='open-day']").forEach((button) => {
    button.addEventListener("click", () => {
      ctx.actions.openDateJournalFromCalendar(button.dataset.date);
    });
  });
}

function toLocalISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalISODate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}
