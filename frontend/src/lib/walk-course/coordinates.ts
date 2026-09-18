/**
 * 코스에 골든타임 동선을 만들 수 있는가 — 공통명세 S4-2.
 *
 * **서버가 명시한 규칙이다** (`WalkCourseItem.java:10-12`): 좌표가 있는 코스만
 * `GET /insights/walk-times` 와 이어지고, **null 이면 그 버튼을 만들지 않아야 한다.**
 *
 * **`lat ?? 0` 을 쓰지 않는다.** `(0, 0)` 은 적도·본초자오선(기니만)이고 서버는 그 좌표에
 * **200 으로 답한다** — 틀린 답이 정상 응답으로 와서 화면이 틀렸다고 말할 방법이 없다.
 *
 * **`Number.isFinite` 로 넓히지 않는다.** 계약이 `Double | null` 이고
 * (`WalkCourseItem.java:37,40`) `NaN` 은 오지 않는다. 판정을 넓히면 테스트가 실제 계약이
 * 아닌 것을 지키게 된다.
 *
 * **판정이 한 곳인 이유**: 목록(표시 여부)과 상세(요청 여부)가 같은 질문을 한다. 둘이
 * 각자 `if` 를 세우면 한쪽만 고쳐져 요청은 나가는데 자리는 없는 상태가 생긴다.
 */
export type WalkCourseCoordinates = { lat: number | null; lng: number | null }

export function hasCoordinates(course: WalkCourseCoordinates): boolean {
  return course.lat !== null && course.lng !== null
}

/**
 * 골든타임 조회에 넘길 좌표. 좌표가 없으면 `null` 이다.
 *
 * `useWalkTimes` 의 `enabled` 가 `position !== null` 이라, 여기서 `null` 을 만들면
 * **요청 자체가 나가지 않는다** (`코스상세-세부명세.md` D3-1).
 */
export function toCoursePosition(
  course: WalkCourseCoordinates,
): { lat: number; lng: number } | null {
  if (!hasCoordinates(course)) return null

  return { lat: course.lat as number, lng: course.lng as number }
}
