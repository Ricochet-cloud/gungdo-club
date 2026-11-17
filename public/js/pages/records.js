// 기록 입력 — 날짜·선수 선택 → 회차별 명중 수 입력 (1→2→3 순서)
import { watchPlayers } from "../data/players.js";
import { renderPractice, modeTabsHTML } from "./practice.js";
import { trackWrite, settleLocal } from "../sync.js";
import { mountWakeToggle } from "../wakelock.js";
import { watchRecordsByDate, saveRound, updateHits, softDeleteRound, groupByPlayer } from "../data/records.js";
import {
  todayKST, formatDateKR, ROUNDS, ARROWS_PER_ROUND, hitRate, formatRate, escapeHTML, toast,
} from "../utils.js";

export async function render(view, params) {
  if (params.mode === "practice") return renderPractice(view, params);
  const today = todayKST();
  const state = {
    date: isValidDate(params.date) && params.date <= today ? params.date : today,
    playerId: params.player || "",
    players: [],
    records: [],
    playersLoaded: false,
    recordsLoaded: false,
    busy: false,
  };

  view.innerHTML = `
    <div class="input-toolbar">
      <div id="mode-tabs">${modeTabsHTML("official", state.date, state.playerId)}</div>
      <button type="button" class="btn btn-ghost wake-btn" id="wake-btn" aria-pressed="false"></button>
    </div>
    <section class="card">
      <div class="form-row">
        <label class="field">
          <span>날짜</span>
          <input type="date" id="rec-date" value="${state.date}" max="${today}" />
        </label>
        <label class="field">
          <span>선수</span>
          <select id="rec-player"><option value="">불러오는 중…</option></select>
        </label>
      </div>
      <p class="muted date-caption" id="date-caption"></p>
    </section>

    <section class="card" id="round-card">
      <div class="card-head">
        <h2 id="round-title">회차별 명중</h2>
        <span class="badge" id="round-badge" hidden></span>
      </div>
      <div class="round-list" id="round-list"></div>
      <div class="summary-row" id="summary"></div>
      <div id="next-wrap"></div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>입력 현황</h2>
        <span class="muted" id="status-count"></span>
      </div>
      <ul class="status-list" id="status-list"><li class="empty">불러오는 중…</li></ul>
    </section>
  `;

  const $ = (s) => view.querySelector(s);
  const dateInput = $("#rec-date");
  const playerSelect = $("#rec-player");

  // ── 파생 데이터 ────────────────────────────
  const byPlayer = () => groupByPlayer(state.records);

  // 입력 대상: 활동 선수 + (비활성이어도) 그 날짜에 기록이 있는 선수
  function targetPlayers() {
    const grouped = byPlayer();
    return state.players.filter((p) => p.status === "active" || grouped[p.id]);
  }

  function displayName(p) {
    const dup = state.players.filter((x) => x.name === p.name).length > 1;
    if (!dup) return p.name;
    const tail = p.phone ? p.phone.replace(/\D/g, "").slice(-4) : p.joinedAt;
    return `${p.name} (${tail})`;
  }

  // ── 렌더: 선수 선택 ────────────────────────
  function renderSelect() {
    if (!state.playersLoaded) return;
    const list = targetPlayers();
    const grouped = byPlayer();
    if (!list.length) {
      playerSelect.innerHTML = `<option value="">활동 선수가 없습니다</option>`;
      playerSelect.disabled = true;
      return;
    }
    playerSelect.disabled = false;
    if (state.playerId && !list.some((p) => p.id === state.playerId)) state.playerId = "";
    playerSelect.innerHTML = `<option value="">선수를 선택하세요</option>` + list.map((p) => {
      const done = Object.keys(grouped[p.id] || {}).length;
      const mark = done === ROUNDS.length ? "✓ 완료" : `${done}/${ROUNDS.length}`;
      const inactive = p.status !== "active" ? " · 비활성" : "";
      return `<option value="${p.id}" ${p.id === state.playerId ? "selected" : ""}>${escapeHTML(displayName(p))} — ${mark}${inactive}</option>`;
    }).join("");
  }

  // ── 렌더: 회차 입력 ────────────────────────
  function renderRounds() {
    const listEl = $("#round-list");
    const summaryEl = $("#summary");
    const badge = $("#round-badge");
    const player = state.players.find((p) => p.id === state.playerId);

    if (!player) {
      $("#round-title").textContent = "회차별 명중";
      badge.hidden = true;
      listEl.innerHTML = `<div class="empty">선수를 선택하면 회차를 입력할 수 있습니다.</div>`;
      summaryEl.hidden = true;
      $("#next-wrap").innerHTML = "";
      return;
    }

    const rounds = byPlayer()[player.id] || {};
    const entered = ROUNDS.filter((n) => rounds[n]);
    const lastEntered = entered.at(-1);

    $("#round-title").textContent = `${displayName(player)} 기록`;
    const complete = entered.length === ROUNDS.length;
    badge.hidden = false;
    badge.textContent = complete ? "기록 완료" : entered.length ? "진행중" : "미입력";
    badge.className = `badge ${complete ? "done" : ""}`;

    listEl.innerHTML = ROUNDS.map((n) => {
      const rec = rounds[n];
      const unlocked = n === 1 || !!rounds[n - 1];
      const disabled = !unlocked || state.busy;
      const statusText = rec ? `${rec.hits}/${ARROWS_PER_ROUND}발` : unlocked ? "미기록" : `${n - 1}회차 입력 후 가능`;
      const buttons = Array.from({ length: ARROWS_PER_ROUND + 1 }, (_, i) => `
        <button type="button" class="hit-btn ${rec?.hits === i ? "selected" : ""}"
          data-round="${n}" data-hits="${i}" ${disabled ? "disabled" : ""}
          aria-label="${n}회차 ${i}중" aria-pressed="${rec?.hits === i}">${i}</button>`).join("");
      return `
        <div class="round ${unlocked ? "" : "locked"} ${rec ? "entered" : ""}">
          <div class="round-head">
            <strong>${n}회차</strong>
            <span class="round-status">
              <span class="${rec ? "round-done" : "muted"}">${statusText}</span>
              ${n === lastEntered ? `<button type="button" class="link-btn" data-delete="${n}" ${state.busy ? "disabled" : ""}>삭제</button>` : ""}
            </span>
          </div>
          <div class="hit-buttons">${buttons}</div>
        </div>`;
    }).join("");

    const hits = entered.reduce((s, n) => s + rounds[n].hits, 0);
    const arrows = entered.length * ARROWS_PER_ROUND;
    summaryEl.hidden = false;
    summaryEl.innerHTML = `
      <div><span class="muted">총 명중</span><strong>${entered.length ? hits : "—"}</strong></div>
      <div><span class="muted">총 발수</span><strong>${entered.length ? arrows : "—"}</strong></div>
      <div><span class="muted">명중률</span><strong>${formatRate(hitRate(hits, arrows))}</strong></div>`;

    // 3회차 완료 → 다음 미완료 선수로 바로 이동
    const next = complete ? nextIncomplete(player.id) : null;
    $("#next-wrap").innerHTML = complete
      ? next
        ? `<button type="button" class="btn btn-primary btn-block next-btn" data-next="${next.id}">다음 선수: ${escapeHTML(displayName(next))} →</button>`
        : `<p class="all-done">🎯 모든 선수 입력 완료</p>`
      : "";
  }

  function nextIncomplete(currentId) {
    const grouped = byPlayer();
    const list = targetPlayers()
      .filter((p) => p.status === "active")
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    const undone = (p) => Object.keys(grouped[p.id] || {}).length < ROUNDS.length;
    const idx = list.findIndex((p) => p.id === currentId);
    const ordered = [...list.slice(idx + 1), ...list.slice(0, Math.max(idx, 0))];
    return ordered.find(undone) || null;
  }

  // ── 렌더: 입력 현황 ────────────────────────
  function renderStatus() {
    const listEl = $("#status-list");
    if (!state.playersLoaded || !state.recordsLoaded) return;
    const list = targetPlayers();
    const grouped = byPlayer();
    const doneCount = list.filter((p) => Object.keys(grouped[p.id] || {}).length === ROUNDS.length).length;
    $("#status-count").textContent = list.length ? `완료 ${doneCount} / ${list.length}명` : "";

    if (!list.length) {
      listEl.innerHTML = `<li class="empty">활동 선수가 없습니다. 선수 관리에서 먼저 등록하세요.</li>`;
      return;
    }
    // 미완료 선수를 위로
    const sorted = [...list].sort((a, b) => {
      const da = Object.keys(grouped[a.id] || {}).length === ROUNDS.length;
      const dbb = Object.keys(grouped[b.id] || {}).length === ROUNDS.length;
      return da - dbb || a.name.localeCompare(b.name, "ko");
    });
    listEl.innerHTML = sorted.map((p) => {
      const r = grouped[p.id] || {};
      const total = ROUNDS.reduce((s, n) => s + (r[n]?.hits ?? 0), 0);
      const count = Object.keys(r).length;
      const done = count === ROUNDS.length;
      const dots = ROUNDS.map((n) =>
        `<span class="dot ${r[n] ? "on" : ""}" title="${n}회차">${r[n] ? r[n].hits : ""}</span>`
      ).join("");
      return `
        <li>
          <button type="button" class="status-item ${p.id === state.playerId ? "current" : ""}" data-player="${p.id}">
            <span class="status-name">${escapeHTML(displayName(p))}</span>
            <span class="dots">${dots}</span>
            <span class="status-total">${count ? `${total}중` : "—"}</span>
            <span class="badge ${done ? "done" : ""}">${done ? "완료" : count ? "진행중" : "미입력"}</span>
          </button>
        </li>`;
    }).join("");
  }

  function renderAll() {
    $("#date-caption").textContent = formatDateKR(state.date) + (state.date === today ? " · 오늘" : " · 지난 날짜 기록");
    renderSelect();
    renderRounds();
    renderStatus();
  }

  // 주소에 현재 날짜/선수 반영 (새로고침해도 유지). hashchange 재렌더 방지 위해 replaceState
  function syncURL() {
    const q = new URLSearchParams({ date: state.date });
    if (state.playerId) q.set("player", state.playerId);
    history.replaceState(null, "", `#/records?${q}`);
    $("#mode-tabs").innerHTML = modeTabsHTML("official", state.date, state.playerId);
  }

  // ── 구독 ───────────────────────────────────
  const unsubPlayers = watchPlayers(
    (players) => { state.players = players; state.playersLoaded = true; renderAll(); },
    () => toast("선수 목록을 불러오지 못했습니다.", "error")
  );

  let unsubRecords = null;
  function subscribeRecords() {
    unsubRecords?.();
    state.recordsLoaded = false;
    state.records = [];
    unsubRecords = watchRecordsByDate(
      state.date,
      (records) => { state.records = records; state.recordsLoaded = true; renderAll(); },
      () => toast("기록을 불러오지 못했습니다.", "error")
    );
  }
  subscribeRecords();
  renderAll();

  // ── 이벤트 ─────────────────────────────────
  dateInput.addEventListener("change", () => {
    const v = dateInput.value;
    if (!isValidDate(v) || v > today) { dateInput.value = state.date; return; }
    state.date = v;
    syncURL();
    subscribeRecords();
    renderAll();
  });

  playerSelect.addEventListener("change", () => {
    state.playerId = playerSelect.value;
    syncURL();
    renderAll();
  });

  $("#next-wrap").addEventListener("click", (e) => {
    const b = e.target.closest("[data-next]");
    if (!b) return;
    state.playerId = b.dataset.next;
    syncURL();
    renderAll();
    $("#round-card").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("#status-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-player]");
    if (!btn) return;
    state.playerId = btn.dataset.player;
    syncURL();
    renderAll();
    $("#round-card").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("#round-list").addEventListener("click", async (e) => {
    if (state.busy) return;
    const player = state.players.find((p) => p.id === state.playerId);
    if (!player) return;
    const rounds = byPlayer()[player.id] || {};

    // 삭제
    const delBtn = e.target.closest("[data-delete]");
    if (delBtn) {
      const n = Number(delBtn.dataset.delete);
      const rec = rounds[n];
      if (!rec || rounds[n + 1]) return; // 마지막 회차만
      if (!confirm(`${player.name} 선수의 ${n}회차 기록(${rec.hits}중)을 삭제할까요?`)) return;
      await run(() => softDeleteRound(rec.id), `${n}회차 기록을 삭제했습니다.`);
      return;
    }

    // 명중 수 입력/수정
    const hitBtn = e.target.closest(".hit-btn");
    if (!hitBtn || hitBtn.disabled) return;
    const n = Number(hitBtn.dataset.round);
    const hits = Number(hitBtn.dataset.hits);
    if (!(hits >= 0 && hits <= ARROWS_PER_ROUND)) return;
    if (n > 1 && !rounds[n - 1]) { toast(`${n - 1}회차를 먼저 입력하세요.`, "error"); return; }

    const rec = rounds[n];
    if (rec) {
      if (rec.hits === hits) return;
      if (!confirm(`${n}회차 기록을 ${rec.hits}중 → ${hits}중으로 수정할까요?`)) return;
      await run(() => updateHits(rec.id, hits), `${n}회차를 ${hits}중으로 수정했습니다.`);
    } else {
      const msg = n === ROUNDS.length ? `${n}회차 ${hits}중 저장 · 기록 완료!` : `${n}회차 ${hits}중 저장`;
      await run(() => saveRound({ date: state.date, player, round: n, hits }), msg);
    }
  });

  // 서버 응답을 기다리지 않음: 폰에 먼저 저장(즉시 화면 반영) → 연결되면 자동 전송
  async function run(task, successMsg) {
    state.busy = true;
    renderRounds();
    const write = trackWrite(task());
    await settleLocal(write);
    if (navigator.onLine) toast(successMsg);
    else toast(`${successMsg} (오프라인)`);
    state.busy = false;
    renderRounds();
  }

  const releaseWake = mountWakeToggle($("#wake-btn"));

  return () => {
    unsubPlayers();
    unsubRecords?.();
    releaseWake();
  };
}

function isValidDate(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
