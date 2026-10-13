import { messages } from '@/lib/messages'
import { fillTemplate } from '@/lib/text/template'

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
    title: fillTemplate(messages.place.searchEmptyTitle, { keyword }),
    description: /\s/.test(keyword.trim())
      ? messages.place.searchEmptyMultiWordDescription
      : messages.place.searchEmptyDescription,
  }
}

/** 빈 목록 아래에 세울 다음 행동 하나 */
export type MapEmptyAction = 'clearKeyword' | 'searchWider' | null

/**
 * 지도 보기의 빈 목록 문구 (#1155).
 *
 * 지도의 목록은 **서버가 준 결과 중 조회 영역 안에 든 것**이라 비는 이유가 둘이다.
 *
 * - **검색어로 받은 결과가 아예 없다** → 검색어 탓이다. 예전에는 이때도 `이 지역에는 표시할
 *   곳이 없어요 · 지도를 움직이거나…` 라서 사용자가 지도를 옮기며 헤맸다
 * - **결과는 있는데 조회 영역 밖에만 있다** → 지역 문구가 맞다
 *
 * **검색어 갈래가 다시 둘로 갈린다** (#1332). 받은 결과가 **반경 조회**(`/places/nearby` — 재검색 ·
 * 담기 화면의 기준점 지도)의 것이면 0건은 "그 범위 안에 없다" 일 뿐이다. 담기 화면에서 `수월봉` 이
 * 기준점 7km 밖이라 0건인데 `찾은 장소가 없어요` 라고 하면 사용자는 장소가 없다고 읽는다 — 장소 탭에서는
 * 2곳 나온다. 그때는 범위를 말하고 **제주 전체에서 찾기**(목록 보기 — 반경 없는 `GET /places`)를 준다.
 *
 * `action` 은 빈 목록 아래 버튼 하나다 — 지역 갈래에서는 지울 것이 검색어가 아니라 버튼이 없다.
 */
export function mapEmptyCopy({
  keyword,
  fetchedCount,
  radiusBounded,
}: {
  keyword: string | null
  /** 조회 영역으로 거르기 **전**, 서버가 준 결과 수 */
  fetchedCount: number
  /** 결과가 반경 조회(`/places/nearby`)에서 왔는가 */
  radiusBounded: boolean
}): EmptyCopy & { action: MapEmptyAction } {
  if (keyword !== null && fetchedCount === 0) {
    if (radiusBounded) {
      return {
        title: fillTemplate(messages.map.searchEmptyInRangeTitle, { keyword }),
        description: messages.map.searchEmptyInRangeDescription,
        action: 'searchWider',
      }
    }
    return { ...searchEmptyCopy(keyword), action: 'clearKeyword' }
  }

  return {
    title: messages.map.emptyInView,
    description: messages.map.emptyInViewDescription,
    action: null,
  }
}
