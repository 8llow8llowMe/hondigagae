import type { CodeNameMetadata } from '@/types/api'

/**
 * 이 코스를 걸을 만한 활동량을 화면이 무엇으로 말할 수 있는가 —
 * `코스상세-세부명세.md` D5-4.
 *
 * **판정이 한 곳인 이유는 `hasCoordinates` 와 같다** (D2 · D3-1). 갈래를 가르려면
 * `fitsActivityLevels` 와 `durationMaxMinutes` **두 필드를 함께** 봐야 하는데, 호출부가
 * 각자 조합하면 한쪽만 고쳐진다.
 *
 * ## 갈래를 가르는 값은 `durationMaxMinutes` 다 — `fitsActivityLevels.length` 가 아니다
 *
 * | `durationMaxMinutes` | `fitsActivityLevels`  | 갈래                                    |
 * | -------------------- | --------------------- | --------------------------------------- |
 * | `120` (10-1코스)     | 낮음 · 보통 · 높음    | **안다.** 짧아서 정말 아무 아이나 걷는다 |
 * | `300` (1코스)        | 보통 · 높음           | **안다.**                               |
 * | `null` (20코스)      | 낮음 · 보통 · 높음    | **모른다.**                             |
 *
 * `WalkCourseActivityFit.fits` 는 `LOW ≤ 240분` 이라 **120분짜리 코스도 세 값을 받는다.**
 * `length === 3` 으로 가르면 10-1코스가 "모른다" 로 떨어진다 — mock 서버가 같은 규칙을
 * 갖고 있어 로컬에서 그대로 재현된다 (`lib/api/mock/walk-course-data.ts` `fits`).
 *
 * `durationMaxMinutes: null` 은 "제한 없음" 이 아니라 **"원문을 파싱하지 못했다"** 이고
 * (`WalkCourseItem.java:34-36`), 그 코스는 어느 활동량에서도 걸러지지 않아 세 값이 다
 * 담긴다. 그래서 이 값이 **단독 판정자**다.
 */
export type WalkCourseActivityFitInput = {
  durationMaxMinutes: number | null
  fitsActivityLevels: CodeNameMetadata[]
}

/**
 * 화면이 그릴 갈래.
 *
 * - `known` — `levels` 를 `messages.walkCourse.activityFit` 의 `{levels}` 에 넣는다
 * - `unknown` — `messages.walkCourse.activityFitUnknown` 을 그대로 그린다
 * - `null` — **줄을 그리지 않는다** (아래 참조)
 */
export type WalkCourseActivityFit = { kind: 'known'; levels: string } | { kind: 'unknown' }

/**
 * 활동량 이름을 잇는 구분자. **번역이 아니라 나열이다** — 목록의 `활동량({level})` 괄호
 * 형식을 그대로 물려받는다 (D5-4 ②).
 */
const SEPARATOR = ' · '

/**
 * @returns 그릴 갈래. **빈 배열이면 `null`** — 줄 자체를 그리지 않는다.
 *
 * `HIGH` 는 상한이 없어 항상 통과하므로 배열이 빈 채로 오지 않는다. 그래도 방어한다:
 * 빈 배열을 "모르는 갈래" 로 흘려보내면 **계약이 깨진 응답이 이 코스의 사실처럼 그려진다.**
 *
 * **빈 배열 판정이 `durationMaxMinutes` 보다 앞이다** — 모르는 갈래의 문장으로 새지 않게 한다.
 *
 * **이름은 서버 `name` 그대로다.** FE 에 `LOW → 낮음` 매핑 테이블을 만들지 않는다
 * (`api-integration-guide.md` §6 · `messages/walk-course.ts` 머리 주석).
 */
export function walkCourseActivityFit(
  course: WalkCourseActivityFitInput,
): WalkCourseActivityFit | null {
  if (course.fitsActivityLevels.length === 0) return null
  if (course.durationMaxMinutes === null) return { kind: 'unknown' }

  return {
    kind: 'known',
    levels: course.fitsActivityLevels.map((level) => level.name).join(SEPARATOR),
  }
}
