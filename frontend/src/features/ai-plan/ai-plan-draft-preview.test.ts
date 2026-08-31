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
    addresses: new Map([['212481712381923328', '제주시 한림읍']]),
    // 좌표는 기본으로 비운다 — 거리 문구는 전용 describe 에서만 켠다
    coords: EMPTY_COORDS,
    delistedPlaceIds: EMPTY_SET,
    excludedPlaceIds: EMPTY_SET,
    footer: null,
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

    expect(html).toContain('2026-09-12')
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

  it('보강으로 얻은 주소를 붙인다 — 초안에는 없는 값이다', () => {
    expect(render()).toContain('제주시 한림읍')
  })

  it('보강이 아직 없는 항목은 주소 없이 그린다 — 항목을 감추지 않는다', () => {
    const html = render({ addresses: new Map() })

    expect(html).toContain('협재해수욕장')
    expect(html).not.toContain('제주시 한림읍')
  })

  it('항목별 note 를 그대로 쓴다', () => {
    expect(render()).toContain('오전이라 노면이 덜 뜨거워요.')
  })

  it('실내 여부는 여전히 만들지 않는다 — 상세 응답에 indoor 가 없다 (#16)', () => {
    const html = render()

    // 아트보드 03 의 행 서식은 `제주시 한림읍 · 야외 · 4.1km` 다. 거리는 #100 에서
    // 붙였고 실내 조각만 남아 있다 — "야외" 는 서버가 준 근거 문장에도 들어 있어
    // 낱말만으로는 가릴 수 없어 구분자와 함께 본다
    expect(html).not.toContain('· 야외')
    expect(html).not.toContain('· 실내')
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

describe('AiPlanDraftPreview — 초안이 비었을 때', () => {
  it('빈 초안은 빈 상태로 안내하고 재시도 버튼을 주지 않는다', () => {
    const html = render({ draft: { days: [], reasons: [] } })

    expect(html).toContain(messages.aiPlan.emptyDraftTitle)
    expect(html).not.toContain(messages.common.retry)
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
