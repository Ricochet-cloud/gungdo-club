// 선수 관리 — 등록 / 수정 / 활동·비활성 전환 / 검색 / 기록 보기
import { watchPlayers, createPlayer, updatePlayer, setPlayerStatus } from "../data/players.js";
import { todayKST, escapeHTML, toast } from "../utils.js";

export async function render(view) {
  const state = { players: [], search: "", filter: "active", loaded: false };

  view.innerHTML = `
    <section class="toolbar">
      <input type="search" id="player-search" placeholder="이름 또는 연락처 검색" autocomplete="off" />
      <select id="player-filter" aria-label="상태 필터">
        <option value="active">활동</option>
        <option value="inactive">비활성</option>
        <option value="all">전체</option>
      </select>
      <button type="button" class="btn btn-primary" id="add-player-btn">+ 선수 등록</button>
    </section>

    <p class="muted list-count" id="player-count"></p>

    <section class="card card-flush">
      <ul class="player-list" id="player-list">
        <li class="empty">불러오는 중…</li>
      </ul>
    </section>

    ${dialogHTML()}
  `;

  const $ = (sel) => view.querySelector(sel);
  const listEl = $("#player-list");
  const countEl = $("#player-count");
  const dialog = $("#player-dialog");
  const form = $("#player-form");

  // ── 목록 렌더 ──────────────────────────────
  function renderList() {
    if (!state.loaded) return;
    const all = state.players;
    const active = all.filter((p) => p.status === "active").length;
    countEl.textContent = `전체 ${all.length}명 · 활동 ${active}명 · 비활성 ${all.length - active}명`;

    const kw = state.search.trim().toLowerCase();
    const kwDigits = kw.replace(/\D/g, "");
    const rows = all.filter((p) => {
      if (state.filter !== "all" && p.status !== state.filter) return false;
      if (!kw) return true;
      return p.name.toLowerCase().includes(kw)
        || (kwDigits && (p.phone || "").replace(/\D/g, "").includes(kwDigits));
    });

    if (!rows.length) {
      listEl.innerHTML = `<li class="empty">${
        all.length === 0 ? "등록된 선수가 없습니다. ‘+ 선수 등록’으로 시작하세요."
        : kw ? "검색 결과가 없습니다." : "해당 상태의 선수가 없습니다."
      }</li>`;
      return;
    }

    // 동명이인 표시
    const nameCount = all.reduce((m, p) => m.set(p.name, (m.get(p.name) || 0) + 1), new Map());

    listEl.innerHTML = rows.map((p) => {
      const inactive = p.status !== "active";
      const dup = nameCount.get(p.name) > 1;
      const sub = [
        p.joinedAt ? `가입 ${p.joinedAt}` : "",
        p.phone ? escapeHTML(p.phone) : "",
      ].filter(Boolean).join(" · ");
      return `
        <li class="player-item ${inactive ? "is-inactive" : ""}" data-id="${p.id}">
          <div class="player-main">
            <div class="player-name">
              <strong>${escapeHTML(p.name)}</strong>
              ${inactive ? `<span class="badge">비활성</span>` : ""}
              ${dup ? `<span class="badge badge-warn" title="같은 이름의 선수가 있습니다">동명이인</span>` : ""}
            </div>
            <div class="player-sub muted">${sub || "&nbsp;"}</div>
            ${p.memo ? `<div class="player-memo">${escapeHTML(p.memo)}</div>` : ""}
          </div>
          <div class="player-actions">
            <a class="btn btn-ghost btn-sm" href="#/history?tab=player&player=${p.id}">기록</a>
            <button type="button" class="btn btn-ghost btn-sm" data-action="edit">수정</button>
            <button type="button" class="btn btn-ghost btn-sm" data-action="toggle">${inactive ? "활동 전환" : "비활성"}</button>
          </div>
        </li>`;
    }).join("");
  }

  // ── 실시간 구독 ────────────────────────────
  const unsubscribe = watchPlayers(
    (players) => { state.players = players; state.loaded = true; renderList(); },
    () => { listEl.innerHTML = `<li class="empty">선수 목록을 불러오지 못했습니다.</li>`; }
  );

  // ── 검색 / 필터 ────────────────────────────
  $("#player-search").addEventListener("input", (e) => { state.search = e.target.value; renderList(); });
  $("#player-filter").addEventListener("change", (e) => { state.filter = e.target.value; renderList(); });

  // ── 등록 / 수정 다이얼로그 ─────────────────
  function openDialog(player = null) {
    form.reset();
    form.dataset.id = player?.id || "";
    $("#dialog-title").textContent = player ? "선수 정보 수정" : "선수 등록";
    form.name.value = player?.name || "";
    form.phone.value = player?.phone || "";
    form.joinedAt.value = player?.joinedAt || todayKST();
    form.joinedAt.max = todayKST();
    form.memo.value = player?.memo || "";
    $("#name-hint").textContent = player ? "이름을 바꿔도 지난 기록에는 당시 이름이 그대로 남습니다." : "";
    $("#form-error").textContent = "";
    dialog.showModal();
    form.name.focus();
  }

  $("#add-player-btn").addEventListener("click", () => openDialog());
  $("#dialog-cancel").addEventListener("click", () => dialog.close());

  // 연락처 자동 하이픈
  form.phone.addEventListener("input", (e) => { e.target.value = formatPhone(e.target.value); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = $("#form-error");
    const data = {
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      joinedAt: form.joinedAt.value,
      memo: form.memo.value.trim(),
    };
    if (!data.name) { errorEl.textContent = "이름을 입력해 주세요."; form.name.focus(); return; }
    if (data.name.length > 20) { errorEl.textContent = "이름은 20자 이내로 입력해 주세요."; return; }
    if (!data.joinedAt) { errorEl.textContent = "가입일을 선택해 주세요."; return; }

    const id = form.dataset.id;
    const sameName = state.players.find((p) => p.name === data.name && p.id !== id);
    if (sameName && !confirm(`‘${data.name}’ 선수가 이미 있습니다. 동명이인으로 등록할까요?`)) return;

    const btn = $("#dialog-submit");
    btn.disabled = true;
    try {
      if (id) {
        await updatePlayer(id, data);
        toast("선수 정보를 수정했습니다.");
      } else {
        await createPlayer(data);
        toast(`${data.name} 선수를 등록했습니다.`);
      }
      dialog.close();
    } catch (err) {
      console.error(err);
      errorEl.textContent = "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    } finally {
      btn.disabled = false;
    }
  });

  // ── 목록 버튼 (수정 / 상태 전환) ────────────
  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.closest(".player-item").dataset.id;
    const player = state.players.find((p) => p.id === id);
    if (!player) return;

    if (btn.dataset.action === "edit") return openDialog(player);

    if (btn.dataset.action === "toggle") {
      const toInactive = player.status === "active";
      const msg = toInactive
        ? `${player.name} 선수를 비활성화할까요?\n지난 기록은 그대로 남고, 새 기록 입력 대상에서만 빠집니다.`
        : `${player.name} 선수를 다시 활동 상태로 바꿀까요?`;
      if (!confirm(msg)) return;
      btn.disabled = true;
      try {
        await setPlayerStatus(id, toInactive ? "inactive" : "active");
        toast(toInactive ? "비활성화했습니다." : "활동 상태로 바꿨습니다.");
      } catch (err) {
        console.error(err);
        toast("상태를 바꾸지 못했습니다.", "error");
        btn.disabled = false;
      }
    }
  });

  return () => {
    unsubscribe();
    if (dialog.open) dialog.close();
  };
}

function formatPhone(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
}

function dialogHTML() {
  return `
    <dialog id="player-dialog" class="dialog">
      <form id="player-form" class="form" novalidate>
        <h2 id="dialog-title">선수 등록</h2>
        <label class="field">
          <span>이름 <em class="req">*</em></span>
          <input name="name" maxlength="20" required autocomplete="off" />
          <small id="name-hint" class="muted"></small>
        </label>
        <label class="field">
          <span>연락처</span>
          <input name="phone" type="tel" inputmode="numeric" placeholder="010-0000-0000" autocomplete="off" />
        </label>
        <label class="field">
          <span>가입일 <em class="req">*</em></span>
          <input name="joinedAt" type="date" required />
        </label>
        <label class="field">
          <span>메모</span>
          <textarea name="memo" rows="3" maxlength="200" placeholder="선택 입력"></textarea>
        </label>
        <p id="form-error" class="form-error" role="alert"></p>
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" id="dialog-cancel">취소</button>
          <button type="submit" class="btn btn-primary" id="dialog-submit">저장</button>
        </div>
      </form>
    </dialog>`;
}
