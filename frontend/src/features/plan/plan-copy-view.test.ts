import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanCopyView, type PlanCopyViewProps } from '@/features/plan/plan-copy-view'
import { messages } from '@/lib/messages'

function render(overrides: Partial<PlanCopyViewProps> = {}) {
  return renderToStaticMarkup(
    createElement(PlanCopyView, {
      open: true,
      onClose: () => undefined,
      today: '2027-09-01',
      totalDays: 3,
      startDate: '',
      endDate: '',
      onStartDateChange: () => undefined,
      onEndDateChange: () => undefined,
      endDateOpen: false,
      onEndDateOpenChange: () => undefined,
      fieldErrors: {},
      formError: null,
      saving: false,
      onSubmit: () => undefined,
      ...overrides,
    }),
  )
}

/**
 * `PlanCopyModal` 은 `useRouter`·`useQueryClient` 를 써서 정적 렌더가 안 된다 — props 만
 * 받는 이 부분(`plan-copy-view.tsx`)이 렌더 분기의 검증 대상이다 (D7).
 */
describe('PlanCopyView — 기본', () => {
  it('{days} 가 치환된 기간 힌트가 나온다', () => {
    const markup = render({ totalDays: 3 })

    expect(markup).toContain('원본과 같은 3일로 복사돼요.')
  })

  it('제목 입력이 없다 — 서버 기본값을 쓴다 (D0-1)', () => {
    const markup = render()

    expect(markup).not.toContain('plan-copy-title')
    expect(markup).toContain(messages.plan.copyTitleHint)
  })

  it('승계 힌트가 나온다', () => {
    expect(render()).toContain(messages.plan.copyCarryHint)
  })

  it('오류가 없으면 배너와 링크가 없다', () => {
    const markup = render()

    expect(markup).not.toContain('role="alert"')
    expect(markup).not.toContain('href="/pets"')
    expect(markup).not.toContain('href="/plans"')
  })
})

describe('PlanCopyView — 404 (PLAN_001, 원본 사라짐)', () => {
  const formError = {
    message: '존재하지 않는 여행 일정입니다.',
    retriable: false,
    next: 'list' as const,
  }

  it('서버 문구가 그대로 나오고 다시 시도 가 마크업에 없다', () => {
    const markup = render({ formError })

    expect(markup).toContain('존재하지 않는 여행 일정입니다.')
    expect(markup).not.toContain(messages.common.retry)
  })

  it('목록으로 링크(href="/plans")가 있다', () => {
    const markup = render({ formError })

    expect(markup).toContain('href="/plans"')
    expect(markup).toContain(messages.plan.copyMissingPlanAction)
  })

  it('제출 버튼이 비활성이다', () => {
    const markup = render({ formError })

    // 비활성 버튼은 disabled 속성을 낸다 (component-guide.md, Button 구현)
    expect(markup).toContain('disabled=""')
  })
})

describe('PlanCopyView — 5xx / 일시 장애', () => {
  const formError = { message: messages.plan.copyError, retriable: true, next: 'none' as const }

  it('copyError 가 나오고 제출 버튼은 살아 있다 — 같은 버튼으로 다시 제출한다', () => {
    const markup = render({ formError })

    expect(markup).toContain(messages.plan.copyError)
    expect(markup).not.toContain('disabled=""')
  })

  it('링크가 없다', () => {
    const markup = render({ formError })

    expect(markup).not.toContain('href="/pets"')
    expect(markup).not.toContain('href="/plans"')
  })
})

describe('PlanCopyView — PLAN_010 (반려견 없음)', () => {
  const formError = {
    message: '동행할 반려견을 지정하거나 대표 반려견을 등록해 주세요.',
    retriable: false,
    next: 'pets' as const,
  }

  it('서버 문구 + 반려견 관리로 가기 링크(href="/pets")', () => {
    const markup = render({ formError })

    expect(markup).toContain('동행할 반려견을 지정하거나 대표 반려견을 등록해 주세요.')
    expect(markup).toContain('href="/pets"')
    expect(markup).toContain(messages.plan.copyPetAction)
  })

  it('제출 버튼은 살아 있다 — 반려견을 등록한 뒤 같은 모달에서 다시 시도할 수 있다', () => {
    expect(render({ formError })).not.toContain('disabled=""')
  })
})

describe('PlanCopyView — PLAN_021 (일수 불일치)', () => {
  /*
    **회귀 방지.** 화면이 일수를 세어 문장을 짓지 않는다 — 서버 `resultMessage` 를
    그대로 배너에 낸다. `not.toContain('일수가 원본과')` 같은 단언은 서버 문구와 겹쳐
    쓰지 않는다(D7) — 대신 주어진 문구가 **그대로** 나오는지로 본다.
  */
  it('서버 문구가 그대로 나온다', () => {
    const markup = render({
      formError: {
        message: '복사할 여행 기간의 일수는 원본과 같아야 합니다.',
        retriable: false,
        next: 'none',
      },
    })

    expect(markup).toContain('복사할 여행 기간의 일수는 원본과 같아야 합니다.')
  })
})

describe('PlanCopyView — 필드 오류', () => {
  it('시작일·종료일 오류를 각 필드에 붙인다', () => {
    const markup = render({
      fieldErrors: {
        startDate: messages.plan.errorStartDateRequired,
        endDate: messages.plan.errorDateRange,
      },
    })

    expect(markup).toContain(messages.plan.errorStartDateRequired)
    expect(markup).toContain(messages.plan.errorDateRange)
  })
})

describe('PlanCopyView — 제출 중', () => {
  it('제출 버튼이 aria-busy 다', () => {
    expect(render({ saving: true })).toContain('aria-busy="true"')
  })
})
