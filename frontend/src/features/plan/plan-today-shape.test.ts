import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as source } from '@/test/source'

/**
 * 서버 페이지가 클라이언트 뷰에 넘기는 **오늘의 모양** — 이슈 #1490.
 *
 * 판정 함수(`planPhaseOf` · `tripPhaseOf` · `dayRegenerateBlock` …)는 `today` 를 로컬 getter 로
 * 읽는다(`lib/plan/date.ts` 머리 규약). 서버가 `new Date()` 를 시각 그대로 넘기면 브라우저
 * 시간대가 날짜를 다시 정해 홈(`오늘 1일차`)과 목록 · 상세(`D-1`)가 갈렸다. 그래서 페이지는
 * **달력의 칸(`todayDay`)** 을 넘기고, 뷰가 `todayFromDay` 로 로컬 정오를 세운다.
 *
 * ### 왜 소스 단언인가
 *
 * 페이지는 `async` server component, 뷰는 React Query 훅을 부르는 client component 라 node
 * 환경에서 세울 수 없다 (`testing-guide.md`). 변환 자체는 `lib/date/day.test.ts` 가 시간대별로 본다.
 */
const SCREENS = [
  {
    name: '일정 목록',
    page: 'app/(main)/plans/(list)/page.tsx',
    view: 'src/features/plan/plan-list-view.tsx',
  },
  {
    name: '일정 상세',
    page: 'app/(main)/plans/[planId]/page.tsx',
    view: 'src/features/plan/plan-detail-view.tsx',
  },
  {
    name: '일자 재생성',
    page: 'app/(main)/plans/[planId]/days/[day]/regenerate/page.tsx',
    view: 'src/features/plan/plan-day-regenerate-view.tsx',
  },
] as const

describe.each(SCREENS)('$name 의 오늘 (#1490)', ({ page, view }) => {
  const PAGE = source(page)
  const VIEW = source(view)

  it('페이지는 시각이 아니라 서버가 정한 달력의 칸을 넘긴다', () => {
    expect(PAGE).toContain('today={todayDay(new Date())}')
    expect(PAGE).not.toContain('toISOString()')
    expect(PAGE).not.toContain('today={new Date()}')
  })

  it('뷰는 그 칸을 todayFromDay 로 세운다 — new Date(today) 로 시각을 되살리지 않는다', () => {
    expect(VIEW).toContain('todayFromDay(today)')
    expect(VIEW).not.toContain('new Date(today)')
  })
})
