import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanReviewPanel, type PlanReviewPanelProps } from '@/features/plan/plan-review-panel'
import { messages } from '@/lib/messages'
import type { PlanReviewResponse } from '@/types/plan'

const REVIEW: PlanReviewResponse = {
  reviewId: '523456789012000001',
  planId: '223456789012000003',
  overallRating: 4,
  body: '둘째 날이 더웠다.',
  items: [
    {
      reviewItemId: '623456789012000001',
      planItemId: '323456789012000020',
      placeId: '212481712381923328',
      title: '김창열미술관',
      rating: 5,
      comment: '그늘이 많았다.',
    },
  ],
  createdAt: '2026-09-15T11:20:00',
  updatedAt: '2026-09-15T11:20:00',
}

function render(overrides: Partial<PlanReviewPanelProps> = {}) {
  const props: PlanReviewPanelProps = {
    status: 'missing',
    review: null,
    places: [],
    mode: 'view',
    submitting: false,
    submitError: null,
    errorMessage: messages.plan.reviewLoadErrorTitle,
    onRetry: () => undefined,
    onStartWrite: () => undefined,
    onCancelWrite: () => undefined,
    onSubmit: () => undefined,
    ...overrides,
  }
  return renderToStaticMarkup(createElement(PlanReviewPanel, props))
}

describe('PlanReviewPanel — 완료가 아닌 일정 진입점은 호출부가 가른다', () => {
  it('초안·확정용 분기를 그리지 않는다 — 이 패널은 완료 절 안에서만 산다', () => {
    const markup = render()
    expect(markup).toContain(messages.plan.reviewHeading)
    expect(markup).not.toContain('초안')
    expect(markup).not.toContain('확정')
  })
})

describe('PlanReviewPanel — 404 는 빈 상태다', () => {
  it('후기가 없으면 쓰기 CTA 를 주고 재시도 버튼을 달지 않는다', () => {
    const markup = render({ status: 'missing', mode: 'view' })

    expect(markup).toContain(messages.plan.reviewEmptyTitle)
    expect(markup).toContain(messages.plan.reviewWriteAction)
    expect(markup).not.toContain(messages.common.retry)
  })

  it('쓰기 폼에는 1~5 숫자 버튼이 있고 별점 한국어 매핑이 없다', () => {
    const markup = render({
      status: 'missing',
      mode: 'write',
      places: [
        {
          planItemId: '323456789012000020',
          title: '김창열미술관',
          placeId: 'p',
          rating: null,
          comment: '',
        },
      ],
    })

    expect(markup).toContain(messages.plan.reviewOverallLabel)
    expect(markup).toContain('>1<')
    expect(markup).toContain('>5<')
    expect(markup).not.toContain('아주 좋아요')
    expect(markup).not.toContain('별로예요')
    expect(markup).toContain('김창열미술관')
  })
})

describe('PlanReviewPanel — 조회 실패', () => {
  it('일시 장애에는 재시도를 준다', () => {
    const markup = render({ status: 'failed' })

    expect(markup).toContain(messages.plan.reviewLoadErrorTitle)
    expect(markup).toContain(messages.common.retry)
  })

  it('완료가 아닌 일정에서 서버가 PLAN_016 을 내면 문구만 보여 주고 재시도는 없다', () => {
    const markup = render({
      status: 'blocked',
      errorMessage: '완료된 일정만 후기를 쓰거나 볼 수 있습니다.',
    })

    expect(markup).toContain('완료된 일정만 후기를 쓰거나 볼 수 있습니다.')
    expect(markup).not.toContain(messages.common.retry)
    expect(markup).not.toContain(messages.plan.reviewWriteAction)
  })
})

describe('PlanReviewPanel — 보기', () => {
  it('저장된 후기를 숫자 그대로 보여 주고 고치기만 연다', () => {
    const markup = render({ status: 'ready', review: REVIEW, mode: 'view' })

    expect(markup).toContain(messages.plan.reviewOverallValue.replace('{rating}', '4'))
    expect(markup).toContain('둘째 날이 더웠다.')
    expect(markup).toContain('김창열미술관')
    expect(markup).toContain(messages.plan.reviewEditAction)
    expect(markup).not.toContain(messages.plan.reviewWriteAction)
    expect(markup).not.toContain(messages.common.retry)
  })
})
