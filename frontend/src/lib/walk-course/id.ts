/**
 * `walkCourseId` 가 백엔드가 받아들일 수 있는 모양인가 — `코스상세-세부명세.md` D0-1.
 *
 * **상세 컨트롤러가 `@PathVariable long` 이라 숫자가 아니면 무조건 400 이다**
 * (`WalkCourseWebController.java:74` — dev 실측 `WALKCOURSE_113`, `fieldErrors[0].field`
 * 가 `walkCourseId`). 물어보기 전에 답이 정해진 요청이라 보내지 않고, `proxy.ts` 가
 * **같은 함수로** 응답 상태를 400 에 맞춘다 — 공개 경로라 크롤러가 잘못된 주소를 200 으로
 * 읽으면 모니터링이 실패를 세지 못한다.
 *
 * **Snowflake 라 `Number()` 로 바꿔 보지 않는다.** id 는 19자리까지 가고
 * `Number.MAX_SAFE_INTEGER` 는 16자리라, 숫자로 바꾸는 순간 정밀도를 잃는다.
 * `isPlaceId` 와 같은 판정이고 이유도 같다 (#496 · #563).
 *
 * 길이 상한은 두지 않는다 — `Long` 범위는 서버의 것이고, 화면이 베껴 두면 둘이 갈린다.
 */
const WALK_COURSE_ID_PATTERN = /^\d+$/

export function isWalkCourseId(value: string): boolean {
  return WALK_COURSE_ID_PATTERN.test(value)
}
