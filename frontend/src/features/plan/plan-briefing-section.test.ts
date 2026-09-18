import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import type { PlanBriefingCurve } from '@/features/plan/plan-briefing-section'
import { PlanBriefingHeader, PlanBriefingSection } from '@/features/plan/plan-briefing-section'
import { mockWalkTimes } from '@/lib/api/mock/insight-data'
import { messages } from '@/lib/messages'
import {
  planBriefing,
  planBriefingItem,
  planBriefingSchedule,
  planBriefingWalkTimes,
  planBriefingWarning,
} from '@/test/fixtures/plan'
import type { PlanBriefingResponse } from '@/types/plan'

/**
 * 곡선이 그려졌는지 세는 표식 — `HourCell` 의 칸 폭이다.
 *
 * 문구로 세지 않는다: 행 라벨 `노면` 은 기준 캡션의 `노면(아스팔트)` 와 겹치고, 스크롤
 * 화살표 라벨은 클라이언트 측정을 거쳐야 나와 SSR 마크업에 없다.
 */
const CURVE_CELL = 'min-width:3.5rem'

/** 곡선을 아직 안 받은 기본값 — 이 이슈의 갈래는 대부분 곡선과 무관하다 */
const NO_CURVE: PlanBriefingCurve = { hourly: null, failed: false, onRetry: () => undefined }

function render(
  overrides: Partial<PlanBriefingResponse> = {},
  curve: PlanBriefingCurve = NO_CURVE,
  basisPetName: string | null = null,
) {
  return renderToStaticMarkup(
    createElement(PlanBriefingSection, {
      briefing: planBriefing(overrides),
      basisPetName,
      curve,
    }),
  )
}

/*
  ── 기상특보 — 이 이슈의 핵심 규칙 (명세 D5-3) ──────────────────────────────

  서버 javadoc: *"특보는 필드와 이유가 둘 다 null 일 때만 '발효 중인 특보 없음' 이다 —
  확인하지 못한 날은 이유가 채워진다."* 이유를 "없음" 으로 접으면 태풍경보를 조용히 지운다.
*/
describe('PlanBriefingSection — 기상특보의 "없음" 과 "확인 못 함"', () => {
  it('필드와 이유가 둘 다 null 일 때만 "없음" 이라고 말한다', () => {
    const markup = render({ weatherWarning: null, weatherWarningUnavailableReason: null })

    expect(markup).toContain(messages.plan.briefingWarningNone)
  })

  /** 회귀 감시의 본체 — 이유가 있는데 "없음" 으로 접으면 여기서 깨진다 */
  it('이유가 있으면 "없음" 이 아니라 "확인 못 함" 이고 서버 문장을 그대로 쓴다', () => {
    const reason = '기상특보는 출발 당일에만 확인합니다.'
    const markup = render({
      weatherWarning: null,
      weatherWarningUnavailableReason: reason,
    })

    expect(markup).toContain(messages.plan.briefingWarningUnavailableTitle)
    expect(markup).toContain(reason)
    expect(markup).not.toContain(messages.plan.briefingWarningNone)
  })

  it('조회 실패 문장도 같은 갈래로 간다 — 문장을 파싱해 가르지 않는다', () => {
    const reason = '기상특보 정보를 가져오지 못했습니다. 기상청 발표를 직접 확인해 주세요.'
    const markup = render({
      weatherWarning: null,
      weatherWarningUnavailableReason: reason,
    })

    expect(markup).toContain(reason)
    expect(markup).not.toContain(messages.plan.briefingWarningNone)
  })

  /*
    **이유 문장에 `다시 시도` 를 달지 않는다** (명세 D9-2). 코드가 없어 "당일에만
    확인"(정상)과 "가져오지 못했다"(일시 장애)를 화면이 가를 수 없다 — 고칠 수 없는 것에
    버튼을 달면 사용자가 계속 누른다.
  */
  it('특보를 확인하지 못한 날에 재시도 버튼을 달지 않는다', () => {
    const markup = render({
      weatherWarning: null,
      weatherWarningUnavailableReason: '기상특보는 출발 당일에만 확인합니다.',
      // 골든타임 쪽 재시도가 섞여 들어오지 않게 같은 갈래로 둔다
      walkTimes: null,
      walkTimesUnavailableReason: '산책 골든타임은 출발 당일에만 확인합니다.',
    })

    expect(markup).not.toContain(messages.common.retry)
  })

  it('특보가 있으면 배지 안에 낱말로 적고 "없음" 을 말하지 않는다', () => {
    const markup = render({ weatherWarning: planBriefingWarning() })

    expect(markup).toContain('태풍')
    expect(markup).toContain('경보')
    expect(markup).not.toContain(messages.plan.briefingWarningNone)
  })

  it('경보 단계 설명은 level 쪽을 쓴다 — type.description 은 판정 근거가 이미 쓴다', () => {
    const warning = planBriefingWarning()
    const markup = render({ weatherWarning: warning })

    expect(markup).toContain(warning.level.description)
    expect(markup).not.toContain(warning.type.description)
  })

  it('발효 시각은 HH:mm 만 쓰고, 없으면 그 줄을 만들지 않는다', () => {
    const withTime = render({ weatherWarning: planBriefingWarning() })
    const without = render({ weatherWarning: planBriefingWarning({ effectiveAt: null }) })

    // `발효 중이라 …`(추천 보류)와 섞이지 않게 시각이 붙은 꼴로만 센다
    expect(withTime).toContain('07:00 발효')
    expect(without).not.toMatch(/\d\d:\d\d 발효/)
  })

  /** **`level.code` 로 직접 판정하지 않는다** — 서버 DTO 가 이 값을 쓰라고 못박는다 */
  it('추천 보류 문장은 recommendationSuppressed 가 정한다', () => {
    const on = render({ weatherWarning: planBriefingWarning({ recommendationSuppressed: true }) })
    const off = render({
      weatherWarning: planBriefingWarning({ recommendationSuppressed: false }),
    })

    expect(on).toContain(messages.plan.briefingWarningSuppressed)
    expect(off).not.toContain(messages.plan.briefingWarningSuppressed)
  })
})

