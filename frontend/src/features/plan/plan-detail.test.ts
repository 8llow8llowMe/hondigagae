import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDaySection } from '@/features/plan/plan-day-section'
import { PlanDayVerdict } from '@/features/plan/plan-day-verdict'
import { PlanItemRow } from '@/features/plan/plan-item-row'
import { PlanOverviewPanel } from '@/features/plan/plan-overview-panel'
import { LONG_TRIP_THRESHOLD_M } from '@/lib/geo/distance'
import { messages } from '@/lib/messages'
import {
  pet,
  planDayAdd,
  planDayVisit,
  planDetail,
  planItem,
  planVerdict,
  secondPet,
} from '@/test/fixtures/plan'
import type { PlaceDetail } from '@/types/place'
import type { PlanDayWeatherItem } from '@/types/plan'

const TODAY = new Date('2026-09-01T00:00:00Z')

function renderVerdict(overrides: Partial<PlanDayWeatherItem> | null = {}, extra = {}) {
  return renderToStaticMarkup(
    createElement(PlanDayVerdict, {
      verdict: overrides === null ? undefined : { ...planVerdict, ...overrides },
      petConditionApplied: true,
      basisPetName: null,
      failed: false,
      onRetry: () => undefined,
      ...extra,
    }),
  )
}

describe('PlanDayVerdict — 근거의 정보성/감점을 구분한다 (#148)', () => {
  /*
    `ReasonList` 는 정보성 항목만 `text-fg-muted` 로 한 단계 내리고, 감점은 `text-fg` 다.
    적합도 패널과 **같은 처리**여야 한다 — 예전에는 타입이 `scoreDelta` 를 잘라 이쪽만
    구분을 못 했다.
  */
  const PENALTY = { code: 'RAIN', name: '비', description: '비가 옵니다.', scoreDelta: -25 }
  const INFO = {
    code: 'NO_DATA',
    name: '자료 없음',
    description: '자료가 없습니다.',
    scoreDelta: 0,
  }

  it('감점 근거와 정보성 근거를 다른 톤으로 낸다', () => {
    const markup = renderVerdict({ reasons: [PENALTY, INFO] })

    expect(markup).toContain(`>${PENALTY.description}<`)
    expect(markup).toContain(`>${INFO.description}<`)
    // 정보성 하나만 흐리게 내려간다
    expect(markup.split('text-fg-muted').length - 1).toBeGreaterThan(0)
  })

  it('정보성만 있으면 흐린 항목이 되고, 감점만 있으면 그렇지 않다', () => {
    const info = renderVerdict({ reasons: [INFO] })
    const penalty = renderVerdict({ reasons: [PENALTY] })

    expect(info).toContain(`class="text-body-2 text-fg-muted"`)
    expect(penalty).not.toContain(`class="text-body-2 text-fg-muted"`)
    expect(penalty).toContain(`class="text-body-2 text-fg"`)
  })

  it('서버가 준 순서를 바꾸지 않는다 — 영향이 큰 순서로 온다', () => {
    const markup = renderVerdict({ reasons: [PENALTY, INFO] })

    expect(markup.indexOf(PENALTY.description)).toBeLessThan(markup.indexOf(INFO.description))
  })

  it('점수 숫자를 노출하지 않는다 — 등급은 상단 요약이 말한다', () => {
    expect(renderVerdict({ reasons: [PENALTY] })).not.toContain('-25')
  })
})

