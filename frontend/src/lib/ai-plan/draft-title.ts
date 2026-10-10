import { withCompanionParticle } from '@/lib/text/korean'

/**
 * 초안 → 일정 제목 기본값 (명세 S8 미결 1 — 추천 ②).
 *
 * **초안에 제목이 없는데 `POST /plans` 의 `title` 은 필수다.** 담기 화면에서 빈 칸을
 * 마주하게 하지 않고 기본값을 넣어 두고 고칠 수 있게 한다.
 *
 * 서식은 아트보드 03 의 `몽실이와 제주 2박 3일` 이다.
 */

/** 백엔드 `PLAN_104` — 일정 제목은 60자 이하 */
export const PLAN_TITLE_MAX = 60

const AREA_LABEL = '제주'

/**
 * 여행 길이 표기. 하루짜리는 `0박 1일` 이 아니라 **당일치기**다.
 *
 * `totalDays` 는 담기 전이라 서버가 주지 않는다 — 기간에서 센다.
 */
export function tripLengthLabel(totalDays: number): string {
  if (totalDays <= 1) return '당일치기'
  return `${totalDays - 1}박 ${totalDays}일`
}

/**
 * 기본 제목.
 *
 * - 반려견 이름에 **와/과를 받침에 맞춰 붙인다** — 고정하면 한쪽이 반드시 틀린다
 * - 이름이 비어 있으면 이름 없이 만든다. 담기 직전에 사용자가 고칠 수 있으므로
 *   여기서 막을 필요가 없다
 * - **60자로 자른다** (`PLAN_104`). 이름이 긴 경우가 아니면 닿지 않지만, 서버 400 을
 *   기본값이 유발하는 상황은 만들지 않는다
 */
export function defaultPlanTitle(petName: string, totalDays: number): string {
  const length = tripLengthLabel(totalDays)
  const name = petName.trim()

  const title =
    name === ''
      ? `${AREA_LABEL} ${length}`
      : `${withCompanionParticle(name)} ${AREA_LABEL} ${length}`

  return title.slice(0, PLAN_TITLE_MAX)
}
