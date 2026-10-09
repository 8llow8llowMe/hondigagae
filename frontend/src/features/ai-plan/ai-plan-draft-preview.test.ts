import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  AiPlanDraftPreview,
  type AiPlanDraftPreviewProps,
} from '@/features/ai-plan/ai-plan-draft-preview'
import type { LatLng } from '@/lib/geo/coord'
import { messages } from '@/lib/messages'
import { aiPlanItem, aiPlanItemWithNulls } from '@/test/fixtures/ai-plan'
import type { AiPlanDraft, AiPlanScheduleItem } from '@/types/ai-plan'

function item(overrides: Partial<AiPlanScheduleItem> = {}): AiPlanScheduleItem {
  return aiPlanItem({ title: '협재해수욕장', ...overrides })
}

const DRAFT: AiPlanDraft = {
  days: [
    { day: 1, items: [item(), item({ placeId: '2', title: '제주현대미술관', note: '' })] },
    { day: 2, items: [item({ placeId: '3', title: '아라리오뮤지엄' })] },
  ],
  reasons: [
    { code: 'HEAT', name: '더위 회피', description: '오전은 야외, 오후는 실내로 묶었어요.' },
  ],
}

const EMPTY_SET: ReadonlySet<string> = new Set()

/** 협재해수욕장 · 그 근처 · 성산일출봉(동서 횡단이라 30km 초과) */
const WEST: LatLng = { lat: 33.3938, lng: 126.2396 }
const NEAR_WEST: LatLng = { lat: 33.3901, lng: 126.2402 }
const EAST: LatLng = { lat: 33.4581, lng: 126.9425 }

const EMPTY_COORDS: ReadonlyMap<string, LatLng> = new Map()

function render(overrides: Partial<AiPlanDraftPreviewProps> = {}) {
  const props: AiPlanDraftPreviewProps = {
    draft: DRAFT,
    title: '몽실이와 제주 2박 3일',
    startDate: '2026-09-12',
    endDate: '2026-09-14',
    budget: 300_000,
    totalDays: 3,
    metaLines: new Map([['212481712381923328', '제주시 한림읍 · 야외']]),
    // 좌표는 기본으로 비운다 — 거리 문구는 전용 describe 에서만 켠다
    coords: EMPTY_COORDS,
    // 썸네일도 기본으로 비운다(보강 중) — 썸네일 문구는 전용 describe 에서만 켠다
    thumbnails: new Map(),
    delistedPlaceIds: EMPTY_SET,
    excludedPlaceIds: EMPTY_SET,
    committed: false,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(AiPlanDraftPreview, props))
}

describe('AiPlanDraftPreview — 요약 (아트보드 03)', () => {
  it('제목과 AI 초안 배지를 낸다', () => {
    const html = render()

    expect(html).toContain('몽실이와 제주 2박 3일')
    expect(html).toContain(messages.aiPlan.draftBadge)
  })

  it('기간 · 항목 수 · 예산을 요약한다', () => {
    const html = render()

    expect(html).toContain('2026년 9월 12일 (토)')
    expect(html).toContain('항목 3개')
    expect(html).toContain('30만원')
  })

  it('예산을 정하지 않으면 예산 줄을 붙이지 않는다', () => {
    expect(render({ budget: null })).not.toContain('예산')
  })

  it('조건을 잃어 기간을 모르면 빈 구분자를 남기지 않는다 (375 실렌더에서 잡았다)', () => {
    const html = render({ startDate: '', endDate: '', budget: null })

    expect(html).toContain('제주 · 항목 3개')
    expect(html).not.toContain('> · 제주')
  })

  it('저장 전임을 반복해 말한다 — 담기가 곧 저장이다', () => {
    expect(render()).toContain(messages.aiPlan.previewNotSaved)
  })

  /** 담은 뒤 돌아온 화면이 "아직 저장되지 않았어요" 라고 하면 사용자는 다시 담는다 (#1041) */
  it('이미 담은 초안이면 저장 전이라고 말하지 않는다', () => {
    const html = render({ committed: true })

    expect(html).toContain(messages.aiPlan.previewCommitted)
    expect(html).not.toContain(messages.aiPlan.previewNotSaved)
  })
})

