import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanBriefingBanner } from '@/features/plan/plan-briefing-banner'
import { PlanDaySection } from '@/features/plan/plan-day-section'
import { PlanDayVerdict } from '@/features/plan/plan-day-verdict'
import { PlanItemRow } from '@/features/plan/plan-item-row'
import { PLAN_VERDICT_STRIP_MAX_DAYS, PlanOverviewPanel } from '@/features/plan/plan-overview-panel'
import { LONG_TRIP_THRESHOLD_M } from '@/lib/geo/distance'
import { messages } from '@/lib/messages'
import {
  pet,
  planDayAdd,
  planDayVisit,
  planDayWalkSafety,
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
      // 항목이 있는 날이 기본이다 — 이 갈래는 `NO_PLACE_ITEM` 감추기와 무관하다 (#497)
      dayHasItems: true,
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

  /* 출처는 근거 문단 맨 아래가 아니라 **큰 숫자 옆**이다 (#732) — 값과 이어져야 읽힌다 */
  it('MID_TERM 이면 값 옆에서 출처를 밝힌다 — 정밀도 차이를 감추지 않는다', () => {
    const midTerm = renderVerdict({
      weather: {
        ...planVerdict.weather!,
        forecastSourceCode: 'MID_TERM',
        forecastSourceName: '중기예보',
      },
    })
    const value = midTerm.indexOf(messages.plan.verdictFeelsLikeLabel)

    expect(midTerm.indexOf('중기예보')).toBeGreaterThan(value)
    expect(midTerm.indexOf('중기예보')).toBeLessThan(midTerm.indexOf(messages.plan.walkAction))
    expect(renderVerdict()).not.toContain('중기예보')
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
      walkSafety: planDayWalkSafety,
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

  it('일자 카드가 자기 이름을 갖고, 제목 id 는 목차 앵커로 남는다 (#447)', () => {
    const markup = renderDaySection()

    // 헤더가 날짜·버튼 셋을 스스로 그려 `title` 슬롯 대신 `aria-label` 이다
    expect(markup).toContain(`aria-label="${messages.plan.dayLabel.replace('{day}', '1')}"`)
    expect(markup).toContain('id="day1"')
  })

  it('항목이 0개면 빈 안내를 낸다', () => {
    expect(renderDaySection({ rows: [] })).toContain(messages.plan.dayEmpty)
  })

  /*
    **같은 사실을 두 번 말하지 않는다** (#497). 빈 일차에는 서버의 `NO_PLACE_ITEM` 문장과
    화면의 빈 일차 안내가 나란히 섰고, 서버는 합쇼체라 말투까지 갈렸다.

    남는 쪽은 화면 문장이다 — 서버 문장은 "날씨를 붙이지 못했다" 는 내부 사정(일자 판정
    파이프라인)을 노출하는데, 사용자에게는 담은 곳이 없다는 것이 전부다.
  */
  it('빈 일차에서 서버 문장과 화면 문장이 같은 말을 두 번 하지 않는다 (#497)', () => {
    const serverSentence = '이 날짜에는 장소가 지정된 일정 항목이 없어 날씨를 붙이지 못했습니다.'
    const markup = renderDaySection({
      rows: [],
      verdict: {
        ...planVerdict,
        score: null,
        suitabilityLevel: null,
        unavailableReasonCode: 'NO_PLACE_ITEM',
        unavailableReason: serverSentence,
      },
    })

    expect(markup).toContain(messages.plan.dayEmpty)
    expect(markup).not.toContain(serverSentence)
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

  /*
    **`다시 만들기` 는 이제 `⋯` 안이다** (#653 · 진단 PL-4 · 명세 D11-4). 닫힌 `Menu` 는
    `null` 을 렌더하므로(`menu.tsx:81`) 정적 마크업에서 항목 자체를 볼 수 없다 — **여기서는
    트리거의 존재를, 항목과 링크는 e2e 가 본다** (`e2e/plan-status.spec.ts`).
  */
  it('일자 헤더에 재생성 오버플로 트리거가 있다 (#128 · #653)', () => {
    const markup = renderDaySection({ regenerateHref: '/plans/1/days/1/regenerate' })

    expect(markup).toContain(`aria-label="${messages.plan.dayMenuLabel.replace('{day}', '1')}"`)
  })

  /*
    **44px 최소 터치 영역** (DESIGN.md §7). `#653` 이후 이 트리거가 모바일에서
    `다시 만들기` 의 **유일한 진입점**이라 `sm`(32px)으로 두면 규칙을 깬다 —
    같은 카드의 방문 토글이 44 를 지키는 것과 같은 기준이다.
  */
  it('오버플로 트리거가 44px 터치 영역을 갖는다', () => {
    const markup = renderDaySection({ regenerateHref: '/plans/1/days/1/regenerate' })
    const trigger = markup.slice(
      markup.indexOf(`aria-label="${messages.plan.dayMenuLabel.replace('{day}', '1')}"`) - 400,
      markup.indexOf(`aria-label="${messages.plan.dayMenuLabel.replace('{day}', '1')}"`),
    )

    expect(trigger).toContain('h-11 w-11')
    expect(trigger).not.toContain('h-8 w-8')
  })

  /* 일자마다 이름이 갈려야 한다 — 3일 일정이면 같은 `⋯` 가 셋이다 */
  it('오버플로 트리거의 이름에 일자가 들어간다', () => {
    const markup = renderDaySection({ day: 3, regenerateHref: '/plans/1/days/3/regenerate' })

    expect(markup).toContain(`aria-label="${messages.plan.dayMenuLabel.replace('{day}', '3')}"`)
    expect(markup).not.toContain(messages.plan.dayMenuLabel.replace('{day}', '1'))
  })

  /*
    R3-2. 빈 날을 채우는 것이 이 기능이 가장 쓸모 있는 순간이다 — `순서 편집` 과 달리
    항목 수를 보지 않는다 (`장소 추가` 와 같은 판단).
  */
  it('항목이 0개인 날에도 남는다', () => {
    const markup = renderDaySection({
      rows: [],
      day: 3,
      regenerateHref: '/plans/1/days/3/regenerate',
    })

    expect(markup).toContain(messages.plan.dayMenuLabel.replace('{day}', '3'))
    expect(markup).toContain(messages.plan.addPlaceAction)
    expect(markup).not.toContain(messages.plan.editDayAction)
  })

  /*
    **제출이 늘 400 인 일정에서는 진입점을 내지 않는다** (#128). `POST /ai-plans` 가 재생성
    검증 앞에서 시작일(`AIPLAN_017`)과 일수(`AIPLAN_018`)를 보므로, 이미 시작한 여행과
    11일 이상 일정은 눌러도 서버 문구만 받는다 — `AiPlanFailed.manualHref` 와 같은 판단으로
    갈래에서 뺀다. 어느 일정이 그런지는 `dayRegenerateBlock` 이 판정한다.
  */
  /* 메뉴가 비면 `⋯` 도 내지 않는다 — 눌러도 아무것도 없는 트리거를 두지 않는다 */
  it('regenerateHref 가 null 이면 오버플로 트리거 자체를 내지 않는다', () => {
    const markup = renderDaySection({ regenerateHref: null })

    /*
      **항목·href 로 재지 않는다.** 닫힌 `Menu` 는 `null` 이라(`menu.tsx:81`) 그 둘은
      `regenerateHref` 가 무엇이든 정적 마크업에 안 나온다 — 무효한 단언이 된다.
      실제로 갈리는 것은 트리거뿐이고, 메뉴 안은 `e2e/plan-status.spec.ts` 가 본다.
    */
    expect(markup).not.toContain(messages.plan.dayMenuLabel.replace('{day}', '1'))
    // 나머지 진입점은 그대로다 — 막힌 것은 재생성뿐이다
    expect(markup).toContain(messages.plan.addPlaceAction)
    expect(markup).toContain(messages.plan.editDayAction)
  })

  /*
    ── 순서 (#653 · 진단 PL-4 · 명세 D11-7 #7)

    예전에는 액션 셋이 제목 줄 오른쪽이라 판정보다 위였다 — 390 실측에서 액션 top 749,
    판정 top 781. **읽는 순서와 탭 순서가 이제 같다.**
  */
  it('판정 → 항목 → 액션 순서다', () => {
    const rows = planDetail.items
      .slice(0, 2)
      .map((item) => ({ item, distanceMeters: null, distanceKind: null }))
    const markup = renderDaySection({ rows })

    const verdict = markup.indexOf(messages.plan.verdictFeelsLikeLabel)
    /*
      **마지막 항목 기준으로 잰다.** 첫 항목만 보면 액션 줄이 항목 1과 2 사이로 가도
      통과한다 — 목록 **전체** 뒤에 있는지가 이 단언이 지키려는 것이다.
    */
    const lastItem = markup.lastIndexOf(rows[1]!.item.title)
    const action = markup.indexOf(messages.plan.addPlaceAction)

    expect(verdict).toBeGreaterThan(-1)
    expect(lastItem).toBeGreaterThan(verdict)
    expect(action).toBeGreaterThan(lastItem)
  })

  /* 오버플로는 제목 줄에 남는다 — 판정 위에서 걷어낸 것은 액션 셋이지 `⋯` 가 아니다 */
  it('오버플로 트리거만 판정보다 위에 남는다', () => {
    const markup = renderDaySection()

    const trigger = markup.indexOf(messages.plan.dayMenuLabel.replace('{day}', '1'))
    const verdict = markup.indexOf(messages.plan.verdictFeelsLikeLabel)

    expect(trigger).toBeGreaterThan(-1)
    expect(trigger).toBeLessThan(verdict)
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

/** 일자 `1..days` 판정 목록. 상한·줄 수를 세는 단언이 쓴다 */
function verdictsOf(days: number) {
  return Array.from({ length: days }, (_, index) => ({ ...planVerdict, day: index + 1 }))
}

describe('PlanOverviewPanel', () => {
  it('반려견 조회가 실패하면 카드만 빠지고 나머지는 그대로다', () => {
    const markup = renderOverview({ companions: [] })

    // 일정 제목에도 '몽실이' 가 들어 있다 — 카드 고유 정보(품종)로 판정한다
    expect(markup).not.toContain('푸들')
    expect(markup).toContain('몽실이와 제주 2박 3일')
    expect(markup).toContain('총 3일')
  })

  /*
    #841. 한 마리면 일자 판정의 `basisPetName` 이 `null` 이라 일자 카드가 이름을 부르지
    않는다 — 두 줄짜리 카드로 세울 이유가 없다. 이름과 특성이 한 줄로 붙는다.
  */
  it('동행이 한 마리면 이름과 특성이 한 줄로 붙는다', () => {
    const markup = renderOverview()

    expect(markup).toContain('</span> \u00b7 \ud478\ub4e4 \uc18c\ud615\uacac')
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

  /*
    #561. 이 줄은 배지 기둥이 아니라 설명 줄이라 `여행 중` 이 아니라 `오늘 N일차` 를 쓴다 —
    바로 왼쪽에 `총 3일` 이 서 있어 두 값이 서로를 설명한다. 목록·홈과 어긋난 말이 아니라
    같은 판정에서 나온 더 자세한 말이다.
  */
  it('여행 중이면 D-day 자리에 며칠째인지를 쓴다', () => {
    const markup = renderOverview({
      plan: { ...planDetail, startDate: '2026-08-30', endDate: '2026-09-02' },
    })

    expect(markup).toContain('오늘 3일차')
    expect(markup).toContain('총 3일')
    expect(markup).not.toMatch(/D-\d/)
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

  /*
    #841. 축 라벨을 배지마다 붙이면 한 카드에서 세 번 선다. #652 의 요구("혼잡도의 `보통`
    과 구분")는 이제 **섹션 머리**(`messages.plan.verdictTocTitle`)가 충족한다 — 그 문구가
    축 이름을 담고 있어야 이 근거가 서므로 **문구를 주석에 박지 않고 상수로 지칭한다.**
    목차는 자기 이름을 갖고 배지는 그 아래라 등급어만 쓴다. **일자 카드의 배지는 그대로
    축을 단다** — 거기에는 이 섹션 머리가 없다 (`plan-day-verdict.tsx`).
  */
  it('목차 배지는 축 라벨을 반복하지 않는다 — 섹션 머리가 그 자리를 갖는다', () => {
    const markup = renderOverview({ verdicts: verdictsOf(3) })

    /* 카드 전체에서 `적합도` 가 딱 한 번 — 섹션 머리다. 배지 셋에는 없다 */
    expect(markup.split(messages.common.metricAxisSuitability)).toHaveLength(2)
    expect(markup).toContain(messages.plan.verdictTocTitle)
    expect(markup).toContain(`>${planVerdict.suitabilityLevel?.name}</span>`)
  })

  /*
    #841. 보이는 제목이 생겼으므로 `nav` 의 이름은 그 문단을 가리킨다 — `aria-label` 을
    그대로 두면 랜드마크 진입 시 이름으로 한 번 · 문단으로 또 한 번 읽힌다.
  */
  it('목차의 이름이 보이는 제목을 가리킨다 — 같은 문구를 두 번 읽지 않는다', () => {
    const markup = renderOverview()

    expect(markup).toContain('aria-labelledby="plan-verdict-toc-title"')
    expect(markup).toContain('id="plan-verdict-toc-title"')
    expect(markup).not.toContain(`aria-label="${messages.plan.verdictTocTitle}"`)
  })

  /* 앵커라는 신호가 없어 누르는 것인 줄 몰랐다 (#841). 꺾쇠는 장식이라 이름을 갖지 않는다 */
  it('목차 줄 안에 앵커임을 알리는 꺾쇠가 선다', () => {
    const markup = renderOverview()
    const tocItem = markup.slice(markup.indexOf('href="#day1"'), markup.indexOf('</a>'))

    expect(tocItem).toContain('<svg')
    expect(tocItem).toContain('aria-hidden="true"')
  })

  it('판정을 못 낸 날은 목차에서 점선 unknown 이다 — 낮은 등급으로 칠하지 않는다', () => {
    const markup = renderOverview({
      verdicts: [{ ...planVerdict, score: null, suitabilityLevel: null }],
    })

    expect(markup).toContain(messages.plan.verdictTocUnavailable)
    expect(markup).toContain('border-dashed')
  })

  /* 판정을 못 낸 배지도 같은 규칙이다 — 무엇의 판정인지는 섹션 머리가 말한다 (#841) */
  it('판정을 못 낸 목차 배지도 축 라벨 없이 판정 없음만 쓴다', () => {
    const markup = renderOverview({
      verdicts: [{ ...planVerdict, score: null, suitabilityLevel: null }],
    })
    const tocItem = markup.slice(markup.indexOf('href="#day1"'), markup.indexOf('</a>'))

    expect(tocItem).not.toContain(messages.common.metricAxisSuitability)
    expect(tocItem).toContain(`>${messages.plan.verdictTocUnavailable}</span>`)
  })

  /*
    #841. 예전에는 `예산 미정` 을 세웠다. 그런데 그것은 사실이 아니라 **빈 상태**이고,
    액션(예산 입력)으로 이어지지도 않는다 — 빈 상태를 사실처럼 적으면 잡음만 남는다.
    칸 자체를 세우지 않는다.
  */
  it('예산이 없으면 예산 칸이 아예 서지 않는다 — 미정이라고 적지 않는다', () => {
    const markup = renderOverview({ plan: { ...planDetail, budget: null } })

    expect(markup).not.toContain(messages.plan.budgetEmpty)
    expect(markup).not.toContain(messages.plan.budgetLabel)
  })

  it('예산이 있으면 천 단위로 끊어 쓴다', () => {
    expect(renderOverview()).toContain('400,000')
  })

  /*
    #841. 일자 카드는 `9월 12일 (토)` 인데 개요만 `2026년 9월 12일 (토)` 이라, 같은 날이
    한 화면에서 두 형식으로 섰다. 올해 일정에서만 연도를 뗀다.
  */
  it('올해 일정이면 날짜 줄에 연도를 쓰지 않는다', () => {
    expect(renderOverview()).not.toContain('2026\ub144')
  })

  it('해가 다른 일정은 연도를 그대로 쓴다 — 없으면 언제인지 알 수 없어진다', () => {
    const markup = renderOverview({
      plan: { ...planDetail, startDate: '2027-01-02', endDate: '2027-01-04' },
    })

    expect(markup).toContain('2027\ub144')
  })
})

/**
 * 일자별 판정 목차 (#732 · #841).
 *
 * 데스크톱 전용이던 `일자별 판정` 목차 **카드**를 대신한다 — 모바일 1순위 제품에서 전체
 * 판정 요약이 데스크톱에만 있었다. #841 에서 가로 한 줄을 다시 세로 목록으로 되돌렸다:
 * 걷어낼 이유였던 것은 `hidden lg:block` 이었지 세로 레이아웃 자체가 아니었고, 카드를
 * 만들지 않고 개요 카드 안에 두면 모든 폭에서 선다.
 */
describe('PlanOverviewPanel — 일자별 판정 목차 (#732 · #841)', () => {
  /* 구획 2(상태)가 구획 3(목차) 위다 — 언제 떠나는지를 먼저 읽고 어느 날이 좋은지를 본다 */
  it('D-day 가 목차보다 먼저 온다', () => {
    const markup = renderOverview()
    const dday = markup.indexOf(messages.plan.dday.replace('{days}', '11'))
    const badge = markup.indexOf('href="#day1"')

    expect(dday).toBeGreaterThan(-1)
    expect(dday).toBeLessThan(badge)
  })

  it('D-day 를 한 카드에 두 번 세우지 않는다', () => {
    const markup = renderOverview()
    const label = messages.plan.dday.replace('{days}', '11')

    expect(markup.split(label)).toHaveLength(2)
  })

  it('지난 일정은 D-day 자리가 비고 판정만 선다 — D+3 을 지어내지 않는다', () => {
    const markup = renderOverview({
      plan: { ...planDetail, startDate: '2026-08-20', endDate: '2026-08-22' },
    })

    expect(markup).not.toContain('D-')
    expect(markup).toContain('href="#day1"')
  })

  /*
    여행은 최대 30일이다 (`PLAN_PERIOD_MAX_DAYS`) — 전부 세우면 요약이 아니라 목록이 되고,
    390 에서 개요 카드가 일자 카드보다 길어진다.
  */
  it('상한을 넘는 일자는 개수로 말한다 — 없는 척하지 않는다', () => {
    const markup = renderOverview({ verdicts: verdictsOf(PLAN_VERDICT_STRIP_MAX_DAYS + 3) })

    expect(markup).toContain(`href="#day${PLAN_VERDICT_STRIP_MAX_DAYS}"`)
    expect(markup).not.toContain(`href="#day${PLAN_VERDICT_STRIP_MAX_DAYS + 1}"`)
    expect(markup).toContain(messages.plan.verdictStripMore.replace('{count}', '3'))
  })

  it('상한 안이면 남은 일자를 말하지 않는다', () => {
    const markup = renderOverview({ verdicts: verdictsOf(PLAN_VERDICT_STRIP_MAX_DAYS) })

    expect(markup).not.toContain('외 ')
  })

  /*
    세로로 돌아와도 줄당 44px 은 그대로다 (D6) — 목차 줄이 처음부터 갖고 있던 값이다.
    **개수를 센다** — `toContain` 은 어느 한 줄에만 있어도 통과해서 "각 줄" 을 증명하지 못한다.
  */
  it('표시되는 모든 줄이 44px 터치 영역을 갖는다', () => {
    const markup = renderOverview({ verdicts: verdictsOf(3) })

    expect(markup.split('min-h-11')).toHaveLength(3 + 1)
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

describe('3층 표면 (#447)', () => {
  const SURFACE = /<section[^>]*class="bg-bg border-border border-y md:rounded-lg md:border[^"]*"/g

  it('일자 섹션은 카드 하나다 — 밴드·페이지 인셋이 없고 항목은 카드 안 목록이다', () => {
    const markup = renderDaySection()

    expect(markup.match(SURFACE)).toHaveLength(1)
    expect(markup).not.toContain('bg-band h-2')
    expect(markup).not.toContain('md:px-10')
    expect(markup).toContain('[&amp;&gt;li+li]:border-t')
    expect(markup).toContain('md:px-5')
  })

  it('빈 일자도 카드 안에서 위 선 아래 안내만 낸다', () => {
    const markup = renderDaySection({ rows: [] })

    expect(markup.match(SURFACE)).toHaveLength(1)
    expect(markup).toContain(messages.plan.dayEmpty)
    expect(markup).not.toContain('[&amp;&gt;li+li]')
  })

  /*
    **개요도 카드다** (#553). #447 은 "페이지 머리라 카드가 아니다" 로 두었는데, 이 줄은
    제목만이 아니라 상태 · 기간 · 예산 · D-day · 동행 반려견을 담은 개요라 §0 의 판정 3문에
    셋 다 걸린다. 근거는 `plan-overview-panel.tsx` 머리주석이 정본이다.
  */
  it('개요가 카드 하나다 — 판정 목차는 그 안의 구획이라 별도 카드가 아니다 (#732 · #841)', () => {
    const markup = renderOverview()
    const h1 = markup.indexOf('<h1')

    expect(h1).toBeGreaterThan(-1)
    expect(markup.match(SURFACE)).toHaveLength(1)
    // 개요 카드가 `h1` 을 감싼다 — 카드가 먼저 열려야 한다
    expect(markup.search(SURFACE)).toBeLessThan(h1)
  })

  /* 예전에는 `hidden lg:block` 카드라 모바일에서 전체 판정을 볼 방법이 없었다 (#732) */
  it('판정 목차는 폭으로 숨지 않는다 — 모바일이 1순위다', () => {
    const markup = renderOverview()

    expect(markup).toContain(messages.plan.verdictTocTitle)
    expect(markup).not.toContain('hidden lg:block')
  })

  it('판정이 없으면 목차 부분을 만들지 않는다 — 빈 nav 를 세우지 않는다', () => {
    const markup = renderOverview({ verdicts: [] })

    expect(markup.match(SURFACE)).toHaveLength(1)
    expect(markup).not.toContain(messages.plan.verdictTocTitle)
  })

  /* 구획 1 안쪽이라 선이 없다 — 경계는 아래 구획선(구획 2 의 `border-t`)이 갖는다 (#841) */
  it('동행 반려견 줄은 구획 1 안이라 선을 긋지 않는다', () => {
    const markup = renderOverview()
    const start = markup.indexOf('푸들')
    const around = markup.slice(Math.max(0, start - 400), start)

    expect(around).not.toContain('border-t')
  })
})

/*
  ── 출발 전 여행 브리핑 진입점 (#626 · 일정상세-세부명세 D16-4) ────────────────

  **`PlanDetailSection` 을 직접 렌더하지 않는다.** 그 컴포넌트는 편집·방문·상태 훅
  (React Query mutation)을 들고 있어 provider 없이 렌더되지 않는다 — 명세가 "표현 전용"
  이라 적은 것은 사실과 다르다. 배너는 **표현 전용 조각**으로 떼어 두었고
  (`plan-briefing-banner.tsx`) 그것을 렌더한다.
*/
function renderBriefingBanner(today: string) {
  return renderToStaticMarkup(
    createElement(PlanBriefingBanner, {
      planId: planDetail.planId,
      startDate: planDetail.startDate, // 2026-09-12
      endDate: planDetail.endDate, // 2026-09-14
      today,
    }),
  )
}

describe('PlanBriefingBanner — 날짜 축 하나로만 노출을 가른다 (D16-2)', () => {
  it('출발 하루 전이면 "내일 출발" 로 브리핑을 연다', () => {
    const markup = renderBriefingBanner('2026-09-11')

    expect(markup).toContain('내일 출발')
    expect(markup).toContain(`/plans/${planDetail.planId}/briefing`)
  })

  it('여행 중이면 "오늘의 브리핑" 이다', () => {
    const markup = renderBriefingBanner('2026-09-13')

    expect(markup).toContain(messages.plan.briefingBannerTodayTitle)
    expect(markup).toContain('/briefing')
  })

  /*
    **설명도 같은 축으로 갈린다** (#733). 전날 브리핑에는 특보도 골든타임도 없는데
    (서버가 당일에만 채운다) 넷을 약속하면 약속과 화면이 어긋난다.
  */
  it('전날에는 넷을 약속하지 않는다', () => {
    const eve = renderBriefingBanner('2026-09-11')
    const today = renderBriefingBanner('2026-09-13')

    expect(eve).toContain(messages.plan.briefingBannerEveDescription)
    expect(eve).not.toContain('특보')
    expect(today).toContain(messages.plan.briefingBannerTodayDescription)
  })

  it('출발 이틀 전이면 배너를 렌더하지 않는다 — 눌러도 부를 날짜가 없다', () => {
    expect(renderBriefingBanner('2026-09-10')).not.toContain('/briefing')
  })

  it('종료 다음 날이면 배너를 렌더하지 않는다', () => {
    expect(renderBriefingBanner('2026-09-15')).not.toContain('/briefing')
  })

  /** **URL 에 `?date=` 를 두지 않는다** (브리핑 명세 D8-2) — 열 때마다 화면이 고른다 */
  it('링크에 날짜 쿼리를 붙이지 않는다', () => {
    expect(renderBriefingBanner('2026-09-13')).not.toContain('date=')
  })

  /*
    **강조가 시간에 묶여 있다** (#732 · DESIGN.md §0-3). 서 있는 동안이 곧 강조할 동안이라
    별도 판정 축이 없다 — 병원·약국 배너는 상시라 중립을 지킨다.
  */
  it('날짜가 맞는 동안은 brand 테두리 + tint 로 선다', () => {
    for (const today of ['2026-09-11', '2026-09-13']) {
      const markup = renderBriefingBanner(today)

      expect(markup).toContain('border-brand-500')
      expect(markup).toContain('bg-row-selected')
    }
  })

  it('강조에 그림자를 쓰지 않는다 — 카드는 눕지 뜨지 않는다 (§6)', () => {
    expect(renderBriefingBanner('2026-09-11')).not.toContain('shadow')
  })
})
