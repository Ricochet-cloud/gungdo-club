// 연결 상태 · 저장 대기 표시
// Firestore 는 오프라인이어도 쓰기를 폰(IndexedDB)에 먼저 저장하고, 연결되면 자동 전송한다.
// 여기서는 '아직 서버에 도착하지 않은 쓰기' 개수를 세서 화면 상단에 알려준다.
import { toast } from "./utils.js";

let pending = 0;
let shownBanner = false;
let bannerTimer = null;
let el = null;

function ensureEl() {
  if (el) return el;
  el = document.createElement("div");
  el.id = "sync-banner";
  el.setAttribute("role", "status");
  el.hidden = true;
  // 상단바가 있으면 제목 옆에 넣어서 내용을 가리지 않게
  const topbar = document.querySelector(".topbar");
  if (topbar) topbar.insertBefore(el, topbar.lastElementChild);
  else document.body.appendChild(el);
  return el;
}

const syncingHTML = () =>
  `<span class="sync-dot"></span><span class="sync-long">서버에 저장 중… ${pending}건</span><span class="sync-short">저장 중 ${pending}</span>`;

function render() {
  const banner = ensureEl();
  const offline = !navigator.onLine;

  if (offline) {
    banner.className = "sync-banner offline";
    banner.innerHTML = `<span class="sync-dot"></span><span class="sync-long">오프라인 · 기록은 폰에 저장돼요${pending ? ` (전송 대기 ${pending}건)` : ""}</span><span class="sync-short">오프라인${pending ? ` · 대기 ${pending}` : ""}</span>`;
    banner.hidden = false;
    shownBanner = true;
    return;
  }

  if (pending > 0) {
    // 잠깐의 지연은 표시하지 않음 (1.5초 이상 걸릴 때만)
    if (!bannerTimer && banner.hidden) {
      bannerTimer = setTimeout(() => {
        bannerTimer = null;
        if (pending > 0) {
          banner.className = "sync-banner syncing";
          banner.innerHTML = syncingHTML();
          banner.hidden = false;
          shownBanner = true;
        }
      }, 1500);
    } else if (!banner.hidden) {
      banner.className = "sync-banner syncing";
      banner.innerHTML = syncingHTML();
    }
    return;
  }

  clearTimeout(bannerTimer);
  bannerTimer = null;
  if (shownBanner) toast("모든 기록이 서버에 저장되었어요 ✓");
  shownBanner = false;
  banner.hidden = true;
}

/**
 * 쓰기 작업을 추적한다. 서버 응답을 기다리지 않고 바로 반환하며,
 * 나중에 서버가 거부하면 그때 오류 토스트를 띄운다.
 */
export function trackWrite(promise, { onError } = {}) {
  pending += 1;
  render();
  const p = Promise.resolve(promise)
    .catch((err) => {
      console.error(err);
      toast(err?.code === "permission-denied"
        ? "서버가 저장을 거부했어요. 회차 순서나 권한을 확인해 주세요."
        : "저장에 실패했어요. 다시 시도해 주세요.", "error");
      onError?.(err);
      throw err;
    })
    .finally(() => {
      pending -= 1;
      render();
    });
  p.catch(() => {}); // 처리 안 된 거부 경고 방지
  return p;
}

/** 로컬 반영까지만 잠깐 기다림 (화면 갱신용). 서버 응답은 기다리지 않음 */
export function settleLocal(promise, ms = 350) {
  return Promise.race([promise.catch(() => {}), new Promise((r) => setTimeout(r, ms))]);
}

window.addEventListener("online", render);
window.addEventListener("offline", render);

// 저장 대기 중에 페이지를 닫으려 하면 경고
window.addEventListener("beforeunload", (e) => {
  if (pending > 0 && navigator.onLine) { e.preventDefault(); e.returnValue = ""; }
});

export function initSyncBanner() { render(); }