describe('PlanBriefingSection — 산책하기 좋은 시간 (명세 D5-4)', () => {
  /*
    **좌표가 오는 자리가 `walkTimes` 하나뿐이다.** 이 객체가 null 인 날은 곡선을 부를
    좌표가 아예 없다 — 상세의 `item.place.lat/lng` 로 메우지 않는다 (명세 D8-1).
  */
  it('walkTimes 가 null 이면 이유 문장만 내고 곡선도 재시도도 없다', () => {
    const reason = '대표 장소의 좌표가 없어 골든타임을 붙이지 못했습니다.'
    const markup = render({ walkTimes: null, walkTimesUnavailableReason: reason })

    expect(markup).toContain(reason)
    expect(markup).not.toContain(messages.common.retry)
    expect(markup).not.toContain(CURVE_CELL)
  })

  it('AVAILABLE 이면 창을 시각으로 적는다', () => {
    const markup = render()

    expect(markup).toContain('18:00 – 21:00')
  })

  /** en dash 를 "에서" 로 읽지 못하는 보조기기에 낱말로도 준다 (명세 D6) */
  it('시각 범위를 sr-only 낱말로도 말한다', () => {
    expect(render()).toContain('18:00부터 21:00까지')
  })

  /*
    **상태 문구를 FE 가 짓지 않는다.** `goldenWindowStatus` 는 metadata 고 서버가 한국어를
    채워 보낸다 — `goldenStart` 가 null 이라는 이유만으로 "모두 위험" 이라고 쓰지 않는다
    (그 문장은 `ALL_HOURS_RISKY` 일 때만 참이다).
  */
  it('SUPPRESSED_BY_WARNING 은 서버 name·description 을 그대로 쓴다', () => {
    const status = {
      code: 'SUPPRESSED_BY_WARNING',
      name: '특보로 추천 보류',
      description:
        '기상특보 경보가 발효 중이라 시간대가 좋아도 추천하지 않습니다. 시간대 곡선은 근거로 그대로 제공됩니다.',
    }
    const markup = render({
      walkTimes: planBriefingWalkTimes({
        goldenStart: null,
        goldenEnd: null,
        goldenWindowStatus: status,
      }),
    })

    expect(markup).toContain(status.name)
    expect(markup).toContain(status.description)
    expect(markup).not.toContain('모두 위험')
  })

  it('모르는 코드도 서버 문구를 그대로 낸다 — FE 매핑 테이블을 만들지 않는다', () => {
    const status = { code: 'NEW_SERVER_CODE', name: '새 상태', description: '새 설명입니다.' }
    const markup = render({
      walkTimes: planBriefingWalkTimes({
        goldenStart: null,
        goldenEnd: null,
        goldenWindowStatus: status,
      }),
    })

    expect(markup).toContain('새 상태')
    expect(markup).toContain('새 설명입니다.')
  })

  it('UNAVAILABLE 에만 곡선 재시도를 준다 — DAY_ENDED 는 정상이라 달지 않는다', () => {
    const broken = render({
      walkTimes: planBriefingWalkTimes({
        forecastCoverage: { code: 'UNAVAILABLE', name: '예보 없음', description: null },
      }),
    })
    const normal = render({
      walkTimes: planBriefingWalkTimes({
        forecastCoverage: { code: 'DAY_ENDED', name: '오늘 예보 종료', description: null },
      }),
    })

    expect(broken).toContain(messages.common.retry)
    expect(normal).not.toContain(messages.common.retry)
  })

  it('곡선 조회가 실패하면 그 자리만 실패하고 창·상태는 남는다', () => {
    const markup = render({}, { hourly: null, failed: true, onRetry: () => undefined })

    expect(markup).toContain(messages.plan.briefingCurveErrorTitle)
    expect(markup).toContain(messages.common.retry)
    // 창은 브리핑 응답의 것이라 곡선 실패와 무관하게 그대로 있다
    expect(markup).toContain('18:00 – 21:00')
  })

  it('곡선이 오면 그린다', () => {
    const data = mockWalkTimes({ heatSensitive: false, coldSensitive: true, noiseSensitive: false })
    const markup = render({}, { hourly: data.hourly, failed: false, onRetry: () => undefined })

    expect(markup).toContain(CURVE_CELL)
  })

  it('곡선이 빈 배열이면 곡선 자리를 비운다 — 상태 문구가 이미 이유를 말한다', () => {
    const markup = render({}, { hourly: [], failed: false, onRetry: () => undefined })

    expect(markup).not.toContain(CURVE_CELL)
  })

  /** **"현재 위치 기준" 이 아니다** — 그날 대표 장소 좌표 기준이다 */
  it('기준 줄이 대표 장소를 말한다', () => {
    const markup = render()

    expect(markup).toContain('협재해수욕장 기준')
    expect(markup).not.toContain('현재 위치')
  })

  it('대표 장소가 없으면 앞을 빼고 뒤만 쓴다', () => {
    const markup = render({
      schedule: planBriefingSchedule({
        representativePlaceId: null,
        representativePlaceTitle: null,
      }),
    })

    expect(markup).toContain(messages.plan.briefingWalkBasisNoPlace)
    expect(markup).not.toContain('기준 ·')
  })
})

