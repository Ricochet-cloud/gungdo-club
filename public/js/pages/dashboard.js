// 대시보드 — 오늘 요약 통계 · 순위 · 입력 현황 · 최근 기록 (실시간)
import { watchPlayers } from "../data/players.js";
import { watchRecordsByDate, watchRecentRecords, groupByPlayer } from "../data/records.js";
import { watchPracticeByDate, summarizePractice } from "../data/practice.js";
import {
  todayKST, formatDateKR, formatTime, ROUNDS, hitRate, formatRate,
  buildDailyRanking, escapeHTML, toast, displayName,
} from "../utils.js";

const RECENT_LIMIT = 10;

export async function render(view) {
  const date = todayKST();
  const state = { players: null, records: null, recent: null, practice: null };

  view.innerHTML = `
    <div class="page-head">
      <p class="muted">${formatDateKR(date)}</p>
    </div>

    <section class="stat-grid" id="stats" aria-label="요약 통계"></section>

    <div class="grid-2">
      <section class="card">
        <div class="card-head">
          <h2>오늘의 순위</h2>
          <a class="link" href="#/history?tab=date&date=${date}">상세 보기 →</a>
        </div>
        <div class="table-wrap">
          <table class="rank-table">
            <thead><tr><th>순위</th><th>선수</th><th>명중</th><th>발수</th><th>명중률</th></tr></thead>
            <tbody id="rank-body"><tr><td colspan="5" class="empty">불러오는 중…</td></tr></tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>입력 현황</h2>
          <a class="link" href="#/records?date=${date}">기록 입력 →</a>
        </div>
        <ul class="status-list" id="status-list"><li class="empty">불러오는 중…</li></ul>
      </section>
    </div>

    <section class="card">
      <div class="card-head"><h2>최근 기록</h2></div>
      <ul class="recent-list" id="recent-list"><li class="empty">불러오는 중…</li></ul>
    </section>
  `;

  const $ = (s) => view.querySelector(s);

  // ── 요약 통계 ──────────────────────────────
  function renderStats() {
    const players = state.players || [];
    const records = (state.records || []).filter((r) => !r.deleted);
    const active = players.filter((p) => p.status === "active").length;
    const participants = new Set(records.map((r) => r.playerId)).size;
    const hits = records.reduce((s, r) => s + r.hits, 0);
    const arrows = records.reduce((s, r) => s + r.arrowsShot, 0);
    const ready = state.players && state.records;

    $("#stats").innerHTML = [
      statCard("전체 선수", ready ? players.length : "—", "명"),
      statCard("활동 선수", ready ? active : "—", "명"),
      statCard("오늘 참여", ready ? participants : "—", "명"),
      statCard("오늘 총 명중", ready ? hits : "—", "중"),
      statCard("오늘 명중률", ready ? formatRate(hitRate(hits, arrows)) : "—", ""),
      practiceCard(),
    ].join("");
  }

  function practiceCard() {
    if (!state.practice) return statCard("오늘 연습", "—", "");
    const list = Object.values(summarizePractice(state.practice));
    const pArrows = list.reduce((s, p) => s + p.arrows, 0);
    const pHits = list.reduce((s, p) => s + p.hits, 0);
    const sub = list.length ? `${pArrows}발 · ${formatRate(hitRate(pHits, pArrows))}` : "기록 없음";
    return `
      <a class="stat-card stat-card-practice" href="#/records?date=${date}&mode=practice">
        <span class="stat-label">오늘 연습</span>
        <span class="stat-value">${list.length}<small>명</small></span>
        <span class="stat-sub">${sub}</span>
      </a>`;
  }

  // ── 오늘의 순위 ────────────────────────────
  function renderRanking() {
    if (!state.records) return;
    const ranking = buildDailyRanking(state.records);
    $("#rank-body").innerHTML = ranking.length
      ? rankingRows(ranking, state.players)
      : `<tr><td colspan="5" class="empty">아직 오늘 기록이 없습니다.</td></tr>`;
  }

  // ── 입력 현황 ──────────────────────────────
  function renderStatus() {
    if (!state.players || !state.records) return;
    const grouped = groupByPlayer(state.records);
    const list = state.players.filter((p) => p.status === "active" || grouped[p.id]);
    if (!list.length) {
      $("#status-list").innerHTML = `<li class="empty">활동 선수가 없습니다. <a class="link" href="#/players">선수 등록 →</a></li>`;
      return;
    }
    const doneOf = (p) => Object.keys(grouped[p.id] || {}).length;
    const sorted = [...list].sort((a, b) =>
      (doneOf(a) === 3) - (doneOf(b) === 3) || doneOf(b) - doneOf(a) || a.name.localeCompare(b.name, "ko"));

    $("#status-list").innerHTML = sorted.map((p) => {
      const r = grouped[p.id] || {};
      const count = doneOf(p);
      const done = count === ROUNDS.length;
      const dots = ROUNDS.map((n) => `<span class="dot ${r[n] ? "on" : ""}">${r[n] ? r[n].hits : ""}</span>`).join("");
      return `
        <li>
          <a class="status-item status-compact" href="#/records?date=${date}&player=${p.id}">
            <span class="status-name">${escapeHTML(displayName(p, state.players))}</span>
            <span class="dots">${dots}</span>
            <span class="badge ${done ? "done" : ""}">${done ? "완료" : count ? "진행중" : "미입력"}</span>
          </a>
        </li>`;
    }).join("");
  }

  // ── 최근 기록 ──────────────────────────────
  function renderRecent() {
    if (!state.recent) return;
    const list = state.recent.filter((r) => !r.deleted);
    $("#recent-list").innerHTML = list.length ? list.map((r) => `
      <li class="recent-item">
        <span class="recent-name">${escapeHTML(r.playerName)}</span>
        <span class="muted">${r.date === date ? "오늘" : r.date.slice(5).replace("-", "/")} · ${r.round}회차</span>
        <span class="recent-hits">${r.hits}<small>/5</small></span>
        <span class="muted recent-time">${formatTime(r.updatedAt)}</span>
      </li>`).join("")
      : `<li class="empty">최근 기록이 없습니다.</li>`;
  }

  function renderAll() {
    renderStats();
    renderRanking();
    renderStatus();
    renderRecent();
  }
  renderAll();

  // ── 실시간 구독 ────────────────────────────
  const onErr = () => toast("데이터를 불러오지 못했습니다.", "error");
  const unsubs = [
    watchPlayers((p) => { state.players = p; renderAll(); }, onErr),
    watchRecordsByDate(date, (r) => { state.records = r; renderAll(); }, onErr),
    watchRecentRecords(RECENT_LIMIT, (r) => { state.recent = r; renderRecent(); }, onErr),
    watchPracticeByDate(date, (r) => { state.practice = r; renderStats(); }, onErr),
  ];

  return () => unsubs.forEach((u) => u());
}

