import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceMapPanel } from '@/features/place/place-map-panel'
import { messages } from '@/lib/messages'
import { placeSummary, placeWithoutCoordinate } from '@/test/fixtures/place'

/** 기본은 담기 지도처럼 행에 상세 링크를 둔다 — `/places`(미리보기 있음)는 `detailLink: false` */
function render(overrides: Partial<Parameters<typeof PlaceMapPanel>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(PlaceMapPanel, {
      places: [placeSummary],
      selectedId: null,
      onSelect: () => undefined,
      detailLink: true,
      ...overrides,
    }),
  )
}

describe('PlaceMapPanel', () => {
  it('행이 링크가 아니라 버튼이다 — 지도 화면에서 행을 누르는 것은 핀 고르기다', () => {
    const markup = render()

    expect(markup).toContain('<button')
    expect(markup).toContain('aria-pressed="false"')
  })

  it('상세로 가는 길이 사라지지 않는다 — 제목 대신 액션 열 링크다', () => {
    expect(render()).toContain(`href="/places/${placeSummary.placeId}"`)
  })

  it('선택 버튼 안에 대화형 요소가 없다 — button 안의 a 는 명세 위반이다', () => {
    const markup = render()
    const selectButton = markup.slice(markup.indexOf('<button'), markup.indexOf('</button>'))

    expect(selectButton).not.toContain('<a ')
    expect(selectButton).not.toContain('href=')
  })

  it('상세 링크가 어느 장소인지 말한다', () => {
    expect(render()).toContain(
      `aria-label="${messages.map.rowDetailLabel.replace('{title}', placeSummary.title)}"`,
    )
  })

  it('renderRowAction 을 액션 열에 그린다 — 담기 버튼이 여기 온다', () => {
    const markup = render({
      renderRowAction: () => createElement('button', { type: 'button' }, '담기'),
    })

    expect(markup).toContain('담기')
    expect(markup).toContain('w-24')
  })

  it('상세 링크만 있어도 열이 선다 — 담기 지도의 상세는 행 링크가 유일한 길이다', () => {
    expect(render()).toContain('w-24')
  })

  it('renderRowNotice 는 행 아래 전폭이다 — 액션 열은 w-24 라 알림이 못 들어간다', () => {
    const markup = render({
      renderRowNotice: () => createElement('p', { role: 'alert' }, '담지 못했어요'),
    })

    expect(markup).toContain('role="alert"')
    // 알림은 액션 열(w-24) 안이 아니라 그 뒤에 온다
    expect(markup.indexOf('role="alert"')).toBeGreaterThan(markup.indexOf('w-24'))
  })

  it('선택된 행을 aria-pressed 와 배경으로 함께 알린다', () => {
    const markup = render({ selectedId: placeSummary.placeId })

    expect(markup).toContain('aria-pressed="true"')
    // 선택 배경은 --row-selected 다. 판정 색(metric-*)을 쓰지 않는다
    expect(markup).toContain('bg-row-selected')
    expect(markup).not.toContain('metric-')
  })

  it('좌표가 없는 곳도 목록에는 남기고 이유를 말한다 — 목록으로도 도달 가능해야 한다', () => {
    const markup = render({ places: [placeWithoutCoordinate] })

    expect(markup).toContain(placeWithoutCoordinate.title)
    expect(markup).toContain(messages.map.noCoordinate)
  })

  it('좌표가 있는 곳에는 그 안내를 붙이지 않는다', () => {
    expect(render()).not.toContain(messages.map.noCoordinate)
  })
})

describe('PlaceMapPanel — 상세 링크 터치 영역 (#408)', () => {
  /*
    실측으로 잡았다. `h-11` 만 있을 때 낱말 두 글자 12px 라 **28.8 × 44** 였다 —
    DESIGN.md §7 의 최소 터치 영역은 44×44 로 **두 축 모두**다. 세로만 지킨 클래스는
    눈으로는 통과해 보여서, 가로 축을 클래스로 못박아 회귀를 막는다.
  */
  it('상세 링크가 두 축 모두 44px 를 잡는다', () => {
    const markup = render()
    const link = markup.match(/<a[^>]+href="\/places\/[^"]+"[^>]*>/)?.[0] ?? ''

    expect(link).toContain('h-11')
    expect(link).toContain('min-w-11')
  })
})

/*
  **미리보기가 있는 화면(`/places`)은 행에 상세를 두지 않는다** (#1267). 한 행에 누를 곳이
  둘(행 = 미리보기, 버튼 = 상세)이라 차이가 드러나지 않았고, 테두리 버튼 20개가 이름보다
  무거웠고, 이름 폭을 96 빼앗았다. 상세는 미리보기의 `상세 정보 전체 보기` 로 간다.
*/
describe('PlaceMapPanel — 미리보기 화면의 행 (#1267)', () => {
  it('detailLink 가 꺼지면 상세 링크도 액션 열도 없다 — 행은 버튼 하나다', () => {
    const markup = render({ detailLink: false })

    expect(markup).not.toContain('href="/places/')
    expect(markup).not.toContain('w-24')
    expect(markup).not.toContain(messages.map.rowDetail + '<')
  })

  it('detailLink 가 꺼져도 행 액션은 그린다 — 열은 액션을 위해 선다', () => {
    const markup = render({
      detailLink: false,
      renderRowAction: () => createElement('button', { type: 'button' }, '담기'),
    })

    expect(markup).toContain('담기')
    expect(markup).not.toContain('href="/places/')
  })
})
