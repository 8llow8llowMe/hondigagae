import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as source } from '@/test/source'

/**
 * 홈의 일정 섹션 제목이 **선 일정을 따라간다** — 이슈 #561.
 *
 * ### 왜 제목까지 바꾸나
 *
 * 행의 배지만 고치면 `다가오는 일정` 이라는 제목 아래 `여행 중` 배지가 서서 **모순이
 * 제목으로 옮겨갈 뿐**이다. 홈은 `UPCOMING_PLAN_COUNT === 1` 이라 섹션에 서는 일정이
 * 하나뿐이고, 그래서 제목이 그 하나를 따라갈 수 있다.
 *
 * ### 왜 소스 단언인가
 *
 * `home-view.tsx` 는 `useQuery` 여섯을 부르는 client component 라 `renderToStaticMarkup`
 * 으로 세울 수 없다 (`home-date-slot.test.ts` 머리주석과 같은 이유). 행 자체의 렌더는
 * `upcoming-plan-row.test.ts` 가, 판정은 `lib/plan/phase-text.test.ts` 가 본다.
 */
const HOME = source('src/features/home/home-view.tsx')

describe('홈 일정 섹션 제목 (#561)', () => {
  it('제목을 고정하지 않는다 — 여행 중이면 진행 중인 일정이다', () => {
    expect(HOME).toContain('messages.home.ongoingHeading')
    expect(HOME).toContain('messages.home.upcomingHeading')
  })

  /*
    **판정을 여기서 새로 하지 않는다.** `startDate < 오늘` 같은 비교를 홈이 직접 쓰면
    목록·상세와 갈릴 수 있다 — 이 이슈가 없앤 바로 그 구멍이다.
  */
  it('판정은 planPhaseOf 에 맡긴다', () => {
    expect(HOME).toContain('planPhaseOf')
    expect(HOME).toContain("?.kind === 'ongoing'")
  })

  it('제목 전환은 이 섹션에 실제로 선 일정으로 정한다 — 전체 목록이 아니다', () => {
    const decision = HOME.slice(HOME.indexOf('const showsOngoingPlan'))

    expect(decision.slice(0, 300)).toContain('upcomingPlans.some')
  })
})
