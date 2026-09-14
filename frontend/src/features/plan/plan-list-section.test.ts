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

  /*
    #218. 대표(`plan.petId`)만 읽으면 두 마리 일정이 한 마리 일정과 구분되지 않는다.
    목록은 이름을 나열하지 않는다 — 최대 5마리라 행의 폭이 터진다. 수로 말한다.
  */
  it('동행이 두 마리면 수를 드러낸다', () => {
    const html = render({
      plans: [plan({ petIds: ['123456789012000001', '123456789012000002'] })],
      petNames: new Map([
        ['123456789012000001', '몽실이'],
        ['123456789012000002', '초코'],
      ]),
    })
    expect(html).toContain('몽실이 외 1마리')
  })

  it('한 마리 일정은 이름만 그대로 쓴다 — 지금까지의 모양이 바뀌지 않는다', () => {
    const html = render()
    expect(html).toContain('몽실이')
    expect(html).not.toContain('외 0마리')
    expect(html).not.toMatch(/외\s*\d+마리/)
  })

  /*
    그 아이만 조회에 실패하면 `petNames` 에서 빠진다 (`types/plan.ts:122`). 남은 이름으로
    말하고, id 나 "알 수 없음" 을 세우지 않는다.
  */
  it('두 마리 중 하나를 못 찾으면 남은 한 마리로 말한다', () => {
    const html = render({
      plans: [plan({ petIds: ['123456789012000001', '123456789012000002'] })],
      petNames: new Map([['123456789012000001', '몽실이']]),
    })
    expect(html).not.toMatch(/외\s*\d+마리/)
    expect(html).toContain('몽실이')
  })

  it('D-day 는 오늘 기준으로 센다', () => {
    expect(render()).toContain('D-16')
  })

  it('이미 시작한 일정에는 D-day 를 붙이지 않는다 — 대신 여행 중이라고 말한다 (#561)', () => {
    const html = render({
      plans: [plan({ startDate: '2026-08-26', endDate: '2026-08-28' })],
    })
    expect(html).not.toMatch(/D-\d/)
    expect(html).toContain(messages.plan.ongoing)
  })

  it('긴 제목이 잘리지 않게 min-w-0 을 함께 둔다 — break-keep 만으로는 줄지 않는다', () => {
    expect(render()).toContain('min-w-0')
  })
})

describe('3층 표면 (#445) — 카드 안의 L2', () => {
  const past = plan({
    planId: '223456789012000003',
    startDate: '2026-05-02',
    endDate: '2026-05-03',
  })

  it('밴드 · last 규약 · 페이지 인셋을 쓰지 않는다 — 카드가 경계고 구분선은 목록이 긋는다', () => {
    const markup = render({ plans: [plan(), past] })

    expect(markup).not.toContain('bg-band h-2')
    // 행이 스스로 선을 긋지 않는다 — 2a `Row` 의 `border-b` 규약
    expect(markup).not.toContain('border-border border-b')
    expect(markup).not.toContain('md:px-10')
    expect(markup).toContain('[&amp;&gt;li+li]:border-t')
    expect(markup).toContain('md:px-5')
  })

  it('두 묶음은 한 카드 안이다 — 카드(section 표면)를 만들지 않고 뒤 묶음 위에 1px 선만 긋는다', () => {
    const markup = render({ plans: [plan(), past] })

    expect(markup).not.toContain('md:rounded-lg')
    expect(markup.match(/<h3[^>]*>/g)).toHaveLength(2)
    // 지난 일정 묶음에만 위 선이 있다 — 다가오는 일정 위는 카드 제목이다
    const pastStart = markup.indexOf(messages.plan.sectionPast)
    const pastSection = markup.slice(markup.lastIndexOf('<section', pastStart), pastStart)
    expect(pastSection).toContain('border-t')
    const upcomingStart = markup.indexOf(messages.plan.sectionUpcoming)
    const upcomingSection = markup.slice(
      markup.lastIndexOf('<section', upcomingStart),
      upcomingStart,
    )
    expect(upcomingSection).not.toContain('border-t')
  })

  it('지난 일정만 있으면 위 선을 긋지 않는다 — 앞 묶음이 없다', () => {
    const markup = render({ plans: [past] })
    const pastStart = markup.indexOf(messages.plan.sectionPast)
    const pastSection = markup.slice(markup.lastIndexOf('<section', pastStart), pastStart)

    expect(pastSection).not.toContain('border-t')
  })

  it('로딩 스켈레톤도 같은 목록 규약이다', () => {
    const markup = render({ loading: true })

    expect(markup).toContain('[&amp;&gt;li+li]:border-t')
    expect(markup).toContain('md:px-5')
    expect(markup).not.toContain('md:px-10')
  })
})

