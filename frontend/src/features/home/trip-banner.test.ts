import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { TripBannerCard } from '@/features/home/trip-banner'
import { messages } from '@/lib/messages'
import type { TripBanner } from '@/lib/plan/trip-banner'
import { upcomingPlan } from '@/test/fixtures/insight'
import { openingTags, readSourceWithoutComments as source } from '@/test/source'

/**
 * 홈 첫 화면 여행 배너 (#1113 · 홈 명세 D5-1c).
 *
 * 배너 자체는 렌더로, **홈이 어디에 꽂고 아래 섹션과 어떻게 나누는가**는 소스로 본다 —
 * `home-view.tsx` 는 `useQuery` 여럿을 부르는 client component 라 렌더할 수 없다
 * (`home-entry-banners.test.ts` 머리주석과 같은 이유).
 */
const PLAN = { ...upcomingPlan, planId: 'p-1', startDate: '2026-10-06', endDate: '2026-10-08' }

function render(banner: TripBanner) {
  return renderToStaticMarkup(createElement(TripBannerCard, { banner }))
}

describe('TripBannerCard — 갈래별 문구와 목적지', () => {
  it('당일 · 여행 중은 오늘의 브리핑으로 보내고 며칠째인지 적는다', () => {
    const markup = render({ kind: 'TODAY', plan: PLAN, day: 2 })

    expect(markup).toContain('href="/plans/p-1/briefing"')
    expect(markup).toContain('오늘의 브리핑 · 2일차')
    expect(markup).toContain(PLAN.title)
  })

  /* 같은 문이 홈과 상세에서 다른 이름을 갖지 않는다 */
  it('당일 · 전날 제목은 일정 상세의 브리핑 배너와 같은 말이다', () => {
    expect(
      messages.home.tripBannerTodayTitle.startsWith(messages.plan.briefingBannerTodayTitle),
    ).toBe(true)
    expect(render({ kind: 'EVE', plan: PLAN })).toContain(
      `>${messages.plan.briefingBannerEveTitle}<`,
    )
  })

  it('전날도 브리핑으로 보낸다', () => {
    expect(render({ kind: 'EVE', plan: PLAN })).toContain('href="/plans/p-1/briefing"')
  })

  /* 2 ~ 7일 전에는 브리핑이 기간 밖(`아직 브리핑할 날이 아니에요`)이라 상세로 보낸다 */
  it('D-N 은 일정 상세로 보내고 출발일을 적는다', () => {
    const markup = render({ kind: 'SOON', plan: PLAN, days: 5 })

    expect(markup).toContain('href="/plans/p-1"')
    expect(markup).not.toContain('/briefing')
    expect(markup).toContain(`D-5 · ${PLAN.title}`)
    expect(markup).toContain('10월 6일 (화) 출발')
  })

  it('출발일을 못 읽으면 설명 줄을 비운다 — 서버 문자열로 다른 모양을 만들지 않는다', () => {
    const markup = render({ kind: 'SOON', plan: { ...PLAN, startDate: '2026-13-01' }, days: 5 })

    expect(markup).not.toContain('출발')
    expect(markup).not.toContain('2026-13-01')
  })

  /* 시간이 정한 진입점 — 상시 배너와 같은 무게로 서지 않는다 (DESIGN.md §0-3) */
  it('면은 tone="brand" 다', () => {
    const markup = render({ kind: 'TODAY', plan: PLAN, day: 1 })

    expect(markup).toContain('border-brand-500')
    expect(markup).toContain('bg-row-selected')
  })
})

const HOME = source('src/features/home/home-view.tsx')

/** `<TripBannerCard …>` 열기 태그 둘 — 폭별 자리 */
function bannerTags(): string[] {
  return openingTags(HOME, /<TripBannerCard\b/g)
}

describe('홈 → 여행 배너 자리 (#1113)', () => {
  it('두 자리에 두고 폭별로 하나만 보인다', () => {
    const tags = bannerTags()

    expect(tags).toHaveLength(2)
    expect(tags.filter((tag) => tag.includes('className="lg:hidden"'))).toHaveLength(1)
    expect(tags.filter((tag) => tag.includes('className="hidden lg:block"'))).toHaveLength(1)
  })

  /* 1024 미만 한 컬럼에서 우측 열은 좌측 레일 뒤라 첫 카드가 돼야 첫 화면에 닿는다 */
  it('1024 미만 사본은 좌측 레일의 첫 카드다 — 프로필보다 앞이다', () => {
    const mobile = HOME.indexOf(bannerTags().find((tag) => tag.includes('lg:hidden')) as string)

    expect(mobile).toBeGreaterThan(HOME.indexOf('lg:sticky lg:top-16'))
    expect(mobile).toBeLessThan(HOME.indexOf('<ProfileCard'))
  })

  it('1024 이상 사본은 우측 열 머리다 — 권역보다 앞이다', () => {
    const desktop = HOME.indexOf(
      bannerTags().find((tag) => tag.includes('hidden lg:block')) as string,
    )

    expect(desktop).toBeGreaterThan(HOME.indexOf('<SurfaceStack className="lg:pl-3">'))
    expect(desktop).toBeLessThan(HOME.indexOf('<RegionalWeatherSection'))
  })

  it('판정은 pickHomePlans 에 맡긴다 — 홈이 날짜를 다시 비교하거나 목록을 다시 거르지 않는다', () => {
    expect(HOME).toContain('pickHomePlans(plans, today, todayIso, UPCOMING_PLAN_COUNT)')
    expect(HOME).not.toContain('pickUpcomingPlans(')
  })

  it('게스트는 배너도 섹션도 없다 — authed 로 둘 다 막는다', () => {
    expect(HOME).toContain('const tripBanner = authed ?')
    expect(HOME).toContain('const planSectionShown = authed &&')
    expect(HOME).toContain('{planSectionShown && (')
  })
})
