import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceMapPanel } from '@/features/place/place-map-panel'
import { planAddPlaceAction, planAddPlaceNotice } from '@/features/plan/plan-add-place-action'
import { messages } from '@/lib/messages'
import { placeSummary, placeWithoutCoordinate } from '@/test/fixtures/place'
import { readSource, readSourceWithoutComments } from '@/test/source'

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
    이 화면의 퇴로는 `일정으로 돌아가기` 뿐이다. 데스크톱 패널 안에 들어간 뒤(#1232)에도 접으면
    떠 있는 카드로 돌아오는 이유가 같다.
  */
  it('보이는 h1 과 돌아가기 링크가 머리(head) 안에 있다', () => {
    expect(mapBranch).toMatch(/<h1 className="text-title-2/)
    expect(mapBranch).not.toMatch(/<h1 className="[^"]*sr-only/)
    expect(mapBranch).toContain('<BackLink href={backHref}')
    expect(mapBranch).toContain('messages.plan.addPlaceTitle')
  })

  /*
    **기둥은 #1012 부터 `PlaceMapView` 가 그린다** — 이 화면은 머리 내용을 `head` 로 넘긴다.
    카드 모양은 #1232 부터 자리를 아는 `PlaceMapView` 가 입힌다.
    기둥 자리(`start-4 … lg:end-auto`)는 `place-map-search.test.ts` 가 잠근다.
  */
  it('머리를 PlaceMapView 의 head 로 내용만 넘긴다 — 카드 모양 · 패널 위 여백은 지도가 정한다', () => {
    expect(mapBranch).toContain('head={')
    // 자리를 스스로 띄우지 않는다 — 띄우면 폴백에서 목록을 덮고 모바일 검색 자리가 사라진다
    expect(mapBranch).not.toMatch(/className="[^"]*\babsolute\b/)
    /*
      #1232 D9 — 같은 머리가 모바일 · 접힌 데스크톱에서는 떠 있는 카드, 열린 데스크톱 패널에서는 맨 위
      블록이다. 호출부가 카드를 입혀 넘기면 패널 안에서 카드 속 카드가 된다.
    */
    expect(mapBranch).not.toContain('shadow-lg')
    expect(mapBranch).not.toContain('rounded-xl')
    // 패널이 헤더 바로 아래부터 붙어 머리 아래로 밀어 내릴 일이 없다
    expect(mapBranch).not.toContain('panelTopInset')
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

/**
 * 담기 화면의 검색 — 이슈 #1012.
 *
 * `/places` 와 같은 `PlaceSearchField` 가 **두 갈래에 함께** 선다. 한쪽만 두면 같은 화면의
 * 두 보기가 다른 도구를 갖는다 (#596 이 지도에만 켜지 않은 근거). 제출 뒤 경로 유지는
 * `use-place-filter-nav.test.ts` 가, 실제 사슬은 `e2e/place-search.spec.ts` 가 잰다.
 */
describe('담기 화면의 검색 자리 (#1012)', () => {
  const code = readSourceWithoutComments('src/features/plan/plan-add-place-view.tsx')
  const listPage = readSourceWithoutComments('app/(main)/places/(list)/page.tsx')

  /** `tools={` 부터 그 prop 을 닫는 `}` 까지 — 프래그먼트 하나라 `</>` 로 끊는다 */
  function toolsOf(source: string): string {
    const start = source.indexOf('tools={')
    return source.slice(start, source.indexOf('</>', start))
  }

  it('목록 갈래 머리 도구에 검색이 칩보다 먼저 선다 — /places 목록과 같은 순서다', () => {
    const tools = toolsOf(code)
    const search = tools.indexOf('<PlaceSearchField filters={filters} />')
    const chips = tools.indexOf('<PlaceFilterChips')

    expect(search).toBeGreaterThan(-1)
    expect(chips).toBeGreaterThan(search)
    // 칩만 1024 미만이다 — 검색은 모든 폭에서 이 자리다
    expect(tools.slice(chips)).toContain('lg:hidden')
  })

  it('/places 목록 머리와 같은 모양이다 — 검색에 따로 준 속성이 없다', () => {
    const tools = toolsOf(listPage)

    expect(tools).toContain('<PlaceSearchField filters={filters} />')
    expect(toolsOf(code)).toContain('<PlaceSearchField filters={filters} />')
  })

  it('지도 갈래가 PlaceMapView 에 searchable 을 켠다', () => {
    const mapStart = code.indexOf("if (view === 'map')")
    const tag = code.slice(
      code.indexOf('<PlaceMapView', mapStart),
      code.indexOf('head={', mapStart),
    )

    expect(tag).toMatch(/\bsearchable\b/)
  })
})

/**
 * 담기 지도의 기준점 — 이슈 #1177.
 *
 * 규칙(직전 장소 → 그날 숙소 → 전날 숙소 → 없음)은 `add-place-focus.test.ts` 가, 지도가 그
 * 점에서 여는 상태 전이는 `place-map-area.test.ts` 가 잰다. 여기서는 지도 갈래가 넘기는지 본다.
 * 목록 보기의 거리순(#1217)은 아래 블록이 본다.
 */
describe('담기 지도의 기준점 (#1177)', () => {
  const code = readSourceWithoutComments('src/features/plan/plan-add-place-view.tsx')

  it('지도 갈래가 그날 기준점을 넘긴다', () => {
    const mapStart = code.indexOf("if (view === 'map')")
    const listStart = code.indexOf('<PlanAddPlaceShell', mapStart)

    expect(code.slice(mapStart, listStart)).toContain('initialFocus={focusBasis?.coord ?? null}')
    expect(code).toContain('const focusBasis = addPlaceFocusBasis(day, days)')
  })

  /* 기준점 마커의 이름도 같은 판정에서 나온다 — 찍는 자리와 이름이 갈리지 않게 (#1223) */
  it('지도 갈래가 기준점 이름을 함께 넘긴다', () => {
    const mapStart = code.indexOf("if (view === 'map')")
    const listStart = code.indexOf('<PlanAddPlaceShell', mapStart)

    expect(code.slice(mapStart, listStart)).toContain(
      'initialFocusName={addPlaceFocusMarkerName(focusBasis)}',
    )
  })
})

/**
 * 담기 목록 보기의 거리순 — 이슈 #1217.
 *
 * 훅을 든 뷰는 node 환경에서 렌더되지 않아(`testing-guide.md` §1) 배선을 소스로 본다. 기준점 규칙은
 * `add-place-focus.test.ts`, 키 분리는 `queries.test.ts`, 쿼리는 `place-filters.test.ts` 가 잰다.
 */
describe('담기 목록 보기의 거리순 (#1217)', () => {
  const code = readSourceWithoutComments('src/features/plan/plan-add-place-view.tsx')
  const page = readSourceWithoutComments('app/(main)/plans/[planId]/days/[day]/add/page.tsx')

  it('서버와 클라이언트가 같은 함수로 기준점을 낸다 — key 가 맞아야 하이드레이션이 된다', () => {
    expect(code).toContain('addPlaceListBasis(detail.data, day)')
    expect(page).toContain('addPlaceListOrigin(detail, day)')
    expect(page).toContain('placeKeys.list(filters, origin)')
  })

  it('목록 보기에서만, 상세가 온 뒤에 조회한다 — 지도에서 쓰지 않을 요청을 내지 않는다', () => {
    expect(code).toContain(
      "usePlaceList(filters, view === 'list' && frozenBasis !== null, listOrigin)",
    )
  })

  it('기준점을 처음 값으로 얼린다 — 담을 때마다 목록이 처음부터 다시 받아지지 않게', () => {
    expect(code).toContain('if (frozenBasis === null && liveBasis !== undefined)')
    expect(code).not.toMatch(/usePlaceList\([^)]*liveBasis/)
  })

  /* 목록 위 한 줄도 얼린 기준점에서 나온다 — 말하는 장소와 잰 점이 같아야 한다 (#1221) */
  it('목록 위 한 줄이 얼린 기준점의 이름을 말한다', () => {
    expect(code).toContain('addPlaceNearbyCaption(frozenBasis?.value ?? null)')
    expect(code).not.toContain('addPlaceNearbyCaption(liveBasis')
  })

  /*
    **검색어 0건이 무엇으로 찾았는지 되돌려 준다** (#1220). `/places` 목록 · 지도 폴백은 넘기는데 담기
    목록 보기만 빠져 있었다 — #1012 로 검색이 붙을 때 놓쳤다.
  */
  it('목록 보기가 검색어를 넘긴다 — 0건 문구가 검색어를 말한다', () => {
    const listStart = code.lastIndexOf('<PlaceListSection')

    expect(
      code.slice(listStart, code.indexOf('/>', code.indexOf('renderRow', listStart))),
    ).toContain('keyword={filters.keyword}')
  })

  it('지도 보기의 서버 프리페치는 좌표 없는 key 그대로다', () => {
    expect(page).toContain("view === 'list' ? addPlaceListOrigin(detail, day) : null")
  })
})
