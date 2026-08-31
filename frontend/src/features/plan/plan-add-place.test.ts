import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanAddPlaceRow } from '@/features/plan/plan-add-place-row'
import { PlanDaySection } from '@/features/plan/plan-day-section'
import { PlanIndoorAlternatives } from '@/features/plan/plan-indoor-alts'
import { messages } from '@/lib/messages'
import { placeDetail, placeSummary } from '@/test/fixtures/place'
import { planDayAdd, planDetail, planVerdict } from '@/test/fixtures/plan'
import type { PlaceDetail } from '@/types/place'

/** 명세: docs/features/plan/일자편집-세부명세.md F절 (이슈 #82) */

const ALTERNATIVE = { placeId: '212481712381923328', title: '김창열미술관' }

function renderAlternatives(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(PlanIndoorAlternatives, {
      alternatives: [ALTERNATIVE],
      places: new Map<string, PlaceDetail>(),
      addedPlaceIds: new Set<string>(),
      pendingPlaceId: null,
      disabled: false,
      error: null,
      onAdd: () => undefined,
      ...overrides,
    }),
  )
}

describe('PlanIndoorAlternatives — 실내 대안 담기', () => {
  it('대안이 비면 블록 자체를 렌더하지 않는다 — 빈 배열은 "대안 없음" 이 아니다', () => {
    expect(renderAlternatives({ alternatives: [] })).toBe('')
  })

  it('담기 버튼을 낸다', () => {
    expect(renderAlternatives()).toContain(messages.plan.addPlaceShort)
  })

  it('이미 담긴 장소는 담기 대신 이미 담았어요다 — 서버는 중복을 막지 않는다', () => {
    const markup = renderAlternatives({ addedPlaceIds: new Set([ALTERNATIVE.placeId]) })

    expect(markup).toContain(messages.plan.addPlaceAlready)
    expect(markup).not.toContain(`<button`)
  })

  it('담기 버튼이 어느 장소인지 말한다 — 여러 개가 전부 "담기" 로 읽히면 안 된다', () => {
    expect(renderAlternatives()).toContain(
      `aria-label="${messages.plan.addPlaceLabel.replace('{title}', ALTERNATIVE.title)}"`,
    )
  })

  it('보강이 오면 주소가 붙고, 없으면 제목만 남는다', () => {
    const places = new Map<string, PlaceDetail>([[ALTERNATIVE.placeId, placeDetail]])

    expect(renderAlternatives({ places })).toContain('제주시 한림읍')
    expect(renderAlternatives()).toContain(ALTERNATIVE.title)
  })

  it('계약에 없는 거리를 만들지 않는다 — 기준점이 정해져 있지 않다', () => {
    const places = new Map<string, PlaceDetail>([[ALTERNATIVE.placeId, placeDetail]])

    expect(renderAlternatives({ places })).not.toContain('km')
  })

  it('담기 실패는 토스트가 아니라 이 자리에 남는다 — 재시도할 수 있어야 한다', () => {
    const markup = renderAlternatives({
      error: { message: messages.plan.addPlaceErrorDescription, retriable: true },
    })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(messages.plan.addPlaceErrorTitle)
  })

  it('PLAN_004 는 재시도 제목을 붙이지 않는다 — 같은 본문이 같은 400 을 받는다', () => {
    const markup = renderAlternatives({
      error: { message: messages.plan.editMissingPlaceError, retriable: false },
    })

    expect(markup).toContain(messages.plan.editMissingPlaceError)
    expect(markup).not.toContain(messages.plan.addPlaceErrorTitle)
  })

  it('다른 담기가 진행 중이면 버튼이 잠긴다 — 일괄 교체는 동시에 두 개를 보낼 수 없다', () => {
    expect(renderAlternatives({ disabled: true })).toContain('disabled')
  })
})

function renderRow(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(PlanAddPlaceRow, {
      place: placeSummary,
      last: true,
      added: false,
      pending: false,
      disabled: false,
      onAdd: () => undefined,
      ...overrides,
    }),
  )
}

describe('PlanAddPlaceRow — 고르는 목록의 행', () => {
  it('목록 화면과 같은 내용을 쓴다 — 제목·주소·태그', () => {
    const markup = renderRow()

    expect(markup).toContain(placeSummary.title)
    expect(markup).toContain(placeSummary.petAllowanceType.name)
  })

  it('행 전체를 링크로 감싸지 않는다 — a 안에 button 을 넣을 수 없다', () => {
    const markup = renderRow()

    expect(markup).toContain('<button')
    expect(markup).not.toContain('<a ')
  })

  it('이미 담긴 장소는 버튼이 사라지지 않고 이유가 남는다', () => {
    const markup = renderRow({ added: true })

    expect(markup).toContain(messages.plan.addPlaceAlready)
    expect(markup).not.toContain('<button')
  })

  it('담는 중인 행만 진행 표시를 낸다', () => {
    expect(renderRow({ pending: true })).toContain('aria-busy="true"')
    expect(renderRow()).not.toContain('aria-busy="true"')
  })
})

describe('PlanDaySection — 장소 추가 진입', () => {
  function renderSection(overrides: Record<string, unknown> = {}) {
    return renderToStaticMarkup(
      createElement(PlanDaySection, {
        day: 1,
        date: '2026-09-12',
        rows: [{ item: planDetail.items[0]!, distanceMeters: null, distanceKind: null }],
        places: new Map<string, PlaceDetail>(),
        verdict: planVerdict,
        petConditionApplied: true,
        verdictFailed: false,
        onRetryVerdict: () => undefined,
        editing: false,
        onStartEdit: () => undefined,
        editor: null,
        add: planDayAdd,
        ...overrides,
      }),
    )
  }

  it('장소 추가는 모달이 아니라 라우트로 간다 (F5-1)', () => {
    expect(renderSection()).toContain(`href="${planDayAdd.href}"`)
  })

  it('항목이 0개여도 장소 추가는 남는다 — 담을 곳이 없는 날에 가장 필요하다', () => {
    const markup = renderSection({ rows: [] })

    expect(markup).toContain(messages.plan.addPlaceAction)
    expect(markup).not.toContain(messages.plan.editDayAction)
  })

  it('편집 중에는 장소 추가가 사라진다 — 순서를 정리하는 중에 조작을 섞지 않는다', () => {
    const markup = renderSection({ editing: true, editor: null })

    expect(markup).not.toContain(messages.plan.addPlaceAction)
  })
})
