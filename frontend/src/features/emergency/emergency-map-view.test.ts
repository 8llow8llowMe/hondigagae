import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { isSelectionStillValid, PositionNotice } from '@/features/emergency/emergency-map-view'
import type { PositionFailure, PositionResult } from '@/lib/geo/current-position'
import { messages } from '@/lib/messages'
import { facility } from '@/test/fixtures/emergency'

describe('isSelectionStillValid', () => {
  const granted: PositionResult = { kind: 'granted', lat: 33.48, lng: 126.49 }
  const relocated: PositionResult = { kind: 'granted', lat: 33.25, lng: 126.4 }
  const selected = facility()

  function base() {
    return {
      anchorRadius: 10_000,
      anchorPosition: granted,
      currentRadius: 10_000,
      currentPosition: granted,
      selectedId: selected.facilityId,
      visible: [selected],
    }
  }

  it('anchor 와 지금 값이 모두 같고 목록에 남아 있으면 유효하다', () => {
    expect(isSelectionStillValid(base())).toBe(true)
  })

  it('Finding 1 — 필터·재조회로 고른 시설이 visible 에서 빠지면 무효다', () => {
    expect(isSelectionStillValid({ ...base(), visible: [] })).toBe(false)
  })

  it('Finding 2 — 반경이 anchor 와 달라지면(넓히기) 무효다', () => {
    expect(isSelectionStillValid({ ...base(), currentRadius: 40_000 })).toBe(false)
  })

  it('Finding 2 — 위치가 anchor 와 다른 참조면(내 위치 재클릭) 무효다', () => {
    expect(isSelectionStillValid({ ...base(), currentPosition: relocated })).toBe(false)
  })

  it('좌표값이 같아도 참조가 다른 새 PositionResult 면 무효다 — locate() 는 매번 새 객체를 만든다', () => {
    const sameCoordsNewObject: PositionResult = { kind: 'granted', lat: 33.48, lng: 126.49 }
    expect(isSelectionStillValid({ ...base(), currentPosition: sameCoordsNewObject })).toBe(false)
  })

  it('anchorPosition 이 null 이어도(제주 밖 폴백) 참조 비교만으로 판단한다', () => {
    const fallback: PositionResult = {
      kind: 'fallback',
      lat: 33.4996213,
      lng: 126.5311884,
      reason: 'outside',
    }
    expect(
      isSelectionStillValid({
        ...base(),
        anchorPosition: fallback,
        currentPosition: fallback,
      }),
    ).toBe(true)
  })
})

function renderNotice(reason: PositionFailure, onRetry: () => void = () => undefined) {
  return renderToStaticMarkup(createElement(PositionNotice, { reason, onRetry }))
}

