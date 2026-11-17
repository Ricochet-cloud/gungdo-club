// 선수 관리 (뼈대) — 검색 + 상태 필터 + 목록 + 등록 버튼
export async function render(view) {
  view.innerHTML = `
    <section class="toolbar">
      <input type="search" id="player-search" placeholder="이름으로 검색" />
      <select id="player-filter">
        <option value="active">활동</option>
        <option value="inactive">비활성</option>
        <option value="all">전체</option>
      </select>
      <button type="button" class="btn btn-primary" id="add-player-btn">+ 선수 등록</button>
    </section>

    <section class="card">
      <ul class="player-list">
        <li class="empty">등록된 선수가 없습니다.</li>
      </ul>
    </section>
  `;

  return () => {};
}
