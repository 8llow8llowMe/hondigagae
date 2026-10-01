import { Banner } from '@/components/banner'
import { Surface } from '@/components/surface'
import { messages } from '@/lib/messages'
import { formatPlanDay } from '@/lib/plan/date'
import type { TripBanner } from '@/lib/plan/trip-banner'
import { cn } from '@/lib/utils/cn'

/**
 * 홈 첫 화면 여행 배너 (#1113 · 홈 명세 D5-1c).
 *
 * **출발 7일 안쪽 · 여행 중인 일정 하나**를 첫 화면으로 올린다. 그 전에는 홈 맨 아래
 * `다가오는 일정` 한 줄뿐이라(375 y=1766 · 1440 y=905) 여행 당일에 오늘의 브리핑에 닿으려면
 * 맨 아래 → 일정 상세 → 배너를 거쳐야 했다.
 *
 * **면은 `tone="brand"` 다** (DESIGN.md §0-3) — 그 이틀 · 일주일에만 존재하는 진입점이라
 * 아래 상시 배너(AI · 올레 · 병원)와 같은 무게로 서면 어느 쪽이 오늘의 일인지 화면이 말하지
 * 못한다. 일정 상세의 브리핑 배너(`plan-briefing-banner.tsx`)와 같은 짝이다.
 *
 * **`leading` 을 주지 않는다** — `Banner` 의 아이콘 자리는 danger 색 고정(병원 배너 전용)이다.
 *
 * 홈이 폭별 자리를 둘로 두므로(1024 미만 첫 카드 · 이상 우측 열 머리) 표시 클래스를
 * `className` 으로 받는다 — 레이아웃 · 표시 유틸리티만 (component-guide §3).
 */
export function TripBannerCard({ banner, className }: { banner: TripBanner; className?: string }) {
  const { plan } = banner
  const description = descriptionOf(banner)

  return (
    <Surface tone="brand" className={cn(className)}>
      <Banner
        href={banner.kind === 'SOON' ? `/plans/${plan.planId}` : `/plans/${plan.planId}/briefing`}
        title={titleOf(banner)}
        {...(description === null ? {} : { description })}
        inset="card"
      />
    </Surface>
  )
}

function titleOf(banner: TripBanner): string {
  switch (banner.kind) {
    case 'TODAY':
      return messages.home.tripBannerTodayTitle.replace('{day}', String(banner.day))
    case 'EVE':
      return messages.plan.briefingBannerEveTitle
    case 'SOON':
      return messages.home.tripBannerSoonTitle
        .replace('{days}', String(banner.days))
        .replace('{title}', banner.plan.title)
  }
}

/**
 * 당일 · 전날은 **어느 일정인지**를, D-N 은 **언제 떠나는지**를 말한다 — D-N 제목이 이미
 * 일정 이름을 갖고 있다. 날짜를 못 읽으면(`formatPlanDay` 가 `null`) 설명 줄을 비운다 —
 * 서버 문자열을 `{date} 출발` 에 끼워 `2026-10-06 출발` 같은 다른 모양을 만들지 않는다.
 */
function descriptionOf(banner: TripBanner): string | null {
  if (banner.kind !== 'SOON') return banner.plan.title

  const date = formatPlanDay(banner.plan.startDate)
  return date === null ? null : messages.home.tripBannerSoonDescription.replace('{date}', date)
}
