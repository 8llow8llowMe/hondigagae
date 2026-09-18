import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceListSection } from '@/features/place/place-list-section'
import { PlanAddPlaceRow } from '@/features/plan/plan-add-place-row'
import { PlanDaySection } from '@/features/plan/plan-day-section'
import { PlanIndoorAlternatives } from '@/features/plan/plan-indoor-alts'
import { messages } from '@/lib/messages'
import { placeDetail, placeSummary } from '@/test/fixtures/place'
import {
  planAlternative,
  planDayAdd,
  planDayVisit,
  planDayWalkSafety,
  planDetail,
  planVerdict,
} from '@/test/fixtures/plan'
import { readSource, stripComments } from '@/test/source'
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
        walkSafety: planDayWalkSafety,
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
  const source = readSource('src/features/plan/plan-add-place-view.tsx')

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

describe('행과 그 행을 담는 목록이 같은 인셋에 선다 (#451)', () => {
  const source = readSource('src/features/plan/plan-add-place-view.tsx')

  /*
    **불변식은 "카드 안이냐" 가 아니라 "행과 목록이 같은 축에 서느냐" 다.**

    이 뷰는 `PlanAddPlaceRow` 를 두 자리에서 그린다.
    - **목록 갈래** — L1 카드 안이라 행·스켈레톤·빈/오류가 전부 카드 값 `card`(16/20)다.
      `PlaceListSection` 의 기본값이 그것이므로 **넘기지 않는 것**이 맞는 상태다 (#451).
    - **지도 갈래의 SDK 실패 폴백** — 카드가 아니라 페이지 위라 `main`(16/40)이다. 그쪽
      `PlaceListSection` 은 `inset="main"` 이고 위 안내 줄도 `md:px-10` 이어서
      (`place-map-view.tsx`), 행이 기본값으로 서면 768 이상에서 행만 20 이 된다.

    #439 가 "두 곳 다 `inset="main"`" 을 잠갔던 자리다 — 화면이 3a 로 옮겨지면서
    목록 갈래만 뒤집혔고 폴백은 그대로다.
  */
  /**
   * **주석을 걷은 소스로 본다.** 이 파일의 결정 주석이 `inset="main"` 같은 값을 그대로
   * 인용하므로, 걷지 않으면 **속성을 지워도 주석이 단언을 통과시킨다** (실제로 잡았다).
   *
   * 헬퍼는 `src/test/source.ts` 가 갖는다 (#458) — 예전에는 아홉 파일이 각자 갖고 있었고
   * **둘은 블록 주석만, 일곱은 줄 주석까지** 걷어 같은 이름이 다른 일을 했다.
   */
  const code = stripComments(source)

  /** 첩첩 태그가 없어 non-greedy 로 한 태그를 정확히 끊는다 */
  const ROW_TAG = /<PlanAddPlaceRow\b[\s\S]*?\/>/

  it('목록 갈래는 목록도 행도 인셋을 넘기지 않는다 — 기본값 card 가 곧 그 자리다', () => {
    const block = code.slice(
      code.lastIndexOf('<PlaceListSection'),
      code.lastIndexOf('</PlanAddPlaceShell>'),
    )

    // `PlaceListSection` 자신의 props (renderRow 앞까지)
    expect(block.split('renderRow=')[0]).not.toContain('inset=')
    // 그 안에서 그리는 행
    expect(ROW_TAG.exec(block)?.[0]).not.toContain('inset=')
  })

  it('첫 로딩 껍데기의 목록도 인셋을 넘기지 않는다 — 하나만 어긋나도 왼쪽 선이 뛴다', () => {
    const shell = /<PlaceListSection\b[\s\S]*?\/>/.exec(code)?.[0]

    expect(shell).toBeDefined()
    expect(shell).not.toContain('inset=')
  })

  it('지도 폴백의 행은 inset="main" 을 되돌려 받는다 — 그 목록은 카드가 아니다', () => {
    const fallback = /renderListRow=\{\(place\) => \([\s\S]*?<PlanAddPlaceRow\b[\s\S]*?\/>/.exec(
      code,
    )?.[0]

    expect(fallback).toBeDefined()
    expect(fallback).toContain('inset="main"')
  })

  /*
    소스 단언만으로는 두 값이 실제로 다른 클래스가 되는지 알 수 없다 — 렌더해서 본다.
    `card` 는 16/20(`md:px-5`), `main` 은 16/40(`md:px-10`)이다.
  */
  it('기본 행은 카드 값 20 으로 렌더된다', () => {
    const markup = renderRow()

    expect(markup).toContain('md:px-5')
    expect(markup).not.toContain('md:px-10')
  })

  it('inset="main" 을 받은 행은 페이지 값 40 으로 렌더된다', () => {
    const markup = renderRow({ inset: 'main' })

    expect(markup).toContain('md:px-10')
    expect(markup).not.toContain('md:px-5')
  })

  /*
    스켈레톤도 같은 값이어야 목록이 실데이터로 바뀌는 순간 왼쪽 선이 뛰지 않는다.
    `PlaceListSection` 의 기본값에 기대는 대신 실제로 로딩 상태를 렌더해 확인한다.
  */
  it('목록 갈래 스켈레톤도 카드 값 20 이다 — 기본값을 렌더로 확인한다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceListSection, {
        places: [],
        loading: true,
        errorStatus: null,
        hasNext: false,
        loadingMore: false,
        onLoadMore: () => undefined,
        onRetry: () => undefined,
        onResetFilters: () => undefined,
      }),
    )

    expect(markup).toContain('md:px-5')
    expect(markup).not.toContain('md:px-10')
  })
})