/**
 * #561 — dev 에서 `2026-09-11 ~ 09-14` 일정을 09-14 에 보니 "다가오는 일정" 에 D-day 도
 * 없이 서 있었다. 배지 자리가 빈 채라 바로 아래 `D-11` 과 나란히 놓여 더 눈에 띄었다.
 *
 * **두 가지를 함께 잠근다** — 묶음이 어디로 가는지와, 기둥에 무슨 말이 서는지.
 */
describe('여행 중 — 다가오는 일정과 지난 일정 사이의 셋째 칸', () => {
  const ongoing = plan({
    planId: '223456789012000009',
    title: '갱얼쥐랑 3박 4일 가즈아',
    startDate: '2026-08-24',
    endDate: '2026-08-27',
  })

  const pastPlan = plan({
    planId: '223456789012000003',
    startDate: '2026-05-02',
    endDate: '2026-05-03',
  })

  function countOf(markup: string, text: string): number {
    return markup.split(text).length - 1
  }

  it('오늘이 여행 기간 안이면 "다가오는 일정" 이 아니라 "여행 중" 아래 선다', () => {
    const markup = render({ plans: [ongoing] })

    expect(markup).toContain(messages.plan.sectionOngoing)
    expect(markup).not.toContain(messages.plan.sectionUpcoming)
  })

  /*
    묶음 제목과 기둥의 배지가 **같은 문자열**이라 `toContain` 만으로는 배지가 그려졌는지
    알 수 없다 — 제목만 있어도 통과한다. 그래서 개수로 센다: 제목 1 + 배지 1 = 2.
  */
  it('D-day 자리를 비워 두지 않는다 — 기둥에 여행 중이 선다', () => {
    const markup = render({ plans: [ongoing] })

    expect(countOf(markup, messages.plan.ongoing)).toBe(2)
    expect(markup).not.toMatch(/D-\d/)
  })

  it('며칠째인지는 날짜 줄이 말한다 — 마지막 날이면 4일차다', () => {
    expect(render({ plans: [ongoing] })).toContain('오늘 4일차')
  })

  it('여행 중이 맨 위다 — 오늘 일어나는 일이 먼저 온다', () => {
    const markup = render({ plans: [plan(), ongoing, pastPlan] })

    expect(markup.indexOf(messages.plan.sectionOngoing)).toBeLessThan(
      markup.indexOf(messages.plan.sectionUpcoming),
    )
    expect(markup.indexOf(messages.plan.sectionUpcoming)).toBeLessThan(
      markup.indexOf(messages.plan.sectionPast),
    )
  })

  it('여행 중이 앞에 있으면 다가오는 묶음이 위 선을 긋는다', () => {
    const markup = render({ plans: [plan(), ongoing] })
    const upcomingStart = markup.indexOf(messages.plan.sectionUpcoming)
    const upcomingSection = markup.slice(
      markup.lastIndexOf('<section', upcomingStart),
      upcomingStart,
    )

    expect(upcomingSection).toContain('border-t')
  })

  /* 출발 당일은 `D-DAY` 가 더 강하다 — `여행 중` 으로 덮지 않는다 (`planPhaseOf` 머리주석) */
  it('출발 당일은 여행 중이 아니라 D-DAY 다', () => {
    const markup = render({
      plans: [plan({ startDate: '2026-08-27', endDate: '2026-08-29' })],
    })

    expect(markup).toContain(messages.plan.ddayToday)
    expect(markup).not.toContain(messages.plan.sectionOngoing)
  })
})
