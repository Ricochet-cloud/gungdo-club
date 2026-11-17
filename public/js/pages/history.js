// 기록 조회 — 날짜별 순위표 / 선수별 기록 이력 + 추이 그래프
import { fetchPlayers } from "../data/players.js";
import { watchRecordsByDate, fetchRecordsByPlayer } from "../data/records.js";
import { watchPracticeByDate, fetchPracticeByPlayer, summarizePractice } from "../data/practice.js";
import { rankingRows } from "./dashboard.js";
import {
  todayKST, formatDateKR, addDays, ROUNDS, ARROWS_PER_ROUND, MAX_ARROWS_PER_DAY,
  hitRate, formatRate, buildDailyRanking, escapeHTML, toast, displayName,
} from "../utils.js";

const CHART_DAYS = 30;

export async function render(view, params) {
  const today = todayKST();
  const tab = params.tab === "player" ? "player" : "date";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date || "") && params.date <= today ? params.date : today;

  view.innerHTML = `
    <div class="tabs" role="tablist">
      <a role="tab" class="tab ${tab === "date" ? "active" : ""}" href="#/history?tab=date&date=${date}">날짜별</a>
      <a role="tab" class="tab ${tab === "player" ? "active" : ""}" href="#/history?tab=player${params.player ? `&player=${params.player}` : ""}">선수별</a>
    </div>
    <div id="tab-body"></div>
  `;
  const body = view.querySelector("#tab-body");
  return tab === "date" ? renderByDate(body, date, today) : renderByPlayer(body, params.player, params.kind === "practice" ? "practice" : "official");
}

// ════════════════ 날짜별 ════════════════
async function renderByDate(body, date, today) {
  const go = (d) => { location.hash = `#/history?tab=date&date=${d}`; };

  body.innerHTML = `
    <section class="card">
      <div class="date-nav">
        <button type="button" class="btn btn-ghost btn-sm" id="prev-day" aria-label="이전 날">‹</button>
        <input type="date" id="hist-date" value="${date}" max="${today}" />
        <button type="button" class="btn btn-ghost btn-sm" id="next-day" aria-label="다음 날" ${date >= today ? "disabled" : ""}>›</button>
        ${date !== today ? `<button type="button" class="btn btn-ghost btn-sm" id="to-today">오늘</button>` : ""}
      </div>
      <h2 class="date-title">${formatDateKR(date)}</h2>
    </section>

    <section class="stat-grid" id="day-stats"></section>

    <section class="card">
      <div class="card-head"><h2>순위</h2><span class="muted small">3회차 완료 선수만 순위 부여</span></div>
      <div class="table-wrap">
        <table class="rank-table">
          <thead><tr><th>순위</th><th>선수</th><th>1회</th><th>2회</th><th>3회</th><th>명중</th><th>명중률</th></tr></thead>
          <tbody id="day-body"><tr><td colspan="7" class="empty">불러오는 중…</td></tr></tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>이날 연습</h2><span class="badge badge-practice">순위 미반영</span></div>
      <ul class="status-list" id="day-practice"><li class="empty">불러오는 중…</li></ul>
    </section>
  `;

  const $ = (s) => body.querySelector(s);
  $("#hist-date").addEventListener("change", (e) => e.target.value && e.target.value <= today && go(e.target.value));
  $("#prev-day").addEventListener("click", () => go(addDays(date, -1)));
  $("#next-day").addEventListener("click", () => date < today && go(addDays(date, 1)));
  $("#to-today")?.addEventListener("click", () => go(today));

  let players = [];
  fetchPlayers().then((p) => { players = p; draw(); drawPractice?.(); }).catch(() => {});

  let records = null;
  function draw() {
    if (!records) return;
    const ranking = buildDailyRanking(records);
    const done = ranking.filter((p) => p.complete).length;
    const hits = ranking.reduce((s, p) => s + p.hits, 0);
    const arrows = ranking.reduce((s, p) => s + p.arrows, 0);
    const top = ranking.find((p) => p.rank === 1);
    $("#day-stats").innerHTML = [
      stat("참여", ranking.length, "명"),
      stat("3회차 완료", done, "명"),
      stat("총 명중", hits, "중"),
      stat("전체 명중률", formatRate(hitRate(hits, arrows)), ""),
      stat("최고 기록", top ? top.hits : "—", top ? `/${MAX_ARROWS_PER_DAY}` : ""),
    ].join("");
    $("#day-body").innerHTML = ranking.length
      ? rankingRows(ranking, players, { withRounds: true })
      : `<tr><td colspan="7" class="empty">이 날짜에는 기록이 없습니다.</td></tr>`;
  }

  let practice = null;
  function drawPractice() {
    if (!practice) return;
    const list = Object.values(summarizePractice(practice)).sort((a, b) => b.rounds.length - a.rounds.length);
    $("#day-practice").innerHTML = list.length ? list.map((p) => {
      const pl = players.find((x) => x.id === p.playerId);
      return `
        <li class="practice-row">
          <a class="name-link" href="#/history?tab=player&player=${p.playerId}&kind=practice">${escapeHTML(pl ? displayName(pl, players) : p.playerName)}</a>
          <span class="muted">${p.rounds.length}회차 · ${p.hits}/${p.arrows}발</span>
          <strong>${formatRate(p.rate)}</strong>
          <span class="mini-chips">${p.rounds.map((r) => `<span class="mini-chip hits-${r.hits}">${r.hits}</span>`).join("")}</span>
        </li>`;
    }).join("") : `<li class="empty">이 날짜에는 연습 기록이 없습니다.</li>`;
  }

  const unsubs = [
    watchRecordsByDate(date, (r) => { records = r; draw(); },
      () => toast("기록을 불러오지 못했습니다.", "error")),
    watchPracticeByDate(date, (r) => { practice = r; drawPractice(); },
      () => toast("연습 기록을 불러오지 못했습니다.", "error")),
  ];
  return () => unsubs.forEach((u) => u());
}

