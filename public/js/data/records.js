// 회차별 기록 데이터 접근 계층 (Firestore: shootingRecords)
// 문서 ID = {date}_{playerId}_{round} → 같은 선수·날짜·회차는 문서가 하나뿐
import {
  db, auth, collection, doc, setDoc, updateDoc,
  onSnapshot, query, where, orderBy, limit, getDocs, serverTimestamp,
} from "../firebase.js";
import { recordId, ARROWS_PER_ROUND } from "../utils.js";

const col = () => collection(db, "shootingRecords");

/** 특정 날짜의 모든 기록 실시간 구독 (삭제 표시된 기록 포함 → 화면에서 거름) */
export function watchRecordsByDate(date, onChange, onError) {
  const q = query(col(), where("date", "==", date));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error(err); onError?.(err); }
  );
}

/** 최근 수정된 기록 n개 실시간 구독 (삭제된 기록은 화면에서 거름) */
export function watchRecentRecords(n, onChange, onError) {
  const q = query(col(), orderBy("updatedAt", "desc"), limit(n));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error(err); onError?.(err); }
  );
}

/** 선수 한 명의 전체 기록 (단일 필드 조건 → 복합 인덱스 불필요, 정렬은 화면에서) */
export async function fetchRecordsByPlayer(playerId) {
  const snap = await getDocs(query(col(), where("playerId", "==", playerId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => !r.deleted);
}

/**
 * 회차 기록 저장 (신규 또는 삭제됐던 회차 다시 입력)
 * 순서 검사(이전 회차 존재)는 호출 전 화면에서 + 보안 규칙에서 이중으로 한다.
 */
export async function saveRound({ date, player, round, hits }) {
  const id = recordId(date, player.id, round);
  await setDoc(doc(db, "shootingRecords", id), {
    playerId: player.id,
    playerName: player.name, // 당시 이름 보존
    date,
    round,
    arrowsShot: ARROWS_PER_ROUND,
    hits,
    deleted: false,
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid ?? null,
  });
  return id;
}

/** 명중 수 수정 */
export async function updateHits(id, hits) {
  await updateDoc(doc(db, "shootingRecords", id), { hits, updatedAt: serverTimestamp() });
}

/** 삭제 (soft delete — 문서는 남기고 표시만) */
export async function softDeleteRound(id) {
  await updateDoc(doc(db, "shootingRecords", id), {
    deleted: true,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** 기록 배열 → { [playerId]: { 1: rec, 2: rec, 3: rec } } (삭제 제외) */
export function groupByPlayer(records) {
  const map = {};
  for (const r of records) {
    if (r.deleted) continue;
    (map[r.playerId] ||= {})[r.round] = r;
  }
  return map;
}