describe('AiPlanDraftPreview — reasons 는 상단에 한 번 (명세 S6)', () => {
  it('초안 전체의 근거를 상단에 낸다', () => {
    expect(render()).toContain('오전은 야외, 오후는 실내로 묶었어요.')
  })

  it('근거가 없으면 절 자체를 렌더하지 않는다', () => {
    const html = render({ draft: { ...DRAFT, reasons: [] } })
    expect(html).not.toContain(messages.aiPlan.reasonsTitle)
  })
})

describe('AiPlanDraftPreview — 일자와 항목', () => {
  it('일자별로 나누고 항목마다 번호를 붙인다', () => {
    const html = render()

    expect(html).toContain('1일차')
    expect(html).toContain('2일차')
    expect(html).toContain('아라리오뮤지엄')
  })

  it('보강으로 얻은 메타 줄(주소 · 실내)을 붙인다 — 초안에는 없는 값이다', () => {
    expect(render()).toContain('제주시 한림읍 · 야외')
  })

  it('보강이 아직 없는 항목은 메타 줄 없이 그린다 — 항목을 감추지 않는다', () => {
    const html = render({ metaLines: new Map() })

    expect(html).toContain('협재해수욕장')
    expect(html).not.toContain('제주시 한림읍')
  })

  it('항목별 note 를 그대로 쓴다', () => {
    expect(render()).toContain('오전이라 노면이 덜 뜨거워요.')
  })

  it('아트보드 행 서식이 채워졌다 — `주소 · 실내여부` + 거리 (#112 · #100)', () => {
    // 아트보드 03 의 행 서식은 `제주시 한림읍 · 야외 · 4.1km` 다. 실내는 #112,
    // 거리는 #100 에서 붙였다. 거리는 별도 줄이라 여기서는 메타 줄만 본다
    expect(render()).toContain('제주시 한림읍 · 야외')
  })

  it('메타 줄 조립은 이 컴포넌트가 하지 않는다 — 받은 문자열을 그대로 쓴다', () => {
    // `indoor` 의 null 판정은 use-draft-places.ts 가 갖는다. 행이 다시 조립하면
    // 두 곳이 갈린다 — 주소만 온 메타 줄에 낱말을 덧붙이지 않는 것으로 확인한다
    const html = render({ metaLines: new Map([['212481712381923328', '제주시 한림읍']]) })

    expect(html).toContain('제주시 한림읍')
    expect(html).not.toContain('제주시 한림읍 ·')
  })
})

describe('AiPlanDraftPreview — 직선거리 (이슈 #100)', () => {
  /** 1일차 두 항목의 좌표를 아는 상태 */
  function withCoords(
    entries: [string, LatLng][] = [
      ['212481712381923328', WEST],
      ['2', NEAR_WEST],
    ],
  ) {
    return render({ coords: new Map(entries) })
  }

  it('직전 항목으로부터의 거리를 낸다', () => {
    // 약 420m — 1km 미만이라 m 로 표기된다
    expect(withCoords()).toMatch(/직선 \d+m 이동/)
  })

  it('"직선" 이라고 말한다 — 주행거리로 읽히면 안 된다 (일정 상세와 같은 문구)', () => {
    const html = withCoords()

    expect(html).toContain('직선')
    expect(html).toContain('이동')
    // 기준 문구가 갈리지 않는다 — 초안은 숙소 기준을 쓰지 않는다 (draft-distance.ts)
    expect(html).not.toContain(messages.plan.distanceFromLodging.replace('{distance}', ''))
  })

  it('일자의 첫 항목에는 붙이지 않는다 — 기준이 없다', () => {
    // 2일차는 항목이 하나뿐이라 거리 줄이 하나도 없어야 한다
    const html = render({
      draft: { ...DRAFT, days: [DRAFT.days[1] as AiPlanDraft['days'][number]] },
      coords: new Map([['3', WEST]]),
      totalDays: null,
    })

    expect(html).not.toContain('직선')
  })

  it('좌표를 모르면 거리 줄이 사라진다 — 보강 실패로 항목을 감추지는 않는다', () => {
    const html = render({ coords: EMPTY_COORDS })

    expect(html).not.toContain('직선')
    expect(html).toContain('협재해수욕장')
  })

  it('30km 를 넘으면 경고 톤과 문장이 함께 간다 — 색만으로 전달하지 않는다', () => {
    const html = withCoords([
      ['212481712381923328', WEST],
      ['2', EAST],
    ])

    expect(html).toContain(messages.plan.longTripSuffix.trim())
    expect(html).toContain('text-metric-low-700')
  })

  it('30km 미만에는 경고를 붙이지 않는다', () => {
    const html = withCoords()

    expect(html).not.toContain(messages.plan.longTripSuffix.trim())
    expect(html).not.toContain('text-metric-low-700')
  })
})

