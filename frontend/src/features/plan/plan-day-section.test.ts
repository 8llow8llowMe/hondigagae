import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanDaySection } from '@/features/plan/plan-day-section'
import { messages } from '@/lib/messages'
import {
  planDayAdd,
  planDayItemTime,
  planDayVisit,
  planDayWalkSafety,
  planDetail,
  planItem,
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
      itemTime: planDayItemTime,
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
  it('BEYOND_FORECAST_RANGE 문장은 일자 카드에 없다 — 일정 상단이 한 번 말한다 (#1426)', () => {
    const sentence =
      '산책 위험도는 시각별 예보로만 안내할 수 있고, 그 예보는 오늘부터 5일까지입니다. 이 날짜는 아직 알려 드릴 수 없습니다.'
    const rows = [
      { item: planDetail.items[0]!, distanceMeters: null, distanceKind: null },
      { item: planDetail.items[1]!, distanceMeters: null, distanceKind: null },
    ]

    const markup = renderDaySection({
      rows,
      forecastPending: 'walk',
      walkSafety: {
        ...planDayWalkSafety,
        of: (planItemId: string) =>
          planItemWalkSafety({
            planItemId,
            walkSafetyLevel: null,
            unavailableReasonCode: 'BEYOND_FORECAST_RANGE',
            unavailableReason: sentence,
          }),
      },
    })

    expect(markup).not.toContain(sentence)
    expect(markup).toContain(`>${messages.plan.walkForecastPendingChip}</span>`)
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
 * 액션 줄 (#842 · #1016).
 *
 * **`이 날 산책 위험도` 를 걷었다** (#1016). 그 링크가 가는 장소 상세의 산책 위험도는 날짜를
 * 받지 않는 **"지금" 기준**(`/places/{id}/walk-safety`)이라, 일자 카드에서 누르면 여행 날의
 * 판정으로 읽혔다. 날짜 기준 판정은 이 카드의 판정 밴드와 항목 줄의 산책 위험도(#625)에 있다.
 */
describe('PlanDaySection — 액션 줄 (#842 · #1016 · #1014)', () => {
  /** 액션 줄 — `장소 추가` 가 여는 `div` 하나 */
  function actionRowOf(markup: string): string {
    const start = markup.lastIndexOf('<div', markup.indexOf(messages.plan.addPlaceAction))
    return markup.slice(start, markup.indexOf('</div>', start))
  }

  it('기준 장소가 있어도 산책 위험도 링크가 없다 — 액션은 장소 추가 · 순서 편집 · 이동·휴식 추가 셋이다', () => {
    const row = actionRowOf(renderDaySection({ verdict: planVerdict }))

    expect(row).toContain(messages.plan.addPlaceAction)
    expect(row).toContain(messages.plan.editDayAction)
    expect(row).toContain(messages.plan.addMoveAction)
    expect(row).not.toContain('산책 위험도')
    expect(row).not.toContain(`href="/places/${planVerdict.representativePlaceId}"`)
    expect(row.match(/<(a|button) /g)).toHaveLength(3)
  })

  it('판정이 아직 안 온 날도 같은 세 액션이다', () => {
    const row = actionRowOf(renderDaySection({ verdict: undefined }))

    expect(row.match(/<(a|button) /g)).toHaveLength(3)
  })
})

describe('PlanDaySection — 시각 역행 · 겹침 경고 칩 (#1424)', () => {
  /** 사용성 테스트 재현: 순서 편집 뒤 10:00 → 15:00 → 12:30 → 15:00 */
  const rows = ['10:00:00', '15:00:00', '12:30:00', '15:00:00'].map((startTime, index) => ({
    item: planItem({ planItemId: `t${index}`, day: 1, sequence: index, startTime }),
    distanceMeters: null,
    distanceKind: null,
  }))

  it('앞 일정보다 이른 행과 같은 시각인 행에 각각 한 번씩 경고 칩이 선다', () => {
    const markup = renderDaySection({ rows })

    expect(markup.split(messages.plan.itemTimeBackward).length - 1).toBe(1)
    expect(markup.split(messages.plan.itemTimeOverlap).length - 1).toBe(1)
  })

  it('순서대로 흐르면 경고 칩이 없다', () => {
    const ordered = ['10:00:00', '12:30:00'].map((startTime, index) => ({
      item: planItem({ planItemId: `o${index}`, day: 1, sequence: index, startTime }),
      distanceMeters: null,
      distanceKind: null,
    }))
    const markup = renderDaySection({ rows: ordered })

    expect(markup).not.toContain(messages.plan.itemTimeBackward)
    expect(markup).not.toContain(messages.plan.itemTimeOverlap)
  })
})

/**
 * 예보 밖인 날 — 이슈 #1426 · 명세 D27-1.
 *
 * 3일 일정이면 판정 자리의 `예보는 오늘부터 …` 와 산책 위험도 문장이 여섯 번 섰다. 일자 카드는
 * 이제 제목 옆 `예보 전` 칩 하나만 갖는다.
 */
describe('PlanDaySection — 예보 전 칩 (#1426)', () => {
  const VERDICT_BEYOND = '예보는 오늘부터 11일까지만 제공되어 이 날짜는 아직 알려 드릴 수 없습니다.'
  const beyondVerdict = {
    ...planVerdict,
    score: null,
    suitabilityLevel: null,
    unavailableReasonCode: 'BEYOND_FORECAST_RANGE',
    unavailableReason: VERDICT_BEYOND,
  }

  it('`all` 이면 판정 문장 없이 `예보 전` 칩만 선다', () => {
    const markup = renderDaySection({ verdict: beyondVerdict, forecastPending: 'all' })

    expect(markup).toContain(`>${messages.plan.forecastPendingChip}</span>`)
    expect(markup).not.toContain(VERDICT_BEYOND)
  })

  it('칩은 제목 줄에 선다 — 일자 이름 뒤, 첫 항목 앞', () => {
    const markup = renderDaySection({ verdict: beyondVerdict, forecastPending: 'all' })

    const title = markup.indexOf(messages.plan.dayLabel.replace('{day}', '1'))
    const chip = markup.indexOf(`>${messages.plan.forecastPendingChip}</span>`)
    const firstItem = markup.indexOf('김창열미술관')
    expect(title).toBeLessThan(chip)
    expect(chip).toBeLessThan(firstItem)
  })

  it('예보 밖이 아니면 칩이 없고 판정 자리는 예전대로 서버 문장을 말한다', () => {
    const markup = renderDaySection({ verdict: beyondVerdict })

    expect(markup).not.toContain(`>${messages.plan.forecastPendingChip}</span>`)
    expect(markup).toContain(VERDICT_BEYOND)
  })

  it('판정 조회가 실패했으면 `all` 이어도 오류 · 재시도가 선다', () => {
    const markup = renderDaySection({
      verdict: beyondVerdict,
      forecastPending: 'all',
      verdictFailed: true,
    })

    expect(markup).toContain(messages.plan.verdictErrorTitle)
  })
})
