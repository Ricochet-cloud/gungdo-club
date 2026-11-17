// 대시보드 (뼈대) — 데이터 연결은 다음 단계
import { todayKST, formatDateKR } from "../utils.js";

export async function render(view) {
  const date = todayKST();

  view.innerHTML = `
    <div class="page-head">
      <p class="muted">${formatDateKR(date)}</p>
    </div>

    <!-- 4.1 상단 요약 통계 -->
    <section class="stat-grid" aria-label="요약 통계">
      ${statCard("전체 선수", "—", "명")}
      ${statCard("활동 선수", "—", "명")}
      ${statCard("당일 참여", "—", "명")}
      ${statCard("당일 총 명중", "—", "중")}
      ${statCard("당일 명중률", "—", "")}
    </section>

    <div class="grid-2">
      <!-- 4.2 오늘의 순위표 -->
      <section class="card">
        <div class="card-head">
          <h2>오늘의 순위</h2>
          <a class="link" href="#/history?date=${date}">전체 보기 →</a>
        </div>
        <div class="table-wrap">
          <table class="rank-table">
            <thead><tr><th>순위</th><th>선수</th><th>명중</th><th>발수</th><th>명중률</th></tr></thead>
            <tbody><tr><td colspan="5" class="empty">아직 오늘 기록이 없습니다.</td></tr></tbody>
          </table>
        </div>
      </section>

      <!-- 4.4 기록 입력 현황 -->
      <section class="card">
        <div class="card-head">
          <h2>입력 현황</h2>
          <a class="link" href="#/records">기록 입력 →</a>
        </div>
        <ul class="status-list"><li class="empty">활동 선수가 없습니다.</li></ul>
      </section>
    </div>

    <!-- 4.3 최근 기록 -->
    <section class="card">
      <div class="card-head"><h2>최근 기록</h2></div>
      <ul class="recent-list"><li class="empty">최근 기록이 없습니다.</li></ul>
    </section>
  `;

  return () => {}; // 실시간 구독 해제 함수 자리
}

function statCard(label, value, unit) {
  return `
    <div class="stat-card">
      <span class="stat-label">${label}</span>
      <span class="stat-value">${value}<small>${unit}</small></span>
    </div>`;
}