describe('AiPlanDraftPreview — 아트보드에서 뺀 것 (명세 S2)', () => {
  it('일자별 적합도 배지를 만들지 않는다 — 담기 전에는 planId 가 없다', () => {
    const html = render()

    expect(html).not.toContain('주의')
    expect(html).not.toContain('양호')
  })

  it('이 날 다시 만들기 · 이 날 산책 · 말로 고치기를 두지 않는다', () => {
    const html = render()

    expect(html).not.toContain('이 날 다시 만들기')
    expect(html).not.toContain('이 날 산책')
    expect(html).not.toContain('말로 고치기')
  })
})

describe('AiPlanDraftPreview — days 가 부족한 완료 (명세 S6)', () => {
  it('감추지 않고 몇 일만 만들었는지 말한다', () => {
    const html = render()

    expect(html).toContain('3일 중 2일만 만들었어요.')
    expect(html).toContain(messages.aiPlan.partialDaysDescription)
  })

  it('일수가 맞으면 안내를 내지 않는다', () => {
    const html = render({ totalDays: 2 })
    expect(html).not.toContain('만들었어요.')
  })

  it('일수를 세지 못하면 단정하지 않는다', () => {
    const html = render({ totalDays: null })
    expect(html).not.toContain('만들었어요.')
  })
})

/**
 * 빈 날 (#1270 · 백엔드 #1268). **만든 날은 방문 항목(장소 · 식사)이 있는 날이다** —
 * `days.length` 가 아니다. 서버는 전부 빈 초안만 `AIPLAN_022` 로 실패시키고 일부만 빈
 * 초안은 `COMPLETED` 로 내린다.
 */
