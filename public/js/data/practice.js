// 연습 기록 데이터 접근 계층 (Firestore: practiceRecords)
// 공식 기록(shootingRecords)과 완전히 분리 → 순위·공식 통계에 절대 섞이지 않음
// 문서 ID = {date}_{playerId}_{round}, 회차는 1부터 순서대로 (최대 PRACTICE_MAX_ROUNDS)
import {
  db, auth, collection, doc, setDoc, updateDoc, getDocs,
  onSnapshot, query, where, serverTimestamp,
} from "../firebase.js";
import { recordId, ARROWS_PER_ROUND } from "../utils.js";

const COL = "practiceRecords";
const col = () => collection(db, COL);

export function watchPracticeByDate(date, onChange, onError) {
  return onSnapshot(
    query(col(), where("date", "==", date)),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error(err); onError?.(err); }
  );
}

export async function fetchPracticeByPlayer(playerId) {
  const snap = await getDocs(query(col(), where("playerId", "==", playerId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => !r.deleted);
}

export async function savePracticeRound({ date, player, round, hits }) {
  await setDoc(doc(db, COL, recordId(date, player.id, round)), {
    playerId: player.id,
    playerName: player.name,
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
}

export async function updatePracticeHits(id, hits) {
  await updateDoc(doc(db, COL, id), { hits, updatedAt: serverTimestamp() });
}

export async function softDeletePractice(id) {
  await updateDoc(doc(db, COL, id), { deleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

/**
 * 연습 기록 → 선수별 요약
 * { [playerId]: { playerId, playerName, rounds: [{round, hits, id}], hits, arrows, rate } }
 */
export function summarizePractice(records) {
  const map = {};
  for (const r of records) {
    if (r.deleted) continue;
    const p = (map[r.playerId] ||= { playerId: r.playerId, playerName: r.playerName, rounds: [], hits: 0, arrows: 0 });
    p.rounds.push({ round: r.round, hits: r.hits, id: r.id });
    p.hits += r.hits;
    p.arrows += r.arrowsShot;
  }
  for (const p of Object.values(map)) {
    p.rounds.sort((a, b) => a.round - b.round);
    p.rate = p.arrows ? Math.round((p.hits / p.arrows) * 1000) / 10 : null;
  }
  return map;
}