describe('PlanDayVerdict — 판정을 못 낸 것과 낮은 것을 구분한다', () => {
  it('score 가 null 이면 등급 배지 대신 서버 문장을 그대로 쓴다', () => {
    const markup = renderVerdict({
      score: null,
      suitabilityLevel: null,
      unavailableReason: '기상 예보는 11일까지만 제공돼 이 날은 아직 판단할 수 없습니다.',
    })

    expect(markup).toContain('기상 예보는 11일까지만 제공돼')
    // 0점이나 등급 배지로 만들지 않는다
    expect(markup).not.toContain('여행 적합')
    expect(markup).not.toContain('0')
  })

  it('등급을 색으로만 전달하지 않는다 — 문구가 함께 간다', () => {
    const markup = renderVerdict()

    expect(markup).toContain('여행 적합')
  })

  it('representativePlaceId 가 null 이면 산책 버튼을 만들지 않는다 — 부를 대상이 없다', () => {
    expect(renderVerdict()).toContain(messages.plan.walkAction)
    expect(renderVerdict({ representativePlaceId: null })).not.toContain(messages.plan.walkAction)
  })

  it('MID_TERM 이면 출처를 밝힌다 — 정밀도 차이를 감추지 않는다', () => {
    const midTerm = renderVerdict({
      weather: {
        ...planVerdict.weather!,
        forecastSourceCode: 'MID_TERM',
        forecastSourceName: '중기예보',
      },
    })

    expect(midTerm).toContain('중기예보')
    expect(renderVerdict()).not.toContain('대략적인 값')
  })

  it('petConditionApplied 가 false 면 일반 조건 판정임을 알린다', () => {
    expect(renderVerdict({}, { petConditionApplied: false })).toContain(
      messages.plan.verdictPetConditionMissing,
    )
    expect(renderVerdict()).not.toContain(messages.plan.verdictPetConditionMissing)
  })

  it('판정이 아직 없으면 아무것도 렌더하지 않는다 — 빈 등급을 만들지 않는다', () => {
    expect(renderVerdict(null)).toBe('')
  })
})

function renderDaySection(overrides = {}) {
  return renderToStaticMarkup(
    createElement(PlanDaySection, {
      day: 1,
      date: '2026-09-12',
      rows: [{ item: planDetail.items[0]!, distanceMeters: null, distanceKind: null }],
      places: new Map<string, PlaceDetail>(),
      verdict: planVerdict,
      petConditionApplied: true,
      basisPetName: null,
      verdictFailed: false,
      onRetryVerdict: () => undefined,
      editing: false,
      onStartEdit: () => undefined,
      editor: null,
      add: planDayAdd,
      visit: planDayVisit,
      regenerateHref: '/plans/1/days/1/regenerate',
      ...overrides,
    }),
  )
}

describe('PlanDaySection', () => {
  it('판정이 5xx 로 실패해도 항목은 남는다 — 오류가 일자 섹션 안에만 있다 (아트보드 06 ③)', () => {
    const markup = renderDaySection({ verdictFailed: true })

    expect(markup).toContain(messages.plan.verdictErrorTitle)
    expect(markup).toContain(messages.common.retry)
    // 항목은 그대로 있다. 일정 자료는 우리 DB 이고 판정은 외부 예보다
    expect(markup).toContain('김창열미술관')
  })

  it('일자 섹션이 자기 제목을 aria-labelledby 로 가리킨다', () => {
    const markup = renderDaySection()

    expect(markup).toContain('aria-labelledby="day1"')
    expect(markup).toContain('id="day1"')
  })

  it('항목이 0개면 빈 안내를 낸다', () => {
    expect(renderDaySection({ rows: [] })).toContain(messages.plan.dayEmpty)
  })

  it('실내 대안이 비면 블록을 렌더하지 않는다 — 비 예보가 없는 일자다', () => {
    expect(renderDaySection()).not.toContain(messages.plan.indoorAlternativesTitle)

    const rainy = renderDaySection({
      verdict: {
        ...planVerdict,
        indoorAlternatives: [{ placeId: '212481712381923330', title: '오설록 티뮤지엄 카페' }],
      },
    })
    expect(rainy).toContain(messages.plan.indoorAlternativesTitle)
    expect(rainy).toContain('오설록 티뮤지엄 카페')
  })

  it('일자 헤더에 다시 만들기가 있고 재생성 라우트를 가리킨다 (#128)', () => {
    const markup = renderDaySection({ regenerateHref: '/plans/1/days/2/regenerate' })

    expect(markup).toContain(messages.plan.regenerateDayAction)
    expect(markup).toContain('href="/plans/1/days/2/regenerate"')
  })

  /*
    R3-2. 빈 날을 채우는 것이 이 기능이 가장 쓸모 있는 순간이다 — `순서 편집` 과 달리
    항목 수를 보지 않는다 (`장소 추가` 와 같은 판단).
  */
  it('항목이 0개인 날에도 남는다', () => {
    const markup = renderDaySection({ rows: [], regenerateHref: '/plans/1/days/3/regenerate' })

    expect(markup).toContain(messages.plan.regenerateDayAction)
    expect(markup).not.toContain(messages.plan.editDayAction)
  })

  /*
    **제출이 늘 400 인 일정에서는 진입점을 내지 않는다** (#128). `POST /ai-plans` 가 재생성
    검증 앞에서 시작일(`AIPLAN_017`)과 일수(`AIPLAN_018`)를 보므로, 이미 시작한 여행과
    11일 이상 일정은 눌러도 서버 문구만 받는다 — `AiPlanFailed.manualHref` 와 같은 판단으로
    갈래에서 뺀다. 어느 일정이 그런지는 `dayRegenerateBlock` 이 판정한다.
  */
  it('regenerateHref 가 null 이면 다시 만들기를 내지 않는다', () => {
    const markup = renderDaySection({ regenerateHref: null })

    expect(markup).not.toContain(messages.plan.regenerateDayAction)
    expect(markup).not.toContain('/regenerate')
    // 나머지 진입점은 그대로다 — 막힌 것은 재생성뿐이다
    expect(markup).toContain(messages.plan.addPlaceAction)
    expect(markup).toContain(messages.plan.editDayAction)
  })
})

