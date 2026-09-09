import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceMapPanel } from '@/features/place/place-map-panel'
import { planAddPlaceAction, planAddPlaceNotice } from '@/features/plan/plan-add-place-action'
import { PlanAddPlaceHeader } from '@/features/plan/plan-add-place-header'
import { messages } from '@/lib/messages'
import { placeSummary, placeWithoutCoordinate } from '@/test/fixtures/place'

/** 명세: docs/features/plan/담기지도-세부명세.md (이슈 #370) */

function renderPanel(overrides: Partial<Parameters<typeof PlaceMapPanel>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(PlaceMapPanel, {
      places: [placeSummary],
      selectedId: null,
      onSelect: () => undefined,
      ...overrides,
    }),
  )
}

const BASE = {
  addedPlaceIds: new Set<string>(),
  pendingPlaceId: null,
  disabled: false,
  onAdd: () => undefined,
}

describe('지도 패널의 담기 액션', () => {
  it('아직 안 담은 곳에는 담기 버튼이 붙는다', () => {
    const markup = renderPanel({ renderRowAction: (place) => planAddPlaceAction(place, BASE) })

    expect(markup).toContain(messages.plan.addPlaceShort)
    expect(markup).toContain(
      `aria-label="${messages.plan.addPlaceLabel.replace('{title}', placeSummary.title)}"`,
    )
  })

  it('이미 담긴 곳은 버튼 대신 이유가 남는다 — 서버는 중복을 막지 않는다', () => {
    const markup = renderPanel({
      renderRowAction: (place) =>
        planAddPlaceAction(place, { ...BASE, addedPlaceIds: new Set([placeSummary.placeId]) }),
    })

    expect(markup).toContain(messages.plan.addPlaceAlready)
    expect(markup).not.toContain(messages.plan.addPlaceShort)
  })

  it('담는 중인 행만 진행 표시를 낸다', () => {
    const pending = renderPanel({
      renderRowAction: (place) =>
        planAddPlaceAction(place, { ...BASE, pendingPlaceId: placeSummary.placeId }),
    })

    expect(pending).toContain('aria-busy="true"')
  })

  it('다른 담기가 진행 중이면 잠긴다 — 일괄 교체는 동시에 두 개를 못 보낸다', () => {
    const markup = renderPanel({
      renderRowAction: (place) =>
        planAddPlaceAction(place, { ...BASE, disabled: true, pendingPlaceId: 'other' }),
    })

    expect(markup).toContain('disabled')
  })

  it('좌표가 없어도 담기 버튼은 붙는다 — 좌표는 담는 것과 무관하다', () => {
    const markup = renderPanel({
      places: [placeWithoutCoordinate],
      renderRowAction: (place) => planAddPlaceAction(place, BASE),
    })

    expect(markup).toContain(messages.map.noCoordinate)
    expect(markup).toContain(messages.plan.addPlaceShort)
  })
})

describe('지도 패널의 담기 실패 알림', () => {
  it('실패는 그 행 아래에 남는다 — 헤더에 모으면 스크롤 아래에서 안 보인다', () => {
    const markup = renderPanel({
      renderRowNotice: (place) =>
        planAddPlaceNotice(place, {
          failure: {
            target: { day: 1, placeId: placeSummary.placeId },
            error: { message: messages.plan.addPlaceErrorDescription, retriable: true },
          },
        }),
    })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(messages.plan.addPlaceErrorTitle)
  })

  it('다른 행의 실패는 이 행에 붙지 않는다', () => {
    const markup = renderPanel({
      renderRowNotice: (place) =>
        planAddPlaceNotice(place, {
          failure: {
            target: { day: 1, placeId: 'other' },
            error: { message: messages.plan.addPlaceErrorDescription, retriable: true },
          },
        }),
    })

    expect(markup).not.toContain('role="alert"')
  })

  it('PLAN_004 는 재시도 제목을 붙이지 않는다 — 같은 본문이 같은 400 을 받는다', () => {
    const markup = renderPanel({
      renderRowNotice: (place) =>
        planAddPlaceNotice(place, {
          failure: {
            target: { day: 1, placeId: placeSummary.placeId },
            error: { message: messages.plan.addPlaceMissingPlaceError, retriable: false },
          },
        }),
    })

    expect(markup).toContain(messages.plan.addPlaceMissingPlaceError)
    expect(markup).not.toContain(messages.plan.addPlaceErrorTitle)
  })
})

describe('PlanAddPlaceHeader — 두 보기가 나눠 쓰는 머리', () => {
  function renderHeader(overrides: Partial<Parameters<typeof PlanAddPlaceHeader>[0]> = {}) {
    return renderToStaticMarkup(
      createElement(PlanAddPlaceHeader, {
        day: 2,
        backHref: '/plans/1#day-2',
        listHref: '/plans/1/days/2/add?view=list',
        mapHref: '/plans/1/days/2/add',
        view: 'map' as const,
        ...overrides,
      }),
    )
  }

  /*
    지도 보기에서도 h1 을 sr-only 로 숨기지 않는다 — /places 지도는 전역 nav 로 나갈 수
    있지만 이 화면의 퇴로는 `일정으로 돌아가기` 뿐이다.
  */
  it('보이는 h1 과 돌아가기 링크를 둔다 — 지도에서도 숨기지 않는다', () => {
    const markup = renderHeader()

    expect(markup).toContain('<h1')
    expect(markup).not.toContain('sr-only')
    expect(markup).toContain('href="/plans/1#day-2"')
    expect(markup).toContain(messages.plan.addPlaceTitle.replace('{day}', '2'))
  })

  it('일정 제목을 받으면 부제 앞에 붙이고, 없으면 부제만 남긴다', () => {
    expect(renderHeader({ planTitle: '제주 3박4일' })).toContain('제주 3박4일 ·')
    expect(renderHeader()).toContain(messages.plan.addPlaceSubtitle.replace('{day}', '2'))
  })

  it('보기 전환 토글이 현재 보기를 눌린 상태로 알린다', () => {
    const onMap = renderHeader({ view: 'map' })
    const onList = renderHeader({ view: 'list' })

    /*
      실제 마크업은 `aria-current` 가 (있을 때만) `href` 보다 앞에 오고 그 사이에 활성
      여부에 따라 값이 달라지는 `class` 가 낀다 — `aria-current="true" aria-label="..."
      title="..." class="..." href="...">` 순서. `href` 를 직접 붙여 보는 대신, 활성
      링크에만 붙는 `aria-current` 가 어느 `aria-label`(지도로 보기/목록으로 보기)에
      붙는지로 "두 보기에서 눌린 쪽이 다르다" 를 검증한다.
    */
    // 지도 보기면 지도 링크가 눌려 있고 목록 링크는 아니다
    expect(onMap).toContain('aria-current="true" aria-label="지도로 보기"')
    expect(onMap).not.toContain('aria-current="true" aria-label="목록으로 보기"')
    expect(onMap).toContain('href="/plans/1/days/2/add"')
    expect(onMap).toContain('href="/plans/1/days/2/add?view=list"')

    // 목록 보기면 반대다
    expect(onList).toContain('aria-current="true" aria-label="목록으로 보기"')
    expect(onList).not.toContain('aria-current="true" aria-label="지도로 보기"')
  })
})