describe('PlanBriefingSection — 그날 일정 (명세 D5-1)', () => {
  it('항목 수와 다녀온 수를 적는다 — 0 도 정보다', () => {
    const markup = render({ schedule: planBriefingSchedule({ itemCount: 4, visitedCount: 0 }) })

    expect(markup).toContain('항목 4개 · 다녀온 곳 0개')
  })

  it('항목이 0개면 빈 상태와 담기 링크를 내고 첫/마지막 줄을 내지 않는다', () => {
    const markup = render({
      schedule: planBriefingSchedule({
        itemCount: 0,
        visitedCount: 0,
        firstItem: null,
        lastItem: null,
      }),
    })

    expect(markup).toContain(messages.plan.briefingScheduleEmptyTitle)
    expect(markup).toContain('/days/2/add')
    expect(markup).not.toContain('처음')
    expect(markup).not.toContain('마지막')
  })

  it('항목이 하나면 마지막 줄을 내지 않는다 — 같은 항목이다', () => {
    const only = planBriefingItem()
    const markup = render({
      schedule: planBriefingSchedule({ itemCount: 1, firstItem: only, lastItem: only }),
    })

    expect(markup).toContain('처음 10:30 협재해수욕장')
    expect(markup).not.toContain('마지막')
  })

  it('시각이 없는 항목은 제목만 남기고 콜론 잔재를 남기지 않는다', () => {
    const markup = render({
      schedule: planBriefingSchedule({
        itemCount: 1,
        firstItem: planBriefingItem({ startTime: null }),
        lastItem: planBriefingItem({ startTime: null }),
      }),
    })

    expect(markup).toContain('처음 협재해수욕장')
    expect(markup).not.toContain('처음 :')
  })

  /*
    **유형 라벨을 그리지 않는다** (명세 D9-1). 이 응답에서만 `itemType` 이 metadata 가
    아니라 enum 문자열이라, 적으려면 FE 에 한국어 매핑 테이블이 필요하다 (루트 `CLAUDE.md`
    금지). 코드가 화면에 그대로 새지 않는지도 함께 본다.
  */
  it('itemType 코드가 화면에 새지 않는다', () => {
    const markup = render()

    expect(markup).not.toContain('LODGING')
    expect(markup).not.toContain('PLACE')
  })

  it('대표 장소 id 가 없으면 링크를 만들지 않는다', () => {
    const linked = render()
    const plain = render({
      schedule: planBriefingSchedule({ representativePlaceId: null }),
    })

    expect(linked).toContain('>이 날 기준 장소 · 협재해수욕장</a>')
    // 링크가 아니라 글자로만 남는다. `/places/` 자체는 날씨 카드의 산책 버튼이 쓴다
    expect(plain).toContain('이 날 기준 장소 · 협재해수욕장')
    expect(plain).not.toContain('>이 날 기준 장소 · 협재해수욕장</a>')
  })

  it('그 일차 앵커로 돌아가는 링크를 준다', () => {
    expect(render()).toContain('#day2')
  })
})

