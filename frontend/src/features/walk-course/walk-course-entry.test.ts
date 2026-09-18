import { describe, expect, it } from 'vitest'

import { DESKTOP_NAV_ITEMS, MOBILE_TAB_ITEMS } from '@/features/nav/menu-items'
import { messages } from '@/lib/messages'
import { readSource, stripComments } from '@/test/source'

/**
 * 진입점과 `WalkTimesSection` 이동 — 공통명세 S6-1 · S6-3.
 *
 * **`home-view.tsx` 는 렌더할 수 없다** (훅을 쓴다). 이 계약은 한 파일 안의 배선이라
 * 소스 문자열로 단언한다 (`src/test/source.ts` 머리주석 — `route-state-surface.test.ts`
 * 가 같은 방식이다). **주석을 걷고 본다**: 이 저장소의 주석에는 경로·컴포넌트명이 그대로
 * 등장해, 걷지 않으면 단언이 주석에 속아 통과한다.
 */
const homeView = stripComments(readSource('src/features/home/home-view.tsx'))

describe('진입점은 홈 배너다 (S6-1)', () => {
  it('홈이 /walk-courses 배너를 그린다', () => {
    expect(homeView).toContain('href="/walk-courses"')
    expect(homeView).toContain('messages.walkCourse.bannerTitle')
  })

  /**
   * nav 셋(장소 찾기·여행 일정·AI 일정 생성)은 *할 일* 축이고 항목을 늘리지 않기로
   * 이미 정해져 있다 (`nav-links.tsx`). 모바일 탭바는 4개 고정이다.
   */
  it('전역 nav 항목을 늘리지 않는다', () => {
    expect(DESKTOP_NAV_ITEMS.map((item) => item.href)).not.toContain('/walk-courses')
    expect(MOBILE_TAB_ITEMS).toHaveLength(4)
    expect(MOBILE_TAB_ITEMS.map((item) => item.href)).not.toContain('/walk-courses')
  })

  /**
   * `Banner` 의 아이콘 자리는 danger 색 고정이다(병원 배너 전용). 산책 코스에 쓰면
   * 상시 진입점이 경보처럼 읽힌다 — 진짜 경보를 구분할 수 없게 된다.
   */
  it('배너에 danger 아이콘을 붙이지 않는다', () => {
    const banner = /<Banner\s+href="\/walk-courses"[\s\S]*?\/>/.exec(homeView)?.[0] ?? ''

    expect(banner).not.toContain('leading')
  })

  it('배너 문구에 코스 개수를 박지 않는다 — 적재(#383)로 바뀐다', () => {
    expect(messages.walkCourse.bannerDescription).not.toMatch(/\d/)
  })
})

describe('WalkTimesSection 이동 — 홈 마크업은 그대로다 (S6-3)', () => {
  /** feature 간 직접 임포트를 피한다 (`architecture-guide.md` §3) */
  it('홈이 새 경로에서 임포트한다', () => {
    expect(homeView).toContain("from '@/features/insight/walk-times-section'")
    expect(homeView).not.toContain("from '@/features/home/walk-times-section'")
  })

  it('골든타임 훅도 같은 자리로 옮겼다', () => {
    expect(homeView).toContain("from '@/features/insight/use-walk-times'")
  })

  /**
   * **넘기는 prop 이 그대로여야 마크업이 그대로다.** 특히 `retryLabel` 을 넘기지 않아야
   * 기본값(`messages.common.retry`)이 유지된다 — 산책 코스 상세만 그 값을 바꾼다 (D6).
   */
  it('홈은 옛 네 prop 만 넘긴다 — retryLabel 을 주지 않는다', () => {
    const usage = /<WalkTimesSection[\s\S]*?\/>/.exec(homeView)?.[0] ?? ''

    expect(usage).toContain('data=')
    expect(usage).toContain('loading=')
    expect(usage).toContain('positionFallback=')
    expect(usage).toContain('onRetry=')
    expect(usage).not.toContain('retryLabel')
  })
})