function renderItemRow(overrides = {}) {
  return renderToStaticMarkup(
    createElement(PlanItemRow, {
      model: { item: planDetail.items[0]!, distanceMeters: null, distanceKind: null },
      ...overrides,
    }),
  )
}

describe('PlanItemRow', () => {
  it('place 가 비어 와도 제목을 남기고 행을 지우지 않는다', () => {
    const markup = renderItemRow({
      model: {
        item: { ...planDetail.items[0]!, place: null },
        distanceMeters: null,
        distanceKind: null,
      },
    })

    expect(markup).toContain('김창열미술관')
  })

  it('거리는 "직선" 을 밝힌다 — 주행거리로 읽히면 안 된다', () => {
    const markup = renderItemRow({
      model: {
        item: planDetail.items[0]!,
        distanceMeters: 4100,
        distanceKind: 'previous',
      },
    })

    expect(markup).toContain('직선 4.1km')
  })

  it('30km 이상은 경고 톤 + 문장이 함께 간다 — 색으로만 말하지 않는다', () => {
    const markup = renderItemRow({
      model: {
        item: planDetail.items[0]!,
        distanceMeters: LONG_TRIP_THRESHOLD_M + 1_000,
        distanceKind: 'previous',
      },
    })

    expect(markup).toContain('하루 이동이 깁니다')
    expect(markup).toContain('text-metric-low-700')
  })

  it('거리 기준이 없으면 거리 줄 자체가 없다', () => {
    expect(renderItemRow()).not.toContain('직선')
  })

  it('WALK 는 장소 링크를 만들지 않는다 — targetId 가 walk_course.id 다', () => {
    const walk = planItem({
      planItemId: 'w',
      day: 1,
      sequence: 0,
      itemType: { code: 'WALK', name: '산책', description: null },
      targetId: '777777777777000001',
      title: '오설록 주변 산책',
    })

    const markup = renderItemRow({
      model: { item: walk, distanceMeters: null, distanceKind: null },
    })

    expect(markup).not.toContain('href="/places/777777777777000001"')
    // 유형이 장소가 아니면 라벨로 알린다
    expect(markup).toContain('산책')
  })

  it('PLACE 는 라벨을 붙이지 않는다 — 기본값이라 잡음이다', () => {
    expect(renderItemRow()).toContain('href="/places/212481712381923328"')
    expect(renderItemRow()).not.toContain('>장소<')
  })
})

function renderOverview(overrides = {}) {
  return renderToStaticMarkup(
    createElement(PlanOverviewPanel, {
      plan: planDetail,
      companions: [pet],
      petPending: false,
      today: TODAY,
      verdicts: [planVerdict],
      ...overrides,
    }),
  )
}

