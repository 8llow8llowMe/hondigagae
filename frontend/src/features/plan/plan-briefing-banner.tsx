import { Banner } from '@/components/banner'
import { Surface } from '@/components/surface'
import { messages } from '@/lib/messages'
import { pickBriefingDate } from '@/lib/plan/briefing'

/**
 * 일정 상세의 출발 전 브리핑 진입점 — 일정상세-세부명세 **D16**.
 *
 * **자리는 개요 카드 바로 아래(위 레일)다.** 아래 레일(준비물·후기·응급 배너)은 모바일에서
 * **일자 카드 뒤**라, 출발 당일 아침에 여는 사람에게 그날 브리핑이 일자 카드 아래에 있으면
 * 늦다 — 준비물을 일자 뒤로 내린 근거(_"오늘 이 화면을 연 사람이 찾는 것"_)를 그대로
 * 뒤집어 적용한 자리다.
 *
 * **노출은 날짜 축 하나로만 가른다.** `pickBriefingDate` 가 `null` 이면 렌더하지 않는다 —
 * 눌러도 부를 날짜가 없어 빈 화면으로 보내기 때문이다(응급 배너를 상시로 둔 것과 다른
 * 판단, 명세 D8-4). **상태(`status.code`)를 보지 않는다**: `COMPLETED` 로 가는 자동 전이가
 * 없어 상태가 날짜를 못 따라간다 (`screen-inventory.md` §4 · 명세 D8-5).
 *
 * **`today` 는 서버가 만든 값이 prop 으로 내려온다** — 자정 근처에서 서버 렌더와
 * 하이드레이션이 갈리지 않는다.
 *
 * **쿼리를 붙이지 않는다** (`?date=` 없음, 명세 D8-2). 링크를 여는 시점에 화면이 다시
 * 고른다 — 어제 열어 둔 탭을 눌러도 어제 브리핑으로 가지 않는다.
 */
export function PlanBriefingBanner({
  planId,
  startDate,
  endDate,
  today,
}: {
  planId: string
  startDate: string
  endDate: string
  /** `YYYY-MM-DD`. 서버가 만든 오늘이다 */
  today: string
}) {
  const target = pickBriefingDate(startDate, endDate, today)
  if (target === null) return null

  return (
    <Surface>
      <Banner
        href={`/plans/${planId}/briefing`}
        title={
          target.kind === 'EVE'
            ? messages.plan.briefingBannerEveTitle
            : messages.plan.briefingBannerTodayTitle
        }
        description={messages.plan.briefingBannerDescription}
        /*
          **`leading` 을 주지 않는다.** `Banner` 는 아이콘 자리에 `text-danger-500` 을
          하드코딩한다 — 병원 배너의 붉은 아이콘이 그 자리의 유일한 용례다. 브리핑은
          경보가 아니라 상시 진입점이라 붉은 아이콘을 얹으면 화면이 없는 위험을 말한다
          (DESIGN.md §2 — danger 는 경보·오류 축). 색을 prop 으로 여는 것은 공용
          컴포넌트를 두 화면 때문에 넓히는 일이라 이 이슈에서 하지 않는다.
        */
        inset="card"
      />
    </Surface>
  )
}