describe('PlanBriefingSection — 날씨와 적합도 (명세 D5-2)', () => {
  it('일정 상세와 같은 판정 컴포넌트를 쓴다', () => {
    const markup = render()

    expect(markup).toContain('여행 적합')
  })

  it('weather 가 null 이면 자리를 비우지 않고 못 받았다고 말한다', () => {
    expect(render({ weather: null })).toContain(messages.plan.briefingWeatherMissing)
  })
})

describe('PlanBriefingSection — 접근성 계약 (명세 D6)', () => {
  it('카드 제목 넷이 h2 로 선다', () => {
    const markup = render()

    for (const heading of [
      messages.plan.briefingScheduleHeading,
      messages.plan.briefingWeatherHeading,
      messages.plan.briefingWarningHeading,
      messages.plan.briefingWalkHeading,
    ]) {
      expect(markup).toContain(`>${heading}<`)
    }
    expect(markup.split('<h2').length - 1).toBe(4)
  })

  it('카드 순서는 일정 → 날씨 → 특보 → 골든타임이다', () => {
    const markup = render()
    const order = [
      messages.plan.briefingScheduleHeading,
      messages.plan.briefingWeatherHeading,
      messages.plan.briefingWarningHeading,
      messages.plan.briefingWalkHeading,
    ].map((heading) => markup.indexOf(heading))

    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
})

describe('PlanBriefingHeader — h1 은 어느 갈래에도 있다 (명세 D6)', () => {
  it('부제가 없어도 h1 과 돌아가기가 선다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlanBriefingHeader, { planId: 'p-1', subtitle: null }),
    )

    expect(markup).toContain(`>${messages.plan.briefingHeading}<`)
    expect(markup).toContain(messages.plan.briefingBack)
    expect(markup).toContain('href="/plans/p-1"')
  })

  it('부제가 있으면 그대로 그린다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlanBriefingHeader, {
        planId: 'p-1',
        subtitle: '몽실이와 제주 2박 3일 · 2일차 09-13 (일)',
      }),
    )

    expect(markup).toContain('2일차 09-13 (일)')
  })
})
