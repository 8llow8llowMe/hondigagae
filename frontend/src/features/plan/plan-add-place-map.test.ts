import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceMapPanel } from '@/features/place/place-map-panel'
import { planAddPlaceAction, planAddPlaceNotice } from '@/features/plan/plan-add-place-action'
import { messages } from '@/lib/messages'
import { placeSummary, placeWithoutCoordinate } from '@/test/fixtures/place'
import { readSource } from '@/test/source'

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

    // `disabled=""` 로 본다. `disabled` 만 보면 Button 의 `disabled:opacity-50` 클래스에
    // 걸려 **항상 통과한다** — 전역 잠금이 풀려도 CI 가 녹색이었다
    expect(markup).toContain('disabled=""')
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

/**
 * 지도 갈래의 **떠 있는 머리** — 이슈 #556.
 *
 * #370 은 두 보기가 `PlanAddPlaceHeader` 하나를 나눠 쓰게 했는데, #556 이 목록의 머리를
 * 카드 안으로 넣으면서 두 갈래가 정말로 달라졌다 — 목록은 `Surface` 의 머리 슬롯,
 * 지도는 좌측 패널 기둥 위에 뜨는 카드다. 그 컴포넌트는 사라졌다.
 *
 * **소스 단언이다.** 지도 갈래는 `usePlanDetail` · `usePlaceList` 를 타는 클라이언트
 * 트리라 node 환경에서 통째로 렌더할 수 없다 (`testing-guide.md` §1).
 */
describe('지도 갈래의 떠 있는 머리 (#556)', () => {
  const source = readSource('src/features/plan/plan-add-place-view.tsx')
  /*
    **`<PlanAddPlaceShell` 로 끝을 잡지 않는다.** 그 태그는 로딩·오류 갈래가 **먼저** 쓰므로
    `indexOf` 가 지도 분기보다 앞을 가리켜 빈 문자열이 나온다 (실제로 그렇게 헛통과했다).
    지도 분기 다음에 오는 최상위 `return (` 까지로 자른다.
  */
  const mapStart = source.indexOf("if (view === 'map')")
  const mapBranch = source.slice(mapStart, source.indexOf('\n  return (', mapStart))

  /*
    지도 보기에서도 `h1` 을 숨기지 않는다 — `/places` 지도는 전역 nav 로 나갈 수 있지만
    이 화면의 퇴로는 `일정으로 돌아가기` 뿐이다. 접히는 패널 안에 넣을 수 없는 이유도 같다.
  */
  it('보이는 h1 과 돌아가기 링크가 떠 있는 카드 안에 있다', () => {
    expect(mapBranch).toMatch(/<h1 className="text-title-2/)
    expect(mapBranch).not.toMatch(/<h1 className="[^"]*sr-only/)
    expect(mapBranch).toContain('<BackLink href={backHref}')
    expect(mapBranch).toContain('messages.plan.addPlaceTitle')
  })

  /*
    **패널과 같은 기둥·같은 곡률이다.** 1440 열에 맞추면 폭에 따라 "패널 위" 와 "지도
    한복판" 으로 그림이 갈린다 (`plan-add-place-view` 머리 카드 주석).
  */
  it('좌측 패널 기둥에 붙고 패널과 같은 곡률을 쓴다', () => {
    expect(mapBranch).toMatch(/start-4[^"]*lg:end-auto/)
    expect(mapBranch).toContain('rounded-xl')
    // 폭 400 은 `.map-panel-width`(globals.css)와 같은 값이다 — 그 클래스는 `lg:` variant 를
    // 만들 수 없어 Tailwind 유틸리티로 쓴다 (`plan-add-place-view` 주석)
    expect(mapBranch).toContain('lg:w-100')
    // 패널은 그만큼 내려온다 — 겹치면 둘 다 못 읽는다
    expect(mapBranch).toContain('panelTopInset={PANEL_TOP_INSET}')
  })

  /*
    **토글을 지도에게 맡긴다** (#412 가 `/places` 에서 고친 것과 같은 규칙). 머리가 들고
    있으면 뷰포트 오른쪽 끝에 서서 목록 갈래(1440 열 안)와 253px 어긋난다.
  */
  it('보기 전환을 PlaceMapView 에 넘긴다 — 머리가 토글을 갖지 않는다', () => {
    expect(mapBranch).toContain('listHref={listHref}')
    expect(mapBranch).toContain('mapHref={mapHref}')
    expect(mapBranch).not.toContain('<ViewToggle')
  })

  /* 지도가 상단까지 찬다 — 머리가 흐름에서 빠졌다 */
  it('지도가 머리 아래가 아니라 전체 높이를 쓴다', () => {
    expect(mapBranch).toContain('<div className="map-canvas-height relative">')
    expect(mapBranch).not.toContain('map-canvas-height flex flex-col')
  })

  /* 부제는 목록에만 둔다 — 지도 위 카드는 작을수록 좋다 */
  it('떠 있는 머리에 부제를 두지 않는다', () => {
    expect(mapBranch).not.toContain('addPlaceSubtitle')
  })
})