describe('담기 목록이 3층 표면 위에 선다 (#451)', () => {
  const source = readSource('src/features/plan/plan-add-place-view.tsx')

  it('껍데기가 SurfaceStack 과 Surface 를 쓴다 — 2a 프리미티브를 쓰지 않는다', () => {
    expect(source).toContain("import { Surface, SurfaceStack } from '@/components/surface'")
    /*
      **`id` 와 `tabIndex` 가 붙는다** (#472). 레일의 `목록으로 건너뛰기` 가 여기로 온다.
      `tabIndex={-1}` 은 Chromium 에서는 없어도 동작해 e2e 가 구별하지 못하지만(뮤테이션으로
      확인), 보조기기 조합을 위한 처방이라 **여기서 문자열로 잠근다.**
    */
    // `list-column`(globals.css)이 lg 에서 열 높이를 잡고 카드가 `fill` 로 채운다 (#553 · #556)
    expect(source).toContain(
      '<SurfaceStack id="plan-add-place-list" tabIndex={-1} className="list-column">',
    )
    /*
      **카드가 제목·뒤로가기·토글을 머리로 받는다** (#556). #451 때는 그것들이 바닥 위
      `PlanAddPlaceHeader` 였고 카드는 `aria-label` 만 가졌는데, 그 컴포넌트는 이 개정에서
      사라졌다 — 목록은 카드 머리를, 지도는 떠 있는 카드를 각자 그린다.
    */
    expect(source).toMatch(/<Surface\s+fill/)
    expect(source).toContain('title={title}')
    expect(source).toContain('leading={<BackLink')
    expect(source).not.toContain('PlanAddPlaceHeader')
  })

  /*
    2a 는 우측 열의 `border-left` 로 두 열을 갈랐다. 3a 는 L0 바닥이 그 일을 한다 —
    선을 남기면 카드 테두리와 나란히 두 줄로 읽힌다 (`places/(list)/page.tsx` · 홈 #428).
  */
  it('페이지가 열 구분선을 그리지 않는다 — 바닥이 두 열을 가른다', () => {
    const page = readSource('app/(main)/plans/[planId]/days/[day]/add/page.tsx')

    expect(page).not.toContain('lg:border-l')
    expect(page).toContain('<Canvas as="main"')
  })
})
