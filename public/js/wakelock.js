// 화면 꺼짐 방지 (Screen Wake Lock API)
// 회차 사이 대기 시간 동안 폰 화면이 꺼지지 않게 한다. 기록 입력 화면에서만 동작.
// 지원: iOS Safari 16.4+, 안드로이드 크롬 등. 미지원 브라우저에서는 버튼이 숨겨짐.
const KEY = "gungdo.keepAwake";
let sentinel = null;
let active = false; // 현재 화면(기록 입력)에서 사용 중인지

const supported = () => "wakeLock" in navigator;
const wanted = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const setWanted = (v) => { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch {} };

async function acquire() {
  if (!supported() || sentinel || document.visibilityState !== "visible") return;
  try {
    sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener("release", () => { sentinel = null; });
  } catch (err) {
    console.warn("wake lock 실패", err);
  }
}

async function release() {
  try { await sentinel?.release(); } catch {}
  sentinel = null;
}

// 다른 앱 갔다가 돌아오면 자동으로 다시 켜짐 (브라우저가 백그라운드에서 해제하기 때문)
document.addEventListener("visibilitychange", () => {
  if (active && wanted() && document.visibilityState === "visible") acquire();
});

/**
 * 버튼에 화면 켜두기 토글을 연결한다. 반환값 = 정리 함수 (페이지 떠날 때 호출)
 */
export function mountWakeToggle(btn) {
  if (!btn) return () => {};
  if (!supported()) { btn.hidden = true; return () => {}; }
  active = true;

  const paint = () => {
    const on = wanted();
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", String(on));
    btn.innerHTML = `<span class="wake-ico">${on ? "☀" : "☾"}</span>화면 켜두기 ${on ? "ON" : "OFF"}`;
  };
  btn.addEventListener("click", async () => {
    const on = !wanted();
    setWanted(on);
    paint();
    if (on) await acquire(); else await release();
  });
  paint();
  if (wanted()) acquire();

  return () => { active = false; release(); };
}