describe('PlanOverviewPanel', () => {
  it('반려견 조회가 실패하면 카드만 빠지고 나머지는 그대로다', () => {
    const markup = renderOverview({ companions: [] })

    // 일정 제목에도 '몽실이' 가 들어 있다 — 카드 고유 정보(품종)로 판정한다
    expect(markup).not.toContain('푸들')
    expect(markup).toContain('몽실이와 제주 2박 3일')
    expect(markup).toContain('총 3일')
  })

  it('반려견이 있으면 이름과 특성을 함께 낸다', () => {
    const markup = renderOverview()

    expect(markup).toContain('푸들')
    expect(markup).toContain('소형견')
  })

  /*
    #218. 대표 한 마리만 세우면 일자 판정이 `verdictBasisPet` 으로 부르는 이름이 화면
    어디에도 없게 된다 — 같은 화면이 두 사실을 동시에 말한다.
  */
  it('동행이 두 마리면 둘 다 세운다 — 기준 아이 이름이 카드 안에 있어야 한다', () => {
    const markup = renderOverview({ companions: [pet, secondPet] })

    expect(markup).toContain('몽실이')
    expect(markup).toContain('초코')
    // 카드 고유 정보(품종)로 판정한다 — 이름은 일정 제목에도 들어 있다
    expect(markup).toContain('푸들')
    expect(markup).toContain('리트리버')
  })

  it('상태 배지는 서버 name 을 그대로 쓴다', () => {
    expect(renderOverview()).toContain('초안')
  })

  it('서버가 모르는 상태 코드를 내려도 이름 그대로 초안처럼 그린다 (공통명세 S7)', () => {
    const markup = renderOverview({
      plan: {
        ...planDetail,
        status: { code: 'ARCHIVED', name: '보관됨', description: null },
      },
    })

    expect(markup).toContain('보관됨')
    expect(markup).toContain('border-dashed')
  })

  it('판정 목차가 앵커 링크다 — 요약이면서 목차다', () => {
    const markup = renderOverview()

    expect(markup).toContain('href="#day1"')
    expect(markup).toContain('여행 적합')
  })

  it('판정을 못 낸 날은 목차에서 점선 unknown 이다 — 낮은 등급으로 칠하지 않는다', () => {
    const markup = renderOverview({
      verdicts: [{ ...planVerdict, score: null, suitabilityLevel: null }],
    })

    expect(markup).toContain(messages.plan.verdictTocUnavailable)
    expect(markup).toContain('border-dashed')
  })

  it('예산이 없으면 미정으로 말한다 — 0원으로 단정하지 않는다', () => {
    expect(renderOverview({ plan: { ...planDetail, budget: null } })).toContain(
      messages.plan.budgetEmpty,
    )
    expect(renderOverview()).toContain('400,000')
  })
})

describe('PlanDayVerdict — 기준 반려견 (#176)', () => {
  it('한 마리 일정이면 줄이 없다', () => {
    expect(renderVerdict()).not.toContain('기준이에요')
  })

  /*
    기준은 그날 점수가 가장 낮은 아이라 날마다 다를 수 있다. 이유를 함께 말하지 않으면
    사용자는 "왜 이 아이지" 를 알 수 없다.
  */
  it('기준 아이 이름과 그 이유를 함께 말한다', () => {
    const markup = renderVerdict({}, { basisPetName: '초코' })

    expect(markup).toContain('초코 기준이에요')
    expect(markup).toContain('가장 힘든 아이')
  })

  /*
    아래 두 줄(중기예보 출처 · 특성 미반영)은 판정을 어떻게 읽어야 하는지의 단서인데,
    이 줄은 **누구의 판정인지**라 먼저 와야 나머지가 그 아이 이야기로 읽힌다.
  */
  it('같은 묶음의 다른 안내보다 먼저 온다', () => {
    const markup = renderVerdict(
      { weather: { ...planVerdict.weather!, forecastSourceCode: 'MID_TERM' } },
      { basisPetName: '초코', petConditionApplied: false },
    )

    expect(markup.indexOf('초코 기준이에요')).toBeLessThan(
      markup.indexOf(messages.plan.verdictPetConditionMissing),
    )
  })
})