describe('AiPlanDraftPreview — 빈 날 (#1270)', () => {
  const LODGING = item({ itemType: 'LODGING', placeId: '9', title: '협재 펫 스테이' })

  /** 일자 카드 하나 — 그 `h2` 를 가진 `<section>` 여는 태그부터 닫는 태그까지 */
  function dayCard(html: string, day: number): string {
    const sections = html.split('<section ').slice(1)
    const card = sections.find((section) => section.includes(`>${day}일차</h2>`))
    if (card === undefined) throw new Error(`${day}일차 카드가 없다`)
    return card.slice(0, card.indexOf('</section>'))
  }

  /** dev job `e0f1fd25…` — 세 날 모두 `items: []` 였다. 예전에는 제목뿐인 카드 셋이 섰다 */
  it('모든 날이 비면 빈 상태로 간다 — 일자 카드를 세우지 않는다', () => {
    const html = render({
      draft: {
        days: [
          { day: 1, items: [] },
          { day: 2, items: [] },
          { day: 3, items: [] },
        ],
        reasons: [],
      },
    })

    expect(html).toContain(messages.aiPlan.emptyDraftTitle)
    expect(html).not.toContain('1일차')
    expect(html).not.toContain(messages.aiPlan.emptyDayTitle)
  })

  it('숙소만 있는 초안도 빈 상태다 — 숙소는 일정이 아니다', () => {
    const html = render({
      draft: { days: [{ day: 1, items: [LODGING] }], reasons: [] },
      totalDays: 1,
    })

    expect(html).toContain(messages.aiPlan.emptyDraftTitle)
    expect(html).not.toContain('협재 펫 스테이')
  })

  it('일부만 비면 만든 날을 방문 항목으로 센다', () => {
    const html = render({
      draft: {
        days: [
          { day: 1, items: [item()] },
          { day: 2, items: [] },
          { day: 3, items: [LODGING] },
        ],
        reasons: [],
      },
      totalDays: 3,
    })

    // `days.length` 로 셌다면 3일 중 3일이라 배너가 서지 않았다
    expect(html).toContain('3일 중 1일만 만들었어요.')
  })

  it('빈 날 카드는 제목만 남기지 않고 채우지 못했다고 말한다', () => {
    const html = render({
      draft: {
        days: [
          { day: 1, items: [item()] },
          { day: 2, items: [] },
        ],
        reasons: [],
      },
      totalDays: 2,
    })
    const empty = dayCard(html, 2)

    expect(empty).toContain(messages.aiPlan.emptyDayTitle)
    expect(empty).toContain(messages.aiPlan.emptyDayDescription)
    // 항목이 없으면 빈 목록(`<ul>`)을 그리지 않는다 — 선만 두 겹이 된다
    expect(empty).not.toContain('<ul')
  })

  it('채운 날 카드에는 안내를 달지 않는다', () => {
    const html = render({
      draft: {
        days: [
          { day: 1, items: [item()] },
          { day: 2, items: [] },
        ],
        reasons: [],
      },
      totalDays: 2,
    })

    expect(dayCard(html, 1)).not.toContain(messages.aiPlan.emptyDayTitle)
  })

  /** 숙소 행은 담기가 그대로 싣는다 — 감추면 화면과 저장이 어긋난다 */
  it('숙소만 있는 날은 안내를 달고 숙소 행은 남긴다', () => {
    const html = render({
      draft: {
        days: [
          { day: 1, items: [item()] },
          { day: 2, items: [LODGING] },
        ],
        reasons: [],
      },
      totalDays: 2,
    })
    const lodgingDay = dayCard(html, 2)

    expect(lodgingDay).toContain(messages.aiPlan.emptyDayTitle)
    expect(lodgingDay).toContain('협재 펫 스테이')
  })

  /** 기간을 모르면 "N일 중" 을 단정하지 않는다 — 빈 날 카드는 그래도 말한다 */
  it('기간을 모르면 배너 없이 빈 날 카드만 말한다', () => {
    const html = render({
      draft: {
        days: [
          { day: 1, items: [item()] },
          { day: 2, items: [] },
        ],
        reasons: [],
      },
      totalDays: null,
    })

    expect(html).not.toContain('만들었어요.')
    expect(dayCard(html, 2)).toContain(messages.aiPlan.emptyDayTitle)
  })
})

describe('AiPlanDraftPreview — 방문 전 확인 안내 (#1270)', () => {
  /** 개요 카드 — 첫 `<section>` 이다 */
  function overview(html: string): string {
    const start = html.indexOf('<section ')
    return html.slice(start, html.indexOf('</section>', start))
  }

  it('개요 카드에 운영 시간 · 동반 조건 확인을 한 줄 단다', () => {
    expect(overview(render())).toContain(messages.aiPlan.previewVerifyNotice)
  })

  it('담은 초안에도 단다 — 담았다고 확인할 일이 사라지지 않는다', () => {
    expect(overview(render({ committed: true }))).toContain(messages.aiPlan.previewVerifyNotice)
  })

  it('일자 카드마다 반복하지 않는다 — 한 번이다', () => {
    expect(render().split(messages.aiPlan.previewVerifyNotice)).toHaveLength(2)
  })
})

describe('AiPlanDraftPreview — delisting 과 빼기', () => {
  it('보강이 404 를 낸 항목을 지목한다 — PLAN_004 의 원인 후보다', () => {
    const html = render({ delistedPlaceIds: new Set(['212481712381923328']) })
    expect(html).toContain(messages.aiPlan.itemPlaceDelisted)
  })

  it('빼기로 표시한 항목은 지우지 않고 취소선으로 남긴다', () => {
    const html = render({ excludedPlaceIds: new Set(['212481712381923328']) })

    expect(html).toContain('line-through')
    expect(html).toContain('협재해수욕장')
  })
})

