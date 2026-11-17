// 앱 진입점: 인증 가드 + 해시 라우터
import { auth, onAuthStateChanged, signOut } from "./firebase.js";
import { ADMIN_UID } from "./firebase-config.js";
import * as dashboard from "./pages/dashboard.js";
import * as records from "./pages/records.js";
import * as history from "./pages/history.js";
import * as players from "./pages/players.js";
import { initSyncBanner } from "./sync.js";

const ROUTES = {
  dashboard: { title: "대시보드", page: dashboard },
  records:   { title: "기록 입력", page: records },
  history:   { title: "기록 조회", page: history },
  players:   { title: "선수 관리", page: players },
};
const DEFAULT_ROUTE = "dashboard";

const view = document.getElementById("view");
const titleEl = document.getElementById("page-title");
let cleanup = null; // 페이지 이탈 시 실시간 구독 해제용

// "#/history?date=2026-11-17" → { name: "history", params: { date: ... } }
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [name, query = ""] = raw.split("?");
  return { name: ROUTES[name] ? name : DEFAULT_ROUTE, params: Object.fromEntries(new URLSearchParams(query)) };
}

async function render() {
  const { name, params } = parseHash();
  const route = ROUTES[name];

  if (typeof cleanup === "function") cleanup();
  cleanup = null;

  titleEl.textContent = route.title;
  document.title = `${route.title} · 국궁 동호회`;
  document.querySelectorAll("[data-route]").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === name);
  });

  view.innerHTML = "";
  try {
    cleanup = await route.page.render(view, params);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="card empty">화면을 불러오지 못했습니다. 새로고침 해주세요.</div>`;
  }
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

async function logout() {
  if (!confirm("로그아웃 하시겠습니까?")) return;
  await signOut(auth);
}
document.getElementById("logout-btn").addEventListener("click", logout);
document.getElementById("logout-btn-mobile").addEventListener("click", logout);

// AUTH-05: 비인증/비관리자 접근 차단
let started = false;
onAuthStateChanged(auth, (user) => {
  if (!user || user.uid !== ADMIN_UID) {
    location.replace("login.html");
    return;
  }
  document.body.classList.remove("auth-pending");
  initSyncBanner();
  if (!started) {
    started = true;
    window.addEventListener("hashchange", render);
    if (!location.hash) location.hash = `#/${DEFAULT_ROUTE}`;
    else render();
  }
});
