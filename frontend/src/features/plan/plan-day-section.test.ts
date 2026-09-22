import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDaySection } from '@/features/plan/plan-day-section'
import { messages } from '@/lib/messages'
import {
  planDayAdd,
  planDayVisit,
  planDayWalkSafety,
  planDetail,
  planItemWalkSafety,
} from '@/test/fixtures/plan'
import type { PlaceDetail } from '@/types/place'

/**
 * 일자 카드의 산책 위험도 알림 — 이슈 #625 · 명세 D15-9 "일자 카드" 절.
 *
 * 행 하나짜리 갈래는 `plan-item-row.test.ts` 가 이미 잠근다. 여기서 보는 것은
 * **일자 단위로 접거나 하나로 합치는 것**이다 — `BEYOND_FORECAST_RANGE` 문장과
 * 전체 조회 실패·404 의 재시도 버튼 개수.
 */
function renderDaySection(overrides = {}) {
  return renderToStaticMarkup(
    createElement(PlanDaySection, {
      day: 1,
      date: '2026-09-12',
      rows: [{ item: planDetail.items[0]!, distanceMeters: null, distanceKind: null }],
      places: new Map<string, PlaceDetail>(),
      verdict: undefined,
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
      regenerateHref: null,
      ...overrides,
    }),
  )
}

/** 문구로 세지 않는다 — 버튼 개수로 본다 (다른 테스트가 이미 쓰는 관례) */
function buttonCount(markup: string): number {
  return markup.split('<button').length - 1
}

describe('PlanDaySection — 항목 산책 위험도 (#625)', () => {
  it('BEYOND_FORECAST_RANGE 는 일자에 문장이 한 번만 나온다 — 항목 수와 무관하다', () => {
    const sentence = '예보는 오늘부터 5일까지만 제공되어 이 날짜는 아직 판정할 수 없습니다.'
    const rows = [
      { item: planDetail.items[0]!, distanceMeters: null, distanceKind: null },
      { item: planDetail.items[1]!, distanceMeters: null, distanceKind: null },
    ]

    const markup = renderDaySection({
      rows,
      walkSafety: { ...planDayWalkSafety, beyondForecastReason: sentence },
    })

    expect(markup.split(sentence)).toHaveLength(2) // 한 번만 등장 — split 결과가 둘이다
  })

  it('전체 5xx 는 오류 문구와 재시도 버튼을 하나만 낸다', () => {
    const markup = renderDaySection({
      walkSafety: { ...planDayWalkSafety, failed: true },
    })

    expect(markup).toContain(messages.plan.walkSafetyErrorTitle)
    const retryButtons = markup
      .split('<button')
      .filter((chunk) => chunk.includes(messages.plan.walkSafetyRetryAction))
    expect(retryButtons).toHaveLength(1)
  })

  it('LOOKUP_FAILED 가 있으면 문구 없이 재시도 버튼만 하나 선다', () => {
    const markup = renderDaySection({
      rows: [
        {
          item: planDetail.items[0]!,
          distanceMeters: null,
          distanceKind: null,
        },
      ],
      walkSafety: {
        ...planDayWalkSafety,
        of: (planItemId: string) =>
          planItemId === planDetail.items[0]!.planItemId
            ? planItemWalkSafety({
                planItemId,
                walkSafetyLevel: null,
                unavailableReasonCode: 'LOOKUP_FAILED',
                unavailableReason: '산책 위험도를 조회하지 못했습니다.',
              })
            : undefined,
        hasLookupFailed: true,
      },
    })

    expect(markup).toContain(messages.plan.walkSafetyRetryAction)
    expect(markup).not.toContain(messages.plan.walkSafetyErrorTitle)
  })

  it('전체 404 는 문구도 버튼도 없다 — 자리를 통째로 숨긴다', () => {
    const markup = renderDaySection({ walkSafety: planDayWalkSafety })

    expect(markup).not.toContain(messages.plan.walkSafetyErrorTitle)
    expect(markup).not.toContain(messages.plan.walkSafetyRetryAction)
  })

  it('전체 5xx 여도 항목은 그대로 남는다 — 일정 자료는 우리 DB 다', () => {
    const markup = renderDaySection({
      walkSafety: { ...planDayWalkSafety, failed: true },
    })

    expect(markup).toContain(planDetail.items[0]!.title)
  })
})

describe('PlanDaySection — 버튼 개수 회귀', () => {
  /*
    **일자 카드에는 `장소 추가`·`순서 편집` 버튼이 이미 있다.** 산책 위험도 재시도가
    그 위에 하나 더 얹혀도 `LOOKUP_FAILED` 재시도는 정확히 하나여야 한다 — 두 번 세면
    같은 재조회를 두 번 트리거하는 배선 실수를 놓친다.
  */
  it('LOOKUP_FAILED 재시도 버튼은 다른 액션 버튼과 섞여도 하나다', () => {
    const markup = renderDaySection({
      walkSafety: { ...planDayWalkSafety, hasLookupFailed: true },
    })

    const retryButtons = markup
      .split('<button')
      .filter((chunk) => chunk.includes(messages.plan.walkSafetyRetryAction))
    expect(retryButtons).toHaveLength(1)
    // 다른 액션 버튼도 여전히 있다 — 재시도가 그것들을 밀어내지 않는다
    expect(buttonCount(markup)).toBeGreaterThan(1)
  })
})

/*
  **좌 레일 목차에서 뛴 자리** (#845). 헤더가 `sticky top-0 h-14 md:h-16` 이라 `scroll-mt`
  가 없으면 카드가 헤더 뒤로 들어간다 — 그 결함이 실제로 출고됐다.

  **값까지 잠근다.** `toContain('scroll-mt')` 로 두면 저장소 공통값인 20 으로 되돌려도
  통과하는데, 이 `h2` 는 카드 위 테두리에서 `pt-5`(20) 아래라 80 으로는 카드 상단이
  `md:h-16` 헤더와 12px 밖에 안 벌어진다.
*/
describe('PlanDaySection — 앵커가 고정 헤더를 피한다 (#845)', () => {
  it('일자 제목이 scroll-mt-24 를 갖는다', () => {
    const markup = renderDaySection()

    expect(markup).toMatch(/<h2 id="day1" class="[^"]*scroll-mt-24/)
  })
})
