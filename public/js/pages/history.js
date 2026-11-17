// 기록 조회 (뼈대) — 날짜별 / 선수별 탭
import { todayKST, formatDateKR } from "../utils.js";

export async function render(view, params) {
  const date = params.date || todayKST();
  const tab = params.tab === "player" ? "player" : "date";

  view.innerHTML = `
    <div class="tabs" role="tablist">
      <a role="tab" class="tab ${tab === "date" ? "active" : ""}" href="#/history?tab=date&date=${date}">날짜별</a>
      <a role="tab" class="tab ${tab === "player" ? "active" : ""}" href="#/history?tab=player">선수별</a>
    </div>
    ${tab === "date" ? byDate(date) : byPlayer()}
  `;

  if (tab === "date") {
    view.querySelector("#hist-date").addEventListener("change", (e) => {
      location.hash = `#/history?tab=date&date=${e.target.value}`;
    });
  }
  return () => {};
}

function byDate(date) {
  return `
    <section class="card">
      <div class="card-head">
        <h2>${formatDateKR(date)}</h2>
        <input type="date" id="hist-date" value="${date}" max="${todayKST()}" />
      </div>
      <div class="table-wrap">
        <table class="rank-table">
          <thead><tr><th>순위</th><th>선수</th><th>1회</th><th>2회</th><th>3회</th><th>명중</th><th>명중률</th></tr></thead>
          <tbody><tr><td colspan="7" class="empty">이 날짜에는 기록이 없습니다.</td></tr></tbody>
        </table>
      </div>
    </section>`;
}

function byPlayer() {
  return `
    <section class="card">
      <label class="field">
        <span>선수 선택</span>
        <select id="hist-player"><option value="">선수를 선택하세요</option></select>
      </label>
    </section>
    <section class="stat-grid">
      <div class="stat-card"><span class="stat-label">참여 일수</span><span class="stat-value">—</span></div>
      <div class="stat-card"><span class="stat-label">개인 최고</span><span class="stat-value">—</span></div>
      <div class="stat-card"><span class="stat-label">평균 명중률</span><span class="stat-value">—</span></div>
    </section>
    <section class="card">
      <div class="card-head"><h2>기록 추이</h2></div>
      <div class="chart-placeholder empty">선수를 선택하면 그래프가 표시됩니다.</div>
    </section>`;
}