// ════════════════ 선수별 ════════════════
async function renderByPlayer(body, playerId, kind) {
  body.innerHTML = `
    <section class="card">
      <label class="field">
        <span>선수 선택</span>
        <select id="hist-player"><option value="">불러오는 중…</option></select>
      </label>
      ${playerId ? `
      <div class="tabs kind-tabs" role="tablist">
        <a role="tab" class="tab ${kind === "official" ? "active" : ""}" href="#/history?tab=player&player=${playerId}">공식 기록</a>
        <a role="tab" class="tab ${kind === "practice" ? "active" : ""}" href="#/history?tab=player&player=${playerId}&kind=practice">연습 기록</a>
      </div>` : ""}
    </section>
    <div id="player-body"></div>
  `;
  const select = body.querySelector("#hist-player");
  const out = body.querySelector("#player-body");

  let players = [];
  try {
    players = await fetchPlayers();
  } catch {
    toast("선수 목록을 불러오지 못했습니다.", "error");
  }
  select.innerHTML = `<option value="">선수를 선택하세요</option>` + players.map((p) =>
    `<option value="${p.id}" ${p.id === playerId ? "selected" : ""}>${escapeHTML(p.name)}${p.phone && players.filter((x) => x.name === p.name).length > 1 ? ` (${p.phone.replace(/\D/g, "").slice(-4)})` : ""}${p.status !== "active" ? " · 비활성" : ""}</option>`
  ).join("");
  select.addEventListener("change", (e) => {
    location.hash = `#/history?tab=player${e.target.value ? `&player=${e.target.value}` : ""}${kind === "practice" ? "&kind=practice" : ""}`;
  });

  const player = players.find((p) => p.id === playerId);
  if (!player) {
    out.innerHTML = `<section class="card"><div class="empty">선수를 선택하면 기록 이력과 추이 그래프가 표시됩니다.</div></section>`;
    return;
  }

  if (kind === "practice") return renderPlayerPractice(out, player);

  out.innerHTML = `<section class="card"><div class="empty">불러오는 중…</div></section>`;
  let records = [];
  try {
    records = await fetchRecordsByPlayer(player.id);
  } catch (err) {
    console.error(err);
    out.innerHTML = `<section class="card"><div class="empty">기록을 불러오지 못했습니다.</div></section>`;
    return;
  }

  // 날짜별로 묶기 (최신순)
  const byDate = new Map();
  for (const r of records) {
    if (!byDate.has(r.date)) byDate.set(r.date, { date: r.date, rounds: {}, hits: 0, arrows: 0 });
    const d = byDate.get(r.date);
    d.rounds[r.round] = r.hits;
    d.hits += r.hits;
    d.arrows += r.arrowsShot;
  }
  const days = [...byDate.values()]
    .map((d) => ({ ...d, complete: ROUNDS.every((n) => d.rounds[n] != null), rate: hitRate(d.hits, d.arrows) }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const completeDays = days.filter((d) => d.complete);

  const totalHits = days.reduce((s, d) => s + d.hits, 0);
  const totalArrows = days.reduce((s, d) => s + d.arrows, 0);
  const best = completeDays.reduce((m, d) => (d.hits > (m?.hits ?? -1) ? d : m), null);

  out.innerHTML = `
    <section class="stat-grid">
      ${stat("참여 일수", days.length, "일")}
      ${stat("개인 최고", best ? best.hits : "—", best ? `/${MAX_ARROWS_PER_DAY}` : "")}
      ${stat("평균 명중", completeDays.length ? (completeDays.reduce((s, d) => s + d.hits, 0) / completeDays.length).toFixed(1) : "—", completeDays.length ? "중" : "")}
      ${stat("전체 명중률", formatRate(hitRate(totalHits, totalArrows)), "")}
    </section>

    <section class="card">
      <div class="card-head">
        <h2>기록 추이</h2>
        <span class="muted small">최근 ${CHART_DAYS}회 · 하루 총 명중 (3회차 완료일)</span>
      </div>
      <div class="chart" id="trend"></div>
    </section>

    <section class="card">
      <div class="card-head"><h2>날짜별 기록</h2>${best ? `<span class="muted small">최고 ${best.hits}중 · ${best.date}</span>` : ""}</div>
      <div class="table-wrap">
        <table class="rank-table">
          <thead><tr><th>날짜</th><th>1회</th><th>2회</th><th>3회</th><th>명중</th><th>명중률</th></tr></thead>
          <tbody>${days.length ? days.map((d) => `
            <tr class="${d.complete ? "" : "row-pending"} ${best && d.date === best.date ? "row-best" : ""}">
              <td><a class="name-link" href="#/history?tab=date&date=${d.date}">${d.date}</a></td>
              ${ROUNDS.map((n) => `<td class="round-cell">${d.rounds[n] ?? '<span class="muted">·</span>'}</td>`).join("")}
              <td><strong>${d.hits}</strong>${d.complete ? "" : ' <span class="badge">진행중</span>'}</td>
              <td>${formatRate(d.rate)}</td>
            </tr>`).join("") : `<tr><td colspan="6" class="empty">아직 기록이 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;

  drawTrend(out.querySelector("#trend"), [...completeDays].reverse().slice(-CHART_DAYS), {
    value: (p) => p.hits, max: MAX_ARROWS_PER_DAY, ticks: [0, 5, 10, 15],
    tip: (p) => `<span>${p.hits}중 / ${p.arrows}발 · ${formatRate(p.rate)}</span>
      <span class="muted">${ROUNDS.map((n) => `${n}회 ${p.rounds[n]}`).join(" · ")}</span>`,
    empty: "3회차를 모두 마친 날이 생기면 그래프가 표시됩니다.",
    label: "하루 총 명중 추이",
  });
}

// ── 선수별 연습 기록 ──
async function renderPlayerPractice(out, player) {
  out.innerHTML = `<section class="card"><div class="empty">불러오는 중…</div></section>`;
  let records = [];
  try {
    records = await fetchPracticeByPlayer(player.id);
  } catch (err) {
    console.error(err);
    out.innerHTML = `<section class="card"><div class="empty">연습 기록을 불러오지 못했습니다.</div></section>`;
    return;
  }
  const byDate = new Map();
  for (const r of records) {
    if (!byDate.has(r.date)) byDate.set(r.date, { date: r.date, rounds: [], hits: 0, arrows: 0 });
    const d = byDate.get(r.date);
    d.rounds.push(r);
    d.hits += r.hits;
    d.arrows += r.arrowsShot;
  }
  const days = [...byDate.values()].map((d) => ({
    ...d, rounds: d.rounds.sort((a, b) => a.round - b.round), rate: hitRate(d.hits, d.arrows),
  })).sort((a, b) => b.date.localeCompare(a.date));

  const totalHits = days.reduce((s, d) => s + d.hits, 0);
  const totalArrows = days.reduce((s, d) => s + d.arrows, 0);
  const totalRounds = days.reduce((s, d) => s + d.rounds.length, 0);
  const bestRate = days.reduce((m, d) => (d.rate > (m?.rate ?? -1) ? d : m), null);

  out.innerHTML = `
    <section class="stat-grid">
      ${stat("연습 일수", days.length, "일")}
      ${stat("총 회차", totalRounds, "회")}
      ${stat("총 발수", totalArrows, "발")}
      ${stat("연습 명중률", formatRate(hitRate(totalHits, totalArrows)), "")}
    </section>

    <section class="card">
      <div class="card-head">
        <h2>연습 명중률 추이</h2>
        <span class="muted small">최근 ${CHART_DAYS}일 · 하루 명중률</span>
      </div>
      <div class="chart" id="trend"></div>
    </section>

    <section class="card">
      <div class="card-head"><h2>날짜별 연습</h2>${bestRate ? `<span class="muted small">최고 ${formatRate(bestRate.rate)} · ${bestRate.date}</span>` : ""}</div>
      <ul class="status-list">${days.length ? days.map((d) => `
        <li class="practice-row">
          <a class="name-link" href="#/history?tab=date&date=${d.date}">${d.date}</a>
          <span class="muted">${d.rounds.length}회차 · ${d.hits}/${d.arrows}발</span>
          <strong>${formatRate(d.rate)}</strong>
          <span class="mini-chips">${d.rounds.map((r) => `<span class="mini-chip hits-${r.hits}">${r.hits}</span>`).join("")}</span>
        </li>`).join("") : `<li class="empty">아직 연습 기록이 없습니다.</li>`}
      </ul>
    </section>
  `;

  drawTrend(out.querySelector("#trend"), [...days].reverse().slice(-CHART_DAYS), {
    value: (p) => p.rate, max: 100, ticks: [0, 25, 50, 75, 100], unit: "%",
    tip: (p) => `<span>${formatRate(p.rate)} · ${p.hits}/${p.arrows}발</span><span class="muted">${p.rounds.length}회차</span>`,
    empty: "연습 기록이 생기면 그래프가 표시됩니다.",
    label: "연습 명중률 추이",
  });
}

// ── 추이 그래프 (단일 계열 SVG 라인 + 호버 툴팁) ──
function drawTrend(el, points, opt) {
  if (points.length === 0) {
    el.innerHTML = `<div class="empty">${opt.empty}</div>`;
    return;
  }
  const W = 640, H = 220, padL = 36, padR = 16, padT = 16, padB = 28;
  const iw = W - padL - padR, ih = H - padT - padB;
  const x = (i) => padL + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => padT + ih - (v / opt.max) * ih;
  const val = (p) => opt.value(p);

  const grid = opt.ticks.map((v) => `
    <line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" class="grid-line" />
    <text x="${padL - 8}" y="${y(v) + 4}" class="axis-label" text-anchor="end">${v}${opt.unit && v === opt.max ? opt.unit : ""}</text>`).join("");

  const labelIdx = points.length <= 6 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const xLabels = labelIdx.map((i) =>
    `<text x="${x(i)}" y="${H - 8}" class="axis-label" text-anchor="middle">${points[i].date.slice(5).replace("-", "/")}</text>`).join("");

  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(val(p)).toFixed(1)}`).join(" ");
  const dots = points.map((p, i) => `<circle cx="${x(i)}" cy="${y(val(p))}" r="4" class="trend-dot" data-i="${i}" />`).join("");
  const step = points.length > 1 ? iw / (points.length - 1) : iw;
  const hits = points.map((p, i) => `<rect x="${x(i) - step / 2}" y="${padT}" width="${step}" height="${ih}" fill="transparent" data-i="${i}" />`).join("");

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="trend-svg" role="img" aria-label="${opt.label}">
      ${grid}
      ${xLabels}
      <line class="crosshair" x1="0" x2="0" y1="${padT}" y2="${padT + ih}" visibility="hidden" />
      ${points.length > 1 ? `<path d="${path}" class="trend-line" />` : ""}
      ${dots}
      <g class="hit-layer">${hits}</g>
    </svg>
    <div class="chart-tip" hidden></div>
  `;

  const svg = el.querySelector("svg");
  const tip = el.querySelector(".chart-tip");
  const cross = el.querySelector(".crosshair");
  const allDots = el.querySelectorAll(".trend-dot");

  function show(i) {
    const p = points[i];
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i));
    cross.setAttribute("visibility", "visible");
    allDots.forEach((d) => d.classList.toggle("active", Number(d.dataset.i) === i));
    tip.hidden = false;
    tip.innerHTML = `<strong>${formatDateKR(p.date)}</strong>${opt.tip(p)}`;
    const box = svg.getBoundingClientRect();
    tip.style.left = `${Math.min(Math.max((x(i) / W) * box.width, 90), box.width - 90)}px`;
    tip.style.top = `${(y(val(p)) / H) * box.height}px`;
  }
  function hide() {
    cross.setAttribute("visibility", "hidden");
    allDots.forEach((d) => d.classList.remove("active"));
    tip.hidden = true;
  }
  el.querySelectorAll(".hit-layer rect").forEach((r) => {
    r.addEventListener("pointerenter", () => show(Number(r.dataset.i)));
    r.addEventListener("pointerdown", () => show(Number(r.dataset.i)));
  });
  svg.addEventListener("pointerleave", hide);
}

function stat(label, value, unit) {
  return `
    <div class="stat-card">
      <span class="stat-label">${label}</span>
      <span class="stat-value">${value}${unit ? `<small>${unit}</small>` : ""}</span>
    </div>`;
}
