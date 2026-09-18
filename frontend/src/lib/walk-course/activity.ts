import type { Pet } from '@/types/pet'
import {
  WALK_COURSE_ACTIVITY_PARAMS,
  type WalkCourseActivityChoice,
  type WalkCourseActivityParam,
} from '@/types/walk-course'

/**
 * 활동량 필터의 기본값을 정한다 — 공통명세 S4-1.
 *
 * **상한은 서버가 갖는다.** `WalkCourseActivityFit.fits` 가 `LOW` 240분 · `MEDIUM` 360분 ·
 * `HIGH` 무제한으로 거르고, 소요시간을 모르는 코스(`durationMaxMinutes === null`)는
 * **어느 활동량에서도 걸러지지 않는다.** FE 는 다시 계산하지 않는다.
 *
 * **기본값의 출처는 nav 선택견이 아니라 대표견이다** (`코스목록-세부명세.md` D8-1).
 * nav 선택은 `localStorage` 에 있어 서버가 읽을 수 없고, 서버 프리페치가 기본인 이 화면에서
 * 그것을 쓰면 **목록이 29 → 6 으로 줄어드는 것이 눈에 보인다.** 판정 화면(홈·장소 상세)이
 * nav 선택견을 쓰는 것과 축이 다르다 — 저쪽은 *판정의 기준*이고 이쪽은 *카탈로그를 좁히는 조건*이다.
 */

/**
 * 서버 상한의 **복제본**이다 (`WalkCourseActivityFit.java:22-23` — 240 · 360분).
 *
 * **응답에 상한도 활동량 metadata 도 없어** 기준 줄의 `4`·`6` 을 화면이 스스로 적는다
 * (`코스목록-세부명세.md` D5-2). 서버가 상한을 바꾸면 화면이 조용히 거짓말을 하므로
 * 값을 한 곳에 두고, 계약 요청은 D9-1 로 남겼다.
 */
export const ACTIVITY_MAX_HOURS: Record<WalkCourseActivityParam, number> = {
  LOW: 4,
  MEDIUM: 6,
}

/**
 * 대표견. 지정이 없으면 첫 아이다 — AI 일정·담기가 이미 쓰는 규칙이다
 * (`screen-inventory.md` §2). 목록이 비면 `null`.
 */
export function representativePet(pets: readonly Pet[]): Pet | null {
  if (pets.length === 0) return null

  return pets.find((candidate) => candidate.representative) ?? pets[0] ?? null
}

/**
 * 서버에 실제로 보낼 `petActivityLevel`. 보내지 않을 때는 `null` 이다.
 *
 * @param activity URL 이 가진 값. **정본이다** — 값이 있으면 대표견으로 덮어쓰지 않는다 (D4-3).
 * @param pets 로그인 사용자의 반려견 목록. **미로그인·조회 실패는 둘 다 `null`** 로 들어온다 —
 *   코스 조회는 공개 API 라 반려견은 기본값의 출처일 뿐이고, 실패가 목록을 실패시키지 않는다.
 *
 * `HIGH` 와 모르는 코드는 **보내지 않는다.** 전자는 결과가 필터 없음과 같아
 * `petActivityLevelApplied: true` 만 달라지고(규칙 3), 후자는 400(`WALKCOURSE_113`)이 된다.
 */
export function resolveActivityParam(
  activity: WalkCourseActivityChoice,
  pets: readonly Pet[] | null,
): WalkCourseActivityParam | null {
  if (activity === 'ALL') return null
  if (activity !== null) return activity

  if (pets === null) return null

  const code = representativePet(pets)?.activityLevel.code
  if (code === undefined) return null

  return WALK_COURSE_ACTIVITY_PARAMS.includes(code as WalkCourseActivityParam)
    ? (code as WalkCourseActivityParam)
    : null
}
