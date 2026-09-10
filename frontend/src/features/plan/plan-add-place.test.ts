import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { PlanAddPlaceRow } from '@/features/plan/plan-add-place-row'
import { PlanDaySection } from '@/features/plan/plan-day-section'
import { PlanIndoorAlternatives } from '@/features/plan/plan-indoor-alts'
import { messages } from '@/lib/messages'
import { placeDetail, placeSummary } from '@/test/fixtures/place'
import {
  planAlternative,
  planDayAdd,
  planDayVisit,
  planDetail,
  planVerdict,
} from '@/test/fixtures/plan'
import type { PlaceDetail } from '@/types/place'

/** 명세: docs/features/plan/일자편집-세부명세.md F절 (이슈 #82) */

const ALTERNATIVE = planAlternative({ title: '김창열미술관', distanceMeters: 12_400 })

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

  /*
    서버가 `distanceMeters` 를 준다 — 그날 기준 장소로부터의 하버사인 거리다.
    화면이 재지 않고, **`직선` 을 반드시 붙인다** (D3).
  */
  it('서버가 준 거리를 직선거리로 밝혀 표시한다', () => {
    const markup = renderAlternatives()

    expect(markup).toContain('직선 12.4km')
  })

  it('거리는 보강을 기다리지 않는다 — 계약에서 바로 온다', () => {
    // places 가 비어 주소가 없어도 거리는 나온다
    expect(renderAlternatives()).toContain('직선 12.4km')
  })

  it('보강 전에도 44px 터치 영역을 잃지 않는다', () => {
    expect(renderAlternatives()).toContain('min-h-11')
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
    // `disabled=""` 로 본다. `disabled` 만 보면 Button 의 `disabled:opacity-50` 클래스에
    // 걸려 **항상 통과한다**
    expect(renderAlternatives({ disabled: true })).toContain('disabled=""')
  })
})

function renderRow(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(PlanAddPlaceRow, {
      place: placeSummary,
      added: false,
      pending: false,
      disabled: false,
      error: null,
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

  it('행 전체가 아니라 제목만 링크다 — a 안에 button 을 넣을 수 없다', () => {
    const markup = renderRow()

    expect(markup).toContain('<button')
    // 링크는 하나뿐이고 제목에 걸려 있다
    expect(markup.match(/<a /g)).toHaveLength(1)
    expect(markup).toContain(`href="/places/${placeSummary.placeId}"`)
  })

  it('담기 실패를 그 행에 남긴다 — 헤더에 모으면 스크롤 아래에서 안 보인다', () => {
    const markup = renderRow({
      error: { message: messages.plan.addPlaceMissingPlaceError, retriable: false },
    })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(messages.plan.addPlaceMissingPlaceError)
  })

  it('액션 열이 고정 폭이라 담기/이미 담았어요 사이에 앞 열이 밀리지 않는다', () => {
    expect(renderRow()).toContain('w-24')
    expect(renderRow({ added: true })).toContain('w-24')
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
        basisPetName: null,
        verdictFailed: false,
        onRetryVerdict: () => undefined,
        editing: false,
        onStartEdit: () => undefined,
        editor: null,
        add: planDayAdd,
        visit: planDayVisit,
        regenerateHref: '/plans/1/days/1/regenerate',
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

describe('담기 성공 후 화면에 남는다 (#370)', () => {
  /* vitest 의 cwd 에 기대지 않는다 — 테스트 파일 기준으로 잡는다 */
  const source = readFileSync(
    fileURLToPath(new URL('./plan-add-place-view.tsx', import.meta.url)),
    'utf8',
  )

  /*
    일자편집 명세 F5(396행)는 원래 "그 일자로 replace 이동" 이었다. #370 이 뒤집었다 —
    지도에서 여러 곳을 연달아 담으려면 화면에 남아야 한다. 피드백은 토스트와
    "이미 담았어요" 이고, 돌아가기는 헤더의 BackLink 다.
  */
  it('onAdded 콜백을 넘기지 않는다 — 담자마자 나가면 연달아 담을 수 없다', () => {
    expect(source).toContain('usePlanAddPlace({ planId })')
    expect(source).not.toContain('onAdded:')
  })

  it('담기 경로에서 일정 상세로 replace 하지 않는다', () => {
    expect(source).not.toContain('router.replace(`/plans/${planId}#')
  })
})
