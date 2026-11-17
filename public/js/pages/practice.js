// 연습 기록 입력 — 회차 제한 없이(최대 50) 0~5 를 누를 때마다 다음 회차로 추가
import { watchPlayers } from "../data/players.js";
import {
  watchPracticeByDate, savePracticeRound, updatePracticeHits, softDeletePractice, summarizePractice,
} from "../data/practice.js";
import {
  todayKST, formatDateKR, ARROWS_PER_ROUND, PRACTICE_MAX_ROUNDS, formatRate,
  escapeHTML, toast, displayName,
} from "../utils.js";

/** 기록 입력 화면 상단 공식/연습 전환 탭 (records.js 와 공용) */
export function modeTabsHTML(mode, date, playerId) {
  const q = (m) => {
    const p = new URLSearchParams({ date });
    if (playerId) p.set("player", playerId);
    if (m === "practice") p.set("mode", "practice");
    return `#/records?${p}`;
  };
  return `
    <div class="tabs mode-tabs" role="tablist">
      <a role="tab" class="tab ${mode === "official" ? "active" : ""}" href="${q("official")}">공식 기록</a>
      <a role="tab" class="tab ${mode === "practice" ? "active" : ""}" href="${q("practice")}">연습 기록</a>
    </div>`;
}

export async function renderPractice(view, params) {
  const today = todayKST();
  const state = {
    date: /^\d{4}-\d{2}-\d{2}$/.test(params.date || "") && params.date <= today ? params.date : today,
    playerId: params.player || "",
    players: [],
    records: [],
    loaded: false,
    editRound: null, // 수정 중인 회차 번호 (null 이면 '추가' 모드)
    busy: false,
  };

  view.innerHTML = `
    <div id="mode-tabs"></div>
    <section class="card">
      <div class="form-row">
        <label class="field">
          <span>날짜</span>
          <input type="date" id="pr-date" value="${state.date}" max="${today}" />
        </label>
        <label class="field">
          <span>선수</span>
          <select id="pr-player"><option value="">불러오는 중…</option></select>
        </label>
      </div>
      <p class="muted date-caption" id="pr-caption"></p>
    </section>

    <section class="card practice-card" id="pr-card">
      <div class="card-head">
        <h2 id="pr-title">연습 기록</h2>
        <span class="badge badge-practice">순위 미반영</span>
      </div>
      <div id="pr-body"></div>
    </section>

    <section class="card">
      <div class="card-head"><h2>오늘 연습한 선수</h2><span class="muted" id="pr-count"></span></div>
      <ul class="status-list" id="pr-list"><li class="empty">불러오는 중…</li></ul>
    </section>
  `;

  const $ = (s) => view.querySelector(s);
  const select = $("#pr-player");
  const summary = () => summarizePractice(state.records);

  function syncURL() {
    const p = new URLSearchParams({ date: state.date, mode: "practice" });
    if (state.playerId) p.set("player", state.playerId);
    history.replaceState(null, "", `#/records?${p}`);
    $("#mode-tabs").innerHTML = modeTabsHTML("practice", state.date, state.playerId);
  }

  // ── 선수 선택 ──────────────────────────────
  function renderSelect() {
    const sum = summary();
    const list = state.players.filter((p) => p.status === "active" || sum[p.id]);
    if (!list.length) {
      select.innerHTML = `<option value="">활동 선수가 없습니다</option>`;
      select.disabled = true;
      return;
    }
    select.disabled = false;
    select.innerHTML = `<option value="">선수를 선택하세요</option>` + list.map((p) => {
      const n = sum[p.id]?.rounds.length || 0;
      return `<option value="${p.id}" ${p.id === state.playerId ? "selected" : ""}>${escapeHTML(displayName(p, state.players))}${n ? ` — ${n}회차` : ""}${p.status !== "active" ? " · 비활성" : ""}</option>`;
    }).join("");
  }

  // ── 입력 영역 ──────────────────────────────
  function renderBody() {
    const body = $("#pr-body");
    const player = state.players.find((p) => p.id === state.playerId);
    if (!player) {
      $("#pr-title").textContent = "연습 기록";
      body.innerHTML = `<div class="empty">선수를 선택하면 연습 기록을 입력할 수 있습니다.</div>`;
      return;
    }
    $("#pr-title").textContent = `${displayName(player, state.players)} 연습`;

    const data = summary()[player.id] || { rounds: [], hits: 0, arrows: 0, rate: null };
    const rounds = data.rounds;
    const last = rounds.at(-1);
    const nextRound = rounds.length + 1;
    const full = rounds.length >= PRACTICE_MAX_ROUNDS;
    if (state.editRound && !rounds.some((r) => r.round === state.editRound)) state.editRound = null;
    const editing = state.editRound ? rounds.find((r) => r.round === state.editRound) : null;

    const prompt = editing
      ? `<strong>${editing.round}회차</strong> 수정 중 · 현재 ${editing.hits}중`
      : full ? `하루 최대 ${PRACTICE_MAX_ROUNDS}회차까지 기록할 수 있습니다.`
      : `<strong>${nextRound}회차</strong> 명중 수를 누르세요`;

    const buttons = Array.from({ length: ARROWS_PER_ROUND + 1 }, (_, i) => `
      <button type="button" class="hit-btn hit-btn-lg ${editing?.hits === i ? "selected" : ""}"
        data-hits="${i}" ${state.busy || (!editing && full) ? "disabled" : ""}>${i}</button>`).join("");

    const chips = rounds.length ? rounds.map((r) => `
      <button type="button" class="chip ${r.round === state.editRound ? "editing" : ""} hits-${r.hits}"
        data-round="${r.round}" title="${r.round}회차 · 눌러서 수정">
        <small>${r.round}</small>${r.hits}
      </button>`).join("")
      : `<span class="muted small">아직 기록이 없습니다.</span>`;

    body.innerHTML = `
      <p class="pr-prompt ${editing ? "is-editing" : ""}">${prompt}</p>
      <div class="hit-buttons">${buttons}</div>
      <div class="pr-actions">
        ${editing ? `<button type="button" class="btn btn-ghost btn-sm" data-act="cancel">수정 취소</button>` : ""}
        ${editing && editing.round === last?.round ? `<button type="button" class="btn btn-ghost btn-sm danger-text" data-act="delete">${editing.round}회차 삭제</button>` : ""}
        ${!editing && last ? `<button type="button" class="btn btn-ghost btn-sm" data-act="undo">↶ 방금 회차(${last.round}회차) 삭제</button>` : ""}
      </div>
      <div class="summary-row summary-4">
        <div><span class="muted">회차</span><strong>${rounds.length}</strong></div>
        <div><span class="muted">명중</span><strong>${data.hits}</strong></div>
        <div><span class="muted">발수</span><strong>${data.arrows}</strong></div>
        <div><span class="muted">명중률</span><strong>${formatRate(data.rate)}</strong></div>
      </div>
      <div class="chips" aria-label="회차별 기록">${chips}</div>`;
  }

  // ── 오늘 연습한 선수 ───────────────────────
  function renderList() {
    if (!state.loaded) return;
    const list = Object.values(summary()).sort((a, b) => b.rounds.length - a.rounds.length);
    $("#pr-count").textContent = list.length ? `${list.length}명` : "";
    $("#pr-list").innerHTML = list.length ? list.map((p) => {
      const player = state.players.find((x) => x.id === p.playerId);
      const name = player ? displayName(player, state.players) : p.playerName;
      return `
        <li>
          <button type="button" class="status-item status-practice ${p.playerId === state.playerId ? "current" : ""}" data-player="${p.playerId}">
            <span class="status-name">${escapeHTML(name)}</span>
            <span class="muted">${p.rounds.length}회차 · ${p.hits}/${p.arrows}</span>
            <span class="status-total">${formatRate(p.rate)}</span>
          </button>
        </li>`;
    }).join("") : `<li class="empty">이 날짜에는 연습 기록이 없습니다.</li>`;
  }

  function renderAll() {
    $("#pr-caption").textContent = formatDateKR(state.date) + (state.date === today ? " · 오늘" : " · 지난 날짜");
    renderSelect();
    renderBody();
    renderList();
  }

  // ── 구독 ───────────────────────────────────
  const unsubPlayers = watchPlayers((p) => { state.players = p; renderAll(); },
    () => toast("선수 목록을 불러오지 못했습니다.", "error"));
  let unsubRec = null;
  function subscribe() {
    unsubRec?.();
    state.records = []; state.loaded = false;
    unsubRec = watchPracticeByDate(state.date, (r) => { state.records = r; state.loaded = true; renderAll(); },
      () => toast("연습 기록을 불러오지 못했습니다.", "error"));
  }
  subscribe();
  syncURL();
  renderAll();

  // ── 이벤트 ─────────────────────────────────
  $("#pr-date").addEventListener("change", (e) => {
    const v = e.target.value;
    if (!v || v > today) { e.target.value = state.date; return; }
    state.date = v; state.editRound = null;
    syncURL(); subscribe(); renderAll();
  });
  select.addEventListener("change", () => {
    state.playerId = select.value; state.editRound = null;
    syncURL(); renderAll();
  });
  $("#pr-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-player]");
    if (!b) return;
    state.playerId = b.dataset.player; state.editRound = null;
    syncURL(); renderAll();
    $("#pr-card").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("#pr-body").addEventListener("click", async (e) => {
    if (state.busy) return;
    const player = state.players.find((p) => p.id === state.playerId);
    if (!player) return;
    const rounds = summary()[player.id]?.rounds || [];
    const last = rounds.at(-1);

    // 칩 → 수정 모드
    const chip = e.target.closest(".chip");
    if (chip) {
      const n = Number(chip.dataset.round);
      state.editRound = state.editRound === n ? null : n;
      renderBody();
      return;
    }

    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "cancel") { state.editRound = null; renderBody(); return; }
    if (act === "undo" || act === "delete") {
      if (!last) return;
      if (!confirm(`${last.round}회차 연습 기록(${last.hits}중)을 삭제할까요?`)) return;
      state.editRound = null;
      await run(() => softDeletePractice(last.id), `${last.round}회차를 삭제했습니다.`);
      return;
    }

    const btn = e.target.closest(".hit-btn");
    if (!btn || btn.disabled) return;
    const hits = Number(btn.dataset.hits);
    if (!(hits >= 0 && hits <= ARROWS_PER_ROUND)) return;

    if (state.editRound) {
      const rec = rounds.find((r) => r.round === state.editRound);
      if (!rec) return;
      const n = rec.round;
      state.editRound = null;
      if (rec.hits === hits) { renderBody(); return; }
      await run(() => updatePracticeHits(rec.id, hits), `${n}회차를 ${hits}중으로 수정했습니다.`);
    } else {
      const n = rounds.length + 1;
      if (n > PRACTICE_MAX_ROUNDS) return;
      await run(() => savePracticeRound({ date: state.date, player, round: n, hits }), `${n}회차 ${hits}중`);
    }
  });

  async function run(task, msg) {
    state.busy = true; renderBody();
    try {
      await task();
      toast(msg);
    } catch (err) {
      console.error(err);
      toast(err?.code === "permission-denied" ? "저장이 거부되었습니다. 보안 규칙을 확인해 주세요." : "저장하지 못했습니다.", "error");
    } finally {
      state.busy = false; renderBody();
    }
  }

  return () => { unsubPlayers(); unsubRec?.(); };
}
