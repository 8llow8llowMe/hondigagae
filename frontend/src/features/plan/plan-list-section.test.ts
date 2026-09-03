import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanListSection, type PlanListSectionProps } from '@/features/plan/plan-list-section'
import { messages } from '@/lib/messages'
import type { PlanStatusCode, PlanSummaryItem } from '@/types/plan'

const STATUS_NAMES: Record<PlanStatusCode, string> = {
  DRAFT: '초안',
  CONFIRMED: '확정',
  COMPLETED: '완료',
}

function plan(overrides: Partial<PlanSummaryItem> = {}): PlanSummaryItem {
  const code = (overrides.status?.code ?? 'DRAFT') as PlanStatusCode
  return {
    planId: '223456789012000001',
    petId: '123456789012000001',
    petIds: ['123456789012000001'],
    areaCode: '39',
    title: '몽실이와 제주 2박 3일',
    startDate: '2026-09-12',
    endDate: '2026-09-14',
    status: { code, name: STATUS_NAMES[code] ?? code, description: null },
    ...overrides,
  }
}

const TODAY = new Date(2026, 7, 27)

function render(overrides: Partial<PlanListSectionProps> = {}) {
  const props: PlanListSectionProps = {
    plans: [plan()],
    totalCount: 1,
    petNames: new Map([['123456789012000001', '몽실이']]),
    today: TODAY,
    loading: false,
    errorStatus: null,
    hasNext: false,
    loadingMore: false,
    filtered: false,
    hasPets: true,
    firstPetName: '몽실이',
    onLoadMore: () => undefined,
    onRetry: () => undefined,
    onResetFilters: () => undefined,
    ...overrides,
  }
  return renderToStaticMarkup(createElement(PlanListSection, props))
}

describe('일정 목록 — 아트보드에 있으나 계약이 주지 않는 것', () => {
  it('항목 수·총 이동 거리를 쓰지 않는다 — PlanSummaryItem 에 없는 필드다', () => {
    const html = render()
    expect(html).not.toMatch(/항목\s*\d+개/)
    expect(html).not.toContain('총 이동')
  })

  it('지역명을 지어내지 않는다 — 목록은 areaCode 만 준다', () => {
    expect(render()).not.toContain('제주시')
  })

  it('후기 진입점을 만들지 않는다 — plan-service 에 review 가 없다', () => {
    const html = render({
      plans: [
        plan({
          startDate: '2026-05-02',
          endDate: '2026-05-04',
          status: { code: 'COMPLETED', name: '완료', description: null },
        }),
      ],
    })
    expect(html).not.toContain('후기')
  })

  it('AI 진입점을 만들지 않는다 — 그 화면이 아직 없다', () => {
    expect(render({ plans: [] })).not.toContain('AI')
  })
})

describe('일정 목록 — 상태와 날짜는 다른 축이다', () => {
  it('확정 배지를 단 채로 지난 일정에 들어간다', () => {
    const html = render({
      plans: [
        plan({
          startDate: '2026-04-11',
          endDate: '2026-04-11',
          status: { code: 'CONFIRMED', name: '확정', description: null },
        }),
      ],
    })

    expect(html).toContain(messages.plan.sectionPast)
    expect(html).not.toContain(messages.plan.sectionUpcoming)
    expect(html).toContain('확정')
  })

  it('서버가 준 상태 이름을 그대로 쓴다 — 매핑 테이블을 만들지 않는다', () => {
    const html = render({
      plans: [plan({ status: { code: 'ARCHIVED', name: '보관함', description: null } })],
    })
    expect(html).toContain('보관함')
  })
})

describe('일정 목록 — 상태 화면', () => {
  it('loading 은 썸네일 자리를 만들지 않는다 — 일정 행에는 이미지가 없다', () => {
    const html = render({ loading: true })
    expect(html).toContain('animate-pulse')
    expect(html).not.toContain('aspect-square')
  })

  it('일정이 없으면 반려견 이름을 넣어 만들기로 안내한다', () => {
    const html = render({ plans: [], firstPetName: '몽실이' })
    expect(html).toContain('몽실이')
    expect(html).toContain('/plans/new')
  })

  it('반려견이 0마리면 만들기가 아니라 등록으로 보낸다 — petId 가 필수다', () => {
    const html = render({ plans: [], hasPets: false, firstPetName: null })
    expect(html).toContain('/pets/new')
    expect(html).not.toContain('/plans/new')
  })

  it('필터 결과가 비면 지웠을 때의 개수를 문장에 넣는다', () => {
    const html = render({ plans: [], filtered: true, totalCount: 4 })
    expect(html).toContain('일정 4개를 볼 수 있어요')
  })

  it('아직 다 받지 않았으면 그 개수를 말하지 않는다', () => {
    const html = render({ plans: [], filtered: true, totalCount: null, hasNext: true })
    expect(html).toContain(messages.plan.filteredEmptyDescriptionUnknown)
    expect(html).not.toMatch(/일정 \d+개를 볼 수 있어요/)
  })

  it('조회 중에는 개수를 단정하지 않는다 — 스켈레톤 옆에 0 을 쓰지 않는다', () => {
    // countable 판정은 PlanListView 가 하고, 섹션은 totalCount=null 을 받는다.
    // 여기서는 그 null 이 화면에 0 으로 새지 않는지만 본다
    const html = render({ loading: true, totalCount: null })
    expect(html).not.toMatch(/일정 \d+개/)
  })

  it('404 가 아닌 일시 장애에만 재시도를 준다', () => {
    const html = render({ errorStatus: 503 })
    expect(html).toContain(messages.common.retry)
  })
})

describe('일정 행', () => {
  it('반려견 조회가 실패해도 행을 숨기지 않는다', () => {
    const html = render({ petNames: new Map() })
    expect(html).toContain('몽실이와 제주 2박 3일')
  })

  it('D-day 는 오늘 기준으로 센다', () => {
    expect(render()).toContain('D-16')
  })

  it('이미 시작한 일정에는 D-day 를 붙이지 않는다', () => {
    const html = render({
      plans: [plan({ startDate: '2026-08-26', endDate: '2026-08-28' })],
    })
    expect(html).not.toMatch(/D-\d/)
  })

  it('긴 제목이 잘리지 않게 min-w-0 을 함께 둔다 — break-keep 만으로는 줄지 않는다', () => {
    expect(render()).toContain('min-w-0')
  })
})
