/**
 * 이름·주소 검색어의 정규화 — **검색을 가진 화면 전부가 이 한 곳을 쓴다.**
 *
 * `/places` 목록 · AI 피커 검색 탭(#431)과 병원·약국 목록(#584)이 함께 쓴다. 셋은
 * 검색을 **누가 수행하는지**가 다르다 — 앞의 둘은 백엔드 `keyword` 파라미터(#421)로
 * 보내고, 병원·약국은 받아 온 목록을 화면에서 좁힌다 (`facility-filters.ts`). 그래도
 * *"무엇을 같은 검색어로 볼 것인가"* 는 하나여야 한다: 각자 정규화하면 같은 글자를 친
 * 사용자가 화면마다 다른 URL 을 얻는다.
 *
 * `place-filters.ts` 에 살던 것을 옮겨 왔다 (#584). 거기 두고 `emergency-filters.ts` 가
 * 임포트하면 긴급 시설 화면이 장소 필터 모듈에 의존하게 된다 — 두 화면은 서로를 모른다.
 */

/**
 * 백엔드 `keyword` 최대 길이 (#421). **검색 입력도 이 값을 쓴다** (#431) — 두 곳이 각자
 * 적어 두면 입력이 허용한 길이를 URL 이 조용히 버리는 짝이 생긴다.
 *
 * 병원·약국은 서버로 보내지 않지만 **같은 상한을 쓴다** (#584). 화면마다 다른 길이를
 * 허용하면 같은 입력 컴포넌트 문법이 화면에 따라 다르게 잘린다.
 */
export const KEYWORD_MAX_LENGTH = 50

/**
 * 앞뒤 공백을 걷고, 비었거나 상한을 넘으면 **검색어 없음(`null`)** 으로 떨어뜨린다.
 *
 * 상한 초과를 자르지 않고 버리는 것이 의도다 — 잘라 보내면 사용자가 친 것과 다른 말로
 * 찾은 결과가 그의 검색어인 척 돌아온다. URL 은 사용자가 손으로 고치는 자리라 예외를
 * 던지지도 않는다 (`architecture-guide.md` §10).
 */
export function normalizeKeyword(value: string | null): string | null {
  const text = value !== null && value.trim() !== '' ? value.trim() : null
  return text !== null && text.length <= KEYWORD_MAX_LENGTH ? text : null
}