describe('PositionNotice', () => {
  it('denied — 안내와 다시 시도 링크를 함께 그린다', () => {
    const markup = renderNotice('denied')

    expect(markup).toContain(messages.emergency.positionDenied)
    expect(markup).toContain(messages.emergency.retryPosition)
  })

  it('timeout — 안내와 다시 시도 링크를 함께 그린다', () => {
    const markup = renderNotice('timeout')

    expect(markup).toContain(messages.emergency.positionTimeout)
    expect(markup).toContain(messages.emergency.retryPosition)
  })

  it('unsupported — 다시 시도해도 같은 답이라 링크를 아예 두지 않는다', () => {
    const markup = renderNotice('unsupported')

    expect(markup).toContain(messages.emergency.positionUnsupported)
    expect(markup).not.toContain(messages.emergency.retryPosition)
  })

  it('outside — 권한 문제로 읽히지 않고, 다시 시도 링크도 없다', () => {
    const markup = renderNotice('outside')

    expect(markup).toContain(messages.emergency.positionOutside)
    expect(markup).not.toContain(messages.emergency.retryPosition)
    // "권한" 이라는 단어로 읽히면 안 된다 — outside 는 위치를 이미 정확히 받은 상태다
    expect(markup).not.toContain('권한')
  })

  it('다시 시도는 버튼이다 — 이동이 아니라 같은 화면에서 다시 요청하는 액션이다', () => {
    const markup = renderNotice('denied')
    const buttonOpen = markup.indexOf('<button')
    const buttonClose = markup.indexOf('</button>')

    expect(buttonOpen).toBeGreaterThan(-1)
    // <a> 로 감싸지 않는다 — 페이지 이동이 아니다
    expect(markup.slice(buttonOpen, buttonClose)).not.toContain('<a ')
  })

  it('다시 시도 링크는 문장 줄 안에서도 44px 히트 영역을 유지한다 — py-3 을 -my-3 로 상쇄해 줄 높이는 그대로 둔다', () => {
    const markup = renderNotice('denied')
    const buttonOpen = markup.indexOf('<button')
    const buttonClose = markup.indexOf('</button>')
    const button = markup.slice(buttonOpen, buttonClose)

    // 히트 영역을 키우는 패딩과, 그 늘어난 만큼을 줄 높이에서 되돌리는 음수 마진이
    // 함께 있어야 트릭이 성립한다 — 하나만 있으면 터치 영역이 줄거나 블록이 다시 커진다
    expect(button).toContain('py-3')
    expect(button).toContain('-my-3')
    // 이전의 독립 블록형 44px(h-11)이 아니다 — 인라인 트릭으로 대체됐다
    expect(button).not.toContain('h-11')
  })

  it('안내와 링크가 하나의 문단(<p>) 안에서 흐른다 — 이전처럼 감싸는 flex 블록으로 나뉘지 않는다', () => {
    const markup = renderNotice('denied')
    const paragraphCount = markup.match(/<p /g)?.length ?? 0
    const pOpen = markup.indexOf('<p ')
    const pClose = markup.indexOf('</p>')
    const buttonOpen = markup.indexOf('<button')

    // 문단이 하나뿐이고, 그 문단 안에 링크 버튼이 들어 있다 — 텍스트와 링크가
    // 같은 줄바꿈 흐름을 공유한다는 뜻이다
    expect(paragraphCount).toBe(1)
    expect(buttonOpen).toBeGreaterThan(pOpen)
    expect(buttonOpen).toBeLessThan(pClose)
    // 이전 구현을 감쌌던 flex 래퍼가 없다 — 있었다면 링크가 별도 줄로 밀려난다
    expect(markup).not.toContain('flex-wrap')
  })
})

/*
  #883 — 위치 안내가 시트 본문에서 지도 위로 올라갔다.

  **소스를 읽어 잠근다.** 이 화면은 카카오 SDK·훅·브라우저 위치를 함께 쓰는 클라이언트
  컴포넌트라 node 환경에서 통째로 렌더할 수 없다(그래서 이 파일의 다른 테스트도
  `PositionNotice` 와 순수 함수만 만진다). 자리를 되돌리는 변경은 **배치**라 소스에서
  읽히고, 그것이 이 이슈가 고친 바로 그 결함이다.
*/
describe('EmergencyMapView — 위치 안내의 자리 (#883)', () => {
  const source = readFileSync(
    fileURLToPath(new URL('./emergency-map-view.tsx', import.meta.url)),
    'utf8',
  )
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  /**
   * 시트 본문 맨 위에 있던 동안에는 `현재 위치로 다시 찾기` 가 **시트를 올려야** 보였다 —
   * 위치를 못 받아 거리 기준이 흔들린 그 상태에서, 그것을 되돌리는 손잡이가 한 단계 뒤에
   * 접혀 있었다.
   */
  it('시트 본문에는 목록만 넘긴다 — 안내가 목록 자리를 먹지 않는다', () => {
    const open = code.indexOf('<MapSheet')
    const close = code.indexOf('</MapSheet>')

    expect(open).toBeGreaterThan(-1)
    expect(code.slice(open, close)).not.toContain('PositionNotice')
  })

  /*
    #1413 — **지도 위 안내 카드를 걷었다.** `/places` 지도 위에는 없는 카드라 두 화면의 지도 위 모양이 갈렸다. 안내 문장은
    1024 이상 패널 한 곳에만 남고, 다시 찾기는 `내 위치` 칸이 맡는다.
  */
  it('안내 문장(PositionNotice)은 데스크톱 패널 한 곳뿐이다 — 지도 위에는 없다', () => {
    expect(code.match(/<PositionNotice reason=\{board\.fallback\}/g)).toHaveLength(1)
    const at = code.indexOf('<PositionNotice reason={board.fallback}')
    expect(code.lastIndexOf('map-panel-width', at)).toBeGreaterThan(-1)
  })

  /* 다시 찾기 = `내 위치` 칸. 다시 해도 답이 같은 제주 밖 · 미지원은 그리지 않는다 (`PositionNotice` 와 같은 규칙) */
  it('내 위치 칸은 제주 안 · 권한 거부 · 시간 초과에 선다', () => {
    expect(code).toContain(
      "(board.inJeju || board.fallback === 'denied' || board.fallback === 'timeout') && (",
    )
    expect(code).toContain('<MapLocateButton onLocate={board.locate} variant="cell" />')
  })
})

