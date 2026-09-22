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
  planVerdict,
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
  통과한다. 이 `h2` 는 카드 위 테두리보다 **30px 아래**라(실측 768 · 2026-09-22) 뛴 뒤
  카드 상단이 `scroll-mt - 30` 에 선다 — 96 이면 66 이라 `md:h-16`(64) 헤더와 2px 밖에
  안 벌어졌다. 112 면 82 다.
*/
describe('PlanDaySection — 앵커가 고정 헤더를 피한다 (#845)', () => {
  it('일자 제목이 scroll-mt-28 을 갖는다', () => {
    const markup = renderDaySection()

    expect(markup).toMatch(/<h2 id="day1" class="[^"]*scroll-mt-28/)
  })
})

/**
 * 액션을 한 자리로 모은다 (#842 · #653 의 완결).
 *
 * #653 이 "읽는 순서와 탭 순서를 맞춘다"로 도구를 판정 아래로 내렸는데, 산책 링크만
 * 판정 줄의 `ml-auto` 에 남아 액션이 두 자리로 흩어져 있었다.
 */
describe('PlanDaySection — 액션 줄 (#842)', () => {
  it('산책 위험도 버튼이 액션 줄에 있다 — 판정 밴드보다 뒤다', () => {
    const markup = renderDaySection({ verdict: planVerdict })

    expect(markup).toContain(messages.plan.walkAction)
    expect(markup.indexOf(messages.plan.walkAction)).toBeGreaterThan(
      markup.indexOf(messages.plan.addPlaceAction),
    )
  })

  /* 산책 위험도는 장소 상세가 소유한다 — 기준 장소가 없으면 부를 대상이 없다 */
  it('기준 장소가 없으면 버튼이 없다', () => {
    const markup = renderDaySection({
      verdict: { ...planVerdict, representativePlaceId: null },
    })

    expect(markup).not.toContain(messages.plan.walkAction)
  })

  it('판정이 아직 안 온 날에도 버튼이 없다', () => {
    expect(renderDaySection({ verdict: undefined })).not.toContain(messages.plan.walkAction)
  })

  /* 편집 중에는 액션 줄 전체가 감춰진다 — 순서를 정리하는 중에 다른 조작을 섞지 않는다 */
  it('편집 중에는 버튼이 없다', () => {
    const markup = renderDaySection({ verdict: planVerdict, editing: true })

    expect(markup).not.toContain(messages.plan.walkAction)
  })

  /*
    **라벨이 목적지를 말한다** (#653 의 남은 지적). `이 날 산책` 은 링크가 아니라 행동으로
    읽혔다. **`산책 코스` 라고 부르지 않는다** — 이 저장소에서 그 낱말은 `walkCourse` ·
    `/walk-courses` 라는 별개 도메인이고, 이 링크가 가는 곳은 장소 상세다.
  */
  it('라벨이 산책 코스 도메인과 겹치지 않는다', () => {
    expect(messages.plan.walkAction).not.toContain('산책 코스')
  })

  /*
    **버튼 태그를 추려서 본다.** 같은 화면의 항목 행도 `/places/…` 로 링크하므로 마크업
    전체를 `toContain` 으로 보면 버튼이 없어도 통과한다 — 실제로 그렇게 통과했다.
  */
  it('링크가 기준 장소 상세로 간다', () => {
    const markup = renderDaySection({ verdict: planVerdict })
    const link = new RegExp(`<a [^>]*href="[^"]*"[^>]*>${messages.plan.walkAction}</a>`).exec(
      markup,
    )

    expect(link?.[0]).toContain(`href="/places/${planVerdict.representativePlaceId}"`)
  })
})
