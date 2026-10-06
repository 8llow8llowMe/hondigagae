import { messages } from '@/lib/messages'

type EmptyCopy = { title: string; description: string }

/**
 * 검색어가 걸린 0건의 문구 (#431 · #1155). **무엇으로 찾았는지 되돌려 준다.**
 *
 * **띄어 쓴 검색어는 설명을 바꾼다.** 서버가 검색어를 공백째 한 덩어리로 이름 · 주소와 대조해
 * (`PlaceKeyword.normalize` 는 공백을 줄일 뿐이다) "애월 카페" 처럼 자연스럽게 띄어 쓴 검색은
 * 0건이 된다 — 2026-10-06 사용성 점검의 첫 과제가 여기서 막혔다. 그때 "다른 말로 찾아 보세요" 는
 * 무엇을 바꿔야 할지 말해 주지 않는다.
 *
 * **BE 가 단어 단위로 찾게 되면(#1161) 이 갈래를 걷는다** — 그 뒤에는 거짓 안내다.
 */
export function searchEmptyCopy(keyword: string): EmptyCopy {
  return {
    title: messages.place.searchEmptyTitle.replace('{keyword}', keyword),
    description: /\s/.test(keyword.trim())
      ? messages.place.searchEmptyMultiWordDescription
      : messages.place.searchEmptyDescription,
  }
}

/**
 * 지도 보기의 빈 목록 문구 (#1155).
 *
 * 지도의 목록은 **서버가 준 결과 중 조회 영역 안에 든 것**이라 비는 이유가 둘이다.
 *
 * - **검색어로 받은 결과가 아예 없다** → 검색어 탓이다. 예전에는 이때도 `이 지역에는 표시할
 *   곳이 없어요 · 지도를 움직이거나…` 라서 사용자가 지도를 옮기며 헤맸다
 * - **결과는 있는데 조회 영역 밖에만 있다** → 지역 문구가 맞다
 *
 * `clearKeyword` 는 검색어만 지우는 버튼을 세울지다 — 지역 갈래에서는 지울 것이 검색어가 아니다.
 */
export function mapEmptyCopy({
  keyword,
  fetchedCount,
}: {
  keyword: string | null
  /** 조회 영역으로 거르기 **전**, 서버가 준 결과 수 */
  fetchedCount: number
}): EmptyCopy & { clearKeyword: boolean } {
  if (keyword !== null && fetchedCount === 0) {
    return { ...searchEmptyCopy(keyword), clearKeyword: true }
  }

  return {
    title: messages.map.emptyInView,
    description: messages.map.emptyInViewDescription,
    clearKeyword: false,
  }
}