/*
  #901 D2 — 시트 `max` 가 지도 위 검색·보기 전환을 덮지 않는다. 배치라 소스에서 읽히고,
  이 화면은 카카오 SDK 때문에 node 환경에서 통째로 렌더할 수 없다(위 describe 참고).
*/
describe('EmergencyMapView — 시트 최대 단계의 윗변 (#901 D2)', () => {
  const source = readFileSync(
    fileURLToPath(new URL('./emergency-map-view.tsx', import.meta.url)),
    'utf8',
  )
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  /* 아일랜드라 폭으로 갈리는 CSS 변수(60 / 120)다 (#1397) — `/places` 아일랜드와 같은 값 */
  it('MapSheet 에 maxTopInset 을 넘긴다 — 기본 85dvh 로 떨어지지 않는다', () => {
    const open = code.indexOf('<MapSheet')
    const close = code.indexOf('>', open)

    expect(code.slice(open, close)).toContain('maxTopInset={MAP_ISLAND_INSET_VAR}')
  })
})

/*
  #1232 D10 — `/places` 와 같은 도킹 패널 · 손잡이 · 움직임 (`지도패널-도킹-세부명세.md`).
  두 지도 화면의 모양이 갈리면 안 된다(#353 · #396 과 같은 이유).
*/
describe('EmergencyMapView — 도킹 패널 (#1232 D10)', () => {
  const source = readFileSync(
    fileURLToPath(new URL('./emergency-map-view.tsx', import.meta.url)),
    'utf8',
  )
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('패널이 지도 루트 왼쪽 위아래 끝에 붙는다 — 떠 있는 카드가 아니다', () => {
    expect(code).toContain("'absolute inset-y-0 left-0 z-30 hidden transition-transform lg:block'")
    expect(code).not.toMatch(/top-6 bottom-8 left-4/)
    expect(code).not.toContain('rounded-tr-none')
  })

  /* 예전에는 `panelOpen ? <패널> : <펼치기 버튼>` 으로 DOM 을 갈아 끼웠다 — 트랜지션을 걸 대상이 없었다 */
  it('갈아끼우지 않고 슬라이드한다 — 닫힌 패널은 inert 다', () => {
    expect(code).not.toMatch(/\{panelOpen \? \(/)
    expect(code).toContain("!panelOpen && '-translate-x-full'")
    expect(code).toContain('inert={!panelOpen}')
  })

  it('손잡이는 하나이고 패널 밖(형제)에서 패널을 가리킨다', () => {
    expect(code.match(/messages\.map\.expandPanel/g)).toHaveLength(2)
    expect(code).toContain('absolute top-1/2 left-full')
    expect(code).toContain('aria-controls={stackId}')
    const stack = code.indexOf('id={stackId}')
    const handle = code.indexOf('aria-controls={stackId}')
    expect(handle).toBeGreaterThan(stack)
    /*
      **스택 `div` 가 손잡이 앞에서 닫혀야 한다** — `inert=` 개수만 세면 손잡이를 스택 안(닫는 태그 앞)으로
      옮겨도 통과한다(리뷰 지적). 스택 여는 `<div` 부터 손잡이까지 여닫는 태그 수가 같으면 닫힌 뒤다.
    */
    const between = code.slice(code.lastIndexOf('<div', stack), handle)
    // 스스로 닫는 `<div … />`(로고 띠, #1397)는 짝이 없다 — 여는 태그에서 뺀다
    const selfClosing = between.match(/<div\b[^<>]*\/>/g)?.length ?? 0
    expect((between.match(/<div\b/g)?.length ?? 0) - selfClosing).toBe(
      between.match(/<\/div>/g)?.length,
    )
    expect(code).toContain('before:w-11')
  })

  it('고른 시설 · 재검색 알약 · 카카오 로고가 패널을 비킨다', () => {
    expect(code).toContain('selectedOffset={selectedOffset}')
    expect(code).toContain('return panelOpen && width > 0 ? { x: width / 2, y: 0 } : null')
    expect(code).toContain("panelOpen && 'lg:left-100'")
    expect(code).toContain('copyrightPosition="right"')
  })

  /* 고른 행에만 전화 · 길찾기가 붙는다 — 접힌 채 고르면 그 행동이 화면 밖 inert 안에 있었다 */
  it('시설을 고르면 접힌 패널을 편다', () => {
    const select = code.slice(
      code.indexOf('const handleSelect'),
      code.indexOf('if (failure !== null)'),
    )
    expect(select).toContain('setPanelOpen(true)')
  })
})

/*
  #1397 — 지도 아일랜드 가입. `/places` 지도 보기(`place-map-view.test.ts` 의 #1287 · #1300 블록)와 같은 장치라
  셸의 `body:has(.map-island)` 규칙이 흰 띠를 걷고 알약을 세운다 — 루트에서 `map-island` 가 빠지면 띠가 돌아온다.
*/
describe('EmergencyMapView — 지도 아일랜드 (#1397)', () => {
  const source = readFileSync(
    fileURLToPath(new URL('./emergency-map-view.tsx', import.meta.url)),
    'utf8',
  )
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('루트가 map-island · map-canvas-height 를 함께 달고 data-dock 을 준다 — 캔버스는 루트를 채운다', () => {
    expect(code).toContain('className="map-canvas-height map-island relative"')
    expect(code).toContain("data-dock={panelOpen ? 'open' : 'closed'}")
    expect(code).not.toContain('className="map-canvas-height w-full"')
  })

  /* #1409 — 768–1023 은 흰 띠 아래라 y 8, 알약은 ≥1024 만. 1024 미만은 검색 왼쪽 · 버튼 오른쪽 */
  it('조작 줄은 <1024 y 8 · ≥1024 y 68 이고 양끝 16 이다 — 콘텐츠 열에 매달지 않는다', () => {
    expect(code).toContain('pointer-events-none absolute inset-x-0 top-2 z-30 lg:top-17')
    // 768–1023 은 띠 헤더와 같은 40, 그 밖은 16
    expect(code).toContain(
      'flex items-start justify-between gap-2 px-4 md:px-10 lg:justify-end lg:px-4',
    )
    expect(code).not.toContain('md:top-17')
    expect(code).not.toContain('content-container')
  })

  it('패널 맨 앞이 로고 띠(64)다 — 검색보다 앞', () => {
    const band = code.indexOf(
      '<div aria-hidden className="border-border h-16 shrink-0 border-b" />',
    )
    expect(band).toBeGreaterThan(code.indexOf('id={stackId}'))
    expect(band).toBeLessThan(code.indexOf('id="emergency-keyword-panel"'))
  })

  it('보기 전환은 패널이 열린 1024 이상에서 숨고, 패널 개수 줄의 크게 보기가 같은 주소로 간다', () => {
    expect(code).toContain("className={panelOpen ? 'lg:hidden' : ''}")
    expect(code).toContain('href={listHref}')
    expect(code).toContain('messages.map.expandListPrefix')
    expect(code).toContain('{messages.map.expandList}')
  })

  it('내 위치는 아이콘 묶음 카드의 칸이다', () => {
    expect(code).toContain('<MapToolCard>')
    expect(code).toContain('<MapLocateButton onLocate={board.locate} variant="cell" />')
  })
})
