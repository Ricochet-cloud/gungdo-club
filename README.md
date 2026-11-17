# Gungdo Club Dashboard

국궁 동호회 일일 활쏘기 기록 · 순위 관리 웹 (HTML / CSS / JS + Firebase)

## 폴더 구조

```
gungdo-club/
├─ firebase.json            Hosting + Firestore 설정
├─ .firebaserc              Firebase 프로젝트 ID
├─ firestore.rules          보안 규칙 (관리자 UID, 유효성, 회차 순서, soft delete)
├─ firestore.indexes.json   복합 인덱스
└─ public/
   ├─ login.html            로그인 화면
   ├─ index.html            앱 셸 (사이드바/하단 탭 + #view)
   ├─ css/style.css
   └─ js/
      ├─ firebase-config.js ← 여기에 내 Firebase 값 입력
      ├─ firebase.js        초기화
      ├─ app.js             인증 가드 + 해시 라우터
      ├─ login.js
      ├─ utils.js           KST 날짜, 기록 ID, 순위 계산
      └─ pages/             dashboard / records / history / players
```

## 처음 설정

1. Firebase 콘솔에서 프로젝트 생성 → 웹 앱 추가 → 설정값을 `public/js/firebase-config.js`에 붙여넣기
2. Authentication → 이메일/비밀번호 사용 설정 → 관리자 계정 1개 생성 → UID 복사
3. UID를 `firebase-config.js`의 `ADMIN_UID`와 `firestore.rules`의 `'ADMIN_UID'` 두 곳에 입력
4. Firestore Database 생성 (리전: asia-northeast3 서울 권장)
5. `.firebaserc`의 프로젝트 ID 수정
6. 배포: `firebase deploy`

로컬 확인: `npx serve public` 등으로 띄우기 (ES 모듈이라 파일 더블클릭으로는 안 열림)

## 확정된 운영 정책 (PRD 보완)

| 항목 | 결정 |
|---|---|
| 회차 | 하루 3회차 모두 쏨. 3회차 미완료 선수는 순위표에 '진행중' 표시 |
| 순위 | 총 명중 수 내림차순, 같으면 공동 순위 (모두 15발이라 명중률 2차 정렬 불필요) |
| 중복 방지 | 기록 문서 ID = `{date}_{playerId}_{round}` → 구조적으로 중복 불가 |
| 입력 순서 | 1 → 2 → 3회차 순서 강제 (클라이언트 + 보안 규칙 이중 검사) |
| 삭제 | soft delete (`deleted: true`, `deletedAt`). 실제 문서 삭제는 규칙으로 차단 |
| 이름 변경 | 과거 기록의 `playerName`은 당시 이름 그대로 유지 |
| 설정 메뉴 | MVP에서 제외. 로그아웃은 사이드바/상단에 배치 |

## 데이터 구조

```
players/{playerId}
  name, phone, joinedAt, status('active'|'inactive'), memo, createdAt, updatedAt

shootingRecords/{date}_{playerId}_{round}
  playerId, playerName, date('YYYY-MM-DD', KST), round(1~3),
  arrowsShot(5), hits(0~5), deleted(bool), deletedAt,
  createdAt, updatedAt, createdBy
```

## 진행 상황

- [x] 1단계: 기본 뼈대 (인증 가드, 라우팅, 반응형 레이아웃, 페이지 틀, 보안 규칙)
- [ ] 2단계: 선수 관리 (등록/수정/비활성화/검색)
- [ ] 3단계: 기록 입력 (회차 저장, 순서 검사, 수정/삭제)
- [ ] 4단계: 대시보드 · 순위 실시간 연결
- [ ] 5단계: 기록 조회 (날짜별 / 선수별 + 추이 그래프)
