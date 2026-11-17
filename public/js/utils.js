// ── 공통 상수 ───────────────────────────────────
export const ROUNDS = [1, 2, 3];
export const ARROWS_PER_ROUND = 5;
export const MAX_ARROWS_PER_DAY = ROUNDS.length * ARROWS_PER_ROUND; // 15

// ── 날짜 (한국 시간 기준 YYYY-MM-DD) ─────────────
export function todayKST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export function formatDateKR(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const day = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 (${day})`;
}

// ── 기록 문서 ID: {date}_{playerId}_{round} ──────
export function recordId(date, playerId, round) {
  return `${date}_${playerId}_${round}`;
}

// ── 계산 ─────────────────────────────────────────
export function hitRate(hits, arrows) {
  if (!arrows) return null;
  return Math.round((hits / arrows) * 1000) / 10; // 소수점 1자리
}

export function formatRate(rate) {
  return rate == null ? "—" : `${rate}%`;
}

/**
 * 하루 기록(회차 문서 배열)을 선수별로 묶고 순위를 매긴다.
 * - deleted 기록 제외
 * - 3회차를 모두 마친 선수만 순위 부여 (총 명중 내림차순, 같으면 공동 순위)
 * - 미완료 선수는 rank=null, complete=false 로 순위표 아래에 '진행중' 표시
 */
export function buildDailyRanking(records) {
  const byPlayer = new Map();
  for (const r of records) {
    if (r.deleted) continue;
    if (!byPlayer.has(r.playerId)) {
      byPlayer.set(r.playerId, { playerId: r.playerId, playerName: r.playerName, rounds: {}, hits: 0, arrows: 0 });
    }
    const p = byPlayer.get(r.playerId);
    p.rounds[r.round] = r.hits;
    p.hits += r.hits;
    p.arrows += r.arrowsShot;
  }

  const list = [...byPlayer.values()].map((p) => ({
    ...p,
    rate: hitRate(p.hits, p.arrows),
    complete: ROUNDS.every((n) => p.rounds[n] != null),
    rank: null,
  }));

  list.sort((a, b) =>
    (b.complete - a.complete) || (b.hits - a.hits) || a.playerName.localeCompare(b.playerName, "ko"));

  let rank = 0;
  list.filter((p) => p.complete).forEach((p, i, arr) => {
    if (i === 0 || p.hits !== arr[i - 1].hits) rank = i + 1;
    p.rank = rank;
  });
  return list;
}

/** 'YYYY-MM-DD' 에 n일 더하기 */
export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Firestore Timestamp → 오늘이면 "14:05", 아니면 "11/16 14:05" (KST) */
export function formatTime(ts) {
  const date = ts?.toDate ? ts.toDate() : typeof ts === "number" ? new Date(ts) : null;
  if (!date) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const ymd = `${parts.year}-${parts.month}-${parts.day}`;
  const hm = `${parts.hour}:${parts.minute}`;
  return ymd === todayKST() ? hm : `${Number(parts.month)}/${Number(parts.day)} ${hm}`;
}

/** 동명이인이면 "김철수 (2222)" 처럼 연락처 뒷자리(없으면 가입일)를 붙인다 */
export function displayName(player, allPlayers = []) {
  const dup = allPlayers.filter((x) => x.name === player.name).length > 1;
  if (!dup) return player.name;
  const tail = player.phone ? player.phone.replace(/\D/g, "").slice(-4) : player.joinedAt;
  return `${player.name} (${tail})`;
}

// ── DOM 헬퍼 ─────────────────────────────────────
export function escapeHTML(str = "") {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

let toastTimer;
export function toast(message, type = "info") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
