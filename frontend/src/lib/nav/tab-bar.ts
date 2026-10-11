/**
 * 모바일 하단 탭바를 숨기는 경로인가 (#1369).
 *
 * **상세 화면에서는 탭바를 숨긴다.** 장소 상세는 `저장 · 일정에 담기` 하단 바(77px) 위에 탭바(64px)가
 * 겹쳐 쌓여 화면의 17%를 상시 가렸다(375×812). 상세는 목록에서 들어와 한 대상을 보는 화면이라
 * 카카오맵 · 네이버 지도처럼 행동 바만 남기고, 돌아가는 길은 상단 `← 목록으로` · 브라우저 뒤로가
 * 맡는다.
 *
 * | 경로                         | 숨김 | 이유                                                 |
 * | ---------------------------- | ---- | ---------------------------------------------------- |
 * | `/places/{id}`               | ○    | 장소 상세                                            |
 * | `/plans/{id}` · 그 하위       | ○    | 일정 상세와 그 일정의 작업 화면(브리핑 · 응급 · 일자) |
 * | `/olle/{id}`                 | ○    | 코스 상세                                            |
 * | `/plans/new`                 | ×    | 만들기 화면이지 상세가 아니다                         |
 * | 목록 · 홈 · 마이페이지 · 그 밖 | ×    | 탭 사이를 오가는 화면                                 |
 *
 * **경로 모양만 본다** — 세그먼트가 유효한 id 인지는 화면이 판단한다(404 · 400 화면도 상세의 갈래라
 * 탭바가 없어도 `← 목록으로` 가 있다).
 */
export function hidesTabBar(pathname: string): boolean {
  const segments = pathname.split('/').filter((segment) => segment.length > 0)
  const [first, second] = segments
  if (second === undefined) return false

  if (first === 'places' || first === 'olle') return segments.length === 2
  if (first === 'plans') return second !== 'new'

  return false
}