/*
  **사진 → 유형 일러스트 → 회색 타일** — 일정 상세와 같은 순서다 (#1127 · #842).
  dev 실측으로 사진 없는 장소가 70% 라 일러스트가 예외가 아니라 기본이다.
*/
describe('AiPlanDraftPreview — 썸네일 (#1127)', () => {
  const PLACE_ID = '212481712381923328'
  const PHOTO = 'https://tong.visitkorea.or.kr/cms/resource/01/1_image3_1.jpg'

  function renderOne(
    overrides: Partial<AiPlanScheduleItem>,
    thumbnails: ReadonlyMap<string, string | null>,
  ) {
    /*
      **둘째 날에 방문 항목을 둔다** (#1270). 숙소 · 모르는 유형 하나뿐인 초안은 만든 날이
      0 이라 빈 상태로 가고, 그러면 "일러스트가 없다" 류 단언이 행 없이 통과한다. 둘째 날
      항목은 보강 중(키 없음)이라 회색 타일 — 사진도 일러스트도 내지 않는다.
    */
    return render({
      draft: {
        days: [
          { day: 1, items: [item(overrides)] },
          { day: 2, items: [item({ placeId: 'filler', title: '채움' })] },
        ],
        reasons: [],
      },
      thumbnails,
    })
  }

  it('보강으로 얻은 사진을 그린다', () => {
    const html = renderOne({}, new Map([[PLACE_ID, PHOTO]]))

    // 테스트 환경의 next/image 는 `/_next/image?url=` 로 감싸 내보낸다
    expect(html).toContain(encodeURIComponent(PHOTO))
    expect(html).not.toContain('/illustrations/')
  })

  it('사진이 없는 장소는 항목 유형 일러스트가 선다', () => {
    const html = renderOne({ itemType: 'LODGING' }, new Map([[PLACE_ID, null]]))

    expect(html).toMatch(/<img[^>]*src="\/illustrations\/place-lodging\.webp"[^>]*alt=""/)
  })

  /* 초안의 itemType 은 LLM 산출 raw string 이다 — 유형을 지어내지 않는다 (공통명세 S6) */
  it('모르는 유형은 회색 타일이다', () => {
    const html = renderOne({ itemType: 'SOMETHING_NEW' }, new Map([[PLACE_ID, null]]))

    expect(html).not.toContain('/illustrations/')
    expect(html).not.toContain('tong.visitkorea.or.kr')
  })

  /*
    **보강 중에는 일러스트를 먼저 그리지 않는다.** 사진이 있는 장소에서 일러스트 → 사진으로
    바뀌어 깜박인다. 회색 타일로 기다린다.
  */
  it('보강 중이면 회색 타일로 기다린다', () => {
    const html = renderOne({ itemType: 'PLACE' }, new Map())

    expect(html).not.toContain('/illustrations/')
    expect(html).toContain('협재해수욕장')
  })

  it('placeId 가 없는 항목은 기다리지 않고 바로 유형 일러스트다', () => {
    const html = renderOne({ placeId: null, itemType: 'MEAL' }, new Map())

    expect(html).toContain('/illustrations/place-restaurant.webp')
  })

  /* 순번은 타일 좌상단 흰 원형 칩이다 — 담은 뒤 일정 상세와 같은 모양 (#856) */
  it('순번 칩이 타일 안의 흰 원형이다', () => {
    const html = renderOne({}, new Map([[PLACE_ID, null]]))
    const chip = /<span aria-hidden="true" class="([^"]*)">1<\/span>/.exec(html)?.[1] ?? ''

    expect(chip).toContain('absolute')
    expect(chip).toContain('bg-bg')
    expect(chip).toContain('rounded-full')
    expect(chip).toContain('border-border-strong')
  })
})

