// 선수 데이터 접근 계층 (Firestore: players)
import {
  db, auth, collection, doc, addDoc, updateDoc, getDocs,
  onSnapshot, query, orderBy, serverTimestamp,
} from "../firebase.js";

const col = () => collection(db, "players");

/** 전체 선수 실시간 구독. 반환값 = 구독 해제 함수 */
export function watchPlayers(onChange, onError) {
  const q = query(col(), orderBy("name"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error(err); onError?.(err); }
  );
}

/** 한 번만 읽기 (선택 목록 채우기 등) */
export async function fetchPlayers() {
  const snap = await getDocs(query(col(), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createPlayer({ name, phone = "", joinedAt, memo = "" }) {
  const ref = await addDoc(col(), {
    name: name.trim(),
    phone: phone.trim(),
    joinedAt,
    memo: memo.trim(),
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid ?? null,
  });
  return ref.id;
}

// 이름을 바꿔도 과거 기록(shootingRecords.playerName)은 그대로 둔다 (운영 정책)
export async function updatePlayer(id, { name, phone = "", joinedAt, memo = "" }) {
  await updateDoc(doc(db, "players", id), {
    name: name.trim(),
    phone: phone.trim(),
    joinedAt,
    memo: memo.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function setPlayerStatus(id, status) {
  await updateDoc(doc(db, "players", id), { status, updatedAt: serverTimestamp() });
}
