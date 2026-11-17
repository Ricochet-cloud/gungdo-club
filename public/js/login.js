import { auth, onAuthStateChanged, signInWithEmailAndPassword } from "./firebase.js";
import { ADMIN_UID } from "./firebase-config.js";

const form = document.getElementById("login-form");
const errorEl = document.getElementById("login-error");

// 이미 로그인된 관리자는 바로 대시보드로
onAuthStateChanged(auth, (user) => {
  if (user && user.uid === ADMIN_UID) location.replace("index.html");
});

const ERROR_MESSAGES = {
  "auth/invalid-credential": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
  "auth/too-many-requests": "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  "auth/network-request-failed": "네트워크 연결을 확인해 주세요.",
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!email || !password) {
    errorEl.textContent = "이메일과 비밀번호를 입력해 주세요.";
    return;
  }

  const btn = form.querySelector("button");
  btn.disabled = true;
  btn.textContent = "로그인 중…";
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    if (user.uid !== ADMIN_UID) {
      await auth.signOut();
      errorEl.textContent = "관리자 계정이 아닙니다.";
      return;
    }
    location.replace("index.html");
  } catch (err) {
    errorEl.textContent = ERROR_MESSAGES[err.code] || "로그인에 실패했습니다.";
  } finally {
    btn.disabled = false;
    btn.textContent = "로그인";
  }
});