describe('AiPlanDraftPreview — 초안이 비었을 때', () => {
  it('빈 초안은 빈 상태로 안내하고 재시도 버튼을 주지 않는다', () => {
    const html = render({ draft: { days: [], reasons: [] } })

    expect(html).toContain(messages.aiPlan.emptyDraftTitle)
    expect(html).not.toContain(messages.common.retry)
  })

  /*
    **빈 초안도 카드 안이다** (#440 · #473). 담기 패널은 카드 밖 L0 이므로, 여기까지
    카드를 빼면 흰 면이 하나도 없는 화면이 된다.
  */
  it('빈 초안도 카드 안에서 성립한다', () => {
    const html = render({ draft: { days: [], reasons: [] } })

    expect(html).toMatch(/^<section [^>]*class="[^"]*rounded-lg/)
  })
})

/**
 * 표면 계약 — 3층 표면 전환 (#473).
 *
 * `renderToStaticMarkup` 결과에 대해 단언한다. 이 컴포넌트는 표시 전용이라 node 환경에서
 * 실제로 렌더되므로, 소스 문자열이 아니라 **나온 마크업**을 본다.
 */
describe('AiPlanDraftPreview — 개요 카드 + 일자마다 카드 (#473)', () => {
  /** L1 카드 = `Surface` 가 내는 `<section>` — radius 12 는 이 층에만 붙는다 */
  function cardCount(html: string): number {
    return (html.match(/<section [^>]*class="[^"]*rounded-lg/g) ?? []).length
  }

  it('개요 하나 + 일자 둘 = 카드 셋이다', () => {
    expect(cardCount(render())).toBe(3)
  })

  it('일자가 늘면 카드도 늘어난다 — 일자마다 하나다', () => {
    const html = render({
      draft: { days: [{ day: 1, items: [item()] }], reasons: [] },
      totalDays: null,
    })

    expect(cardCount(html)).toBe(2)
  })

  /*
    **일자 제목이 `h2` 다.** 카드의 제목이고 개요 카드 제목과 같은 레벨이어야 한다 —
    `h3` 로 남으면 일자 카드에 자기 이름이 없는 셈이 된다.
  */
  it('일자 제목이 h2 다', () => {
    const html = render()

    expect(html).toMatch(/<h2[^>]*>1일차<\/h2>/)
    expect(html).toMatch(/<h2[^>]*>2일차<\/h2>/)
  })

  /* 개요 카드의 이름은 화면에 보이는 제목 그 자체다 — `aria-label` 로 따로 적지 않는다 */
  it('개요 카드가 자기 h2 를 aria-labelledby 로 가리킨다', () => {
    const html = render()

    expect(html).toContain('aria-labelledby="ai-plan-draft-heading"')
    expect(html).toContain('id="ai-plan-draft-heading"')
  })

  /*
    **페이지 인셋 40(`md:px-10`)이 남아 있지 않다.** 카드가 이미 한 번 들어와 있어
    안쪽까지 40 을 주면 내용이 두 번 밀린다 (§0).
  */
  it('카드 안 인셋이 card(16/20)다 — md:px-10 이 없다', () => {
    const html = render()

    expect(html).not.toContain('md:px-10')
    expect(html).toContain('md:px-5')
  })

  /*
    부분 생성 블록의 `--band` 채움은 카드 안 L2 채움이라 남는다 (§0).
    `bg-band` 만 보면 항목 번호 배지(원형)에 걸려 늘 통과한다 — 블록의 서식까지 함께 본다.
  */
  it('부분 생성 블록은 bg-band 채움으로 남는다', () => {
    expect(render()).toContain('bg-band rounded-md px-3 py-2')
    expect(render({ totalDays: 2 })).not.toContain('bg-band rounded-md px-3 py-2')
  })
})

describe('AiPlanDraftPreview — title·note 가 null 로 올 수 있다', () => {
  it('null 이어도 렌더가 죽지 않는다 — 서버 DTO 에 제약이 없다', () => {
    const html = render({
      draft: { days: [{ day: 1, items: [aiPlanItemWithNulls()] }], reasons: [] },
    })

    expect(html).toContain('1일차')
  })

  it('이름이 없는 항목도 행을 지우지 않고 대체 문구로 남긴다', () => {
    const html = render({
      draft: { days: [{ day: 1, items: [aiPlanItemWithNulls()] }], reasons: [] },
    })

    expect(html).toContain(messages.aiPlan.itemTitleUnknown)
  })
})
