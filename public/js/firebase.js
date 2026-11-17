// Firebase 초기화 (CDN ES 모듈, 빌드 도구 없이 사용)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  setPersistence, browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, addDoc, setDoc, updateDoc, getDoc, getDocs,
  onSnapshot, query, where, orderBy, limit, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// 오프라인 저장: 신호가 끊겨도 기록을 폰(IndexedDB)에 먼저 저장하고, 연결되면 자동 전송.
// 새로고침하거나 앱을 껐다 켜도 전송 대기 중인 기록이 사라지지 않음.
// (사파리 개인정보 보호 모드 등 IndexedDB 를 못 쓰는 환경이면 메모리 캐시로 동작)
function createDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.warn("오프라인 저장소를 쓸 수 없어 기본 모드로 동작합니다.", err);
    return getFirestore(app);
  }
}
export const db = createDb();

// AUTH-03: 로그인 상태 유지
setPersistence(auth, browserLocalPersistence);

export { onAuthStateChanged, signInWithEmailAndPassword, signOut };
export {
  collection, doc, addDoc, setDoc, updateDoc, getDoc, getDocs,
  onSnapshot, query, where, orderBy, limit, serverTimestamp,
};
