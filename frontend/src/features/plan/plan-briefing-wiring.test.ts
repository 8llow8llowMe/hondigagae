import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as code } from '@/test/source'

describe('브리핑 ↔ 상세 연결 (#1415 D15-2)', () => {
  const page = code('app/(main)/plans/[planId]/briefing/page.tsx')
  const view = code('src/features/plan/plan-briefing-view.tsx')

  it('page 가 상세를 HydrationBoundary 로 넘긴다 — 브리핑 응답은 프리페치하지 않는다', () => {
    expect(page).toContain('<HydrationBoundary state={dehydrate(queryClient)}>')
    expect(page).not.toContain('planKeys.briefing')
  })

  it('뷰가 상세 캐시로 그날을 골라 섹션에 넘긴다', () => {
    expect(view).toContain('usePlanDetail(planId)')
    expect(view).toContain('lodgingBasisFor(')
    expect(view).toContain('dayPlan={dayPlan}')
  })
})