function statCard(label, value, unit) {
  return `
    <div class="stat-card">
      <span class="stat-label">${label}</span>
      <span class="stat-value">${value}${unit ? `<small>${unit}</small>` : ""}</span>
    </div>`;
}

/** 순위표 행 (대시보드 · 기록 조회 공용) */
export function rankingRows(ranking, players, { withRounds = false } = {}) {
  const dupNames = new Set();
  if (players) {
    const seen = new Map();
    players.forEach((p) => seen.set(p.name, (seen.get(p.name) || 0) + 1));
    seen.forEach((c, n) => c > 1 && dupNames.add(n));
  }
  return ranking.map((p) => {
    const cls = p.rank && p.rank <= 3 ? `rank-${p.rank}` : "";
    const rankCell = p.rank
      ? `<span class="rank-num">${p.rank}</span>`
      : `<span class="badge">진행중</span>`;
    const player = players?.find((x) => x.id === p.playerId);
    const tail = dupNames.has(p.playerName) && player?.phone ? ` <small class="muted">(${player.phone.replace(/\D/g, "").slice(-4)})</small>` : "";
    const rounds = withRounds
      ? ROUNDS.map((n) => `<td class="round-cell">${p.rounds[n] ?? "<span class=\"muted\">·</span>"}</td>`).join("")
      : "";
    return `
      <tr class="${cls} ${p.complete ? "" : "row-pending"}">
        <td>${rankCell}</td>
        <td><a class="name-link" href="#/history?tab=player&player=${p.playerId}">${escapeHTML(p.playerName)}</a>${tail}</td>
        ${rounds}
        <td><strong>${p.hits}</strong></td>
        ${withRounds ? "" : `<td>${p.arrows}</td>`}
        <td class="${withRounds ? "col-rate" : ""}">${formatRate(p.rate)}</td>
      </tr>`;
  }).join("");
}
