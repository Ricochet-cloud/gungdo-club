// 기록 입력 (뼈대) — 회차 1→2→3 순서 입력 UI 틀
import { todayKST, ROUNDS, ARROWS_PER_ROUND } from "../utils.js";

export async function render(view) {
  const date = todayKST();

  view.innerHTML = `
    <section class="card">
      <div class="form-row">
        <label class="field">
          <span>날짜</span>
          <input type="date" id="rec-date" value="${date}" max="${date}" />
        </label>
        <label class="field">
          <span>선수</span>
          <select id="rec-player" disabled>
            <option>활동 선수를 먼저 등록하세요</option>
          </select>
        </label>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>회차별 명중</h2>
        <span class="badge">진행중</span>
      </div>

      <div class="round-list">
        ${ROUNDS.map((n) => roundSlot(n, n === 1)).join("")}
      </div>

      <div class="summary-row">
        <div><span class="muted">총 명중</span><strong>—</strong></div>
        <div><span class="muted">총 발수</span><strong>—</strong></div>
        <div><span class="muted">명중률</span><strong>—</strong></div>
      </div>
    </section>
  `;

  return () => {};
}

// 회차 슬롯: 0~5 버튼. 이전 회차가 입력돼야 활성화 (unlocked)
function roundSlot(round, unlocked) {
  const buttons = Array.from({ length: ARROWS_PER_ROUND + 1 }, (_, i) =>
    `<button type="button" class="hit-btn" data-round="${round}" data-hits="${i}" ${unlocked ? "" : "disabled"}>${i}</button>`
  ).join("");
  return `
    <div class="round ${unlocked ? "" : "locked"}">
      <div class="round-head">
        <strong>${round}회차</strong>
        <span class="muted">${unlocked ? "미기록" : `${round - 1}회차 입력 후 가능`}</span>
      </div>
      <div class="hit-buttons">${buttons}</div>
    </div>`;
}
