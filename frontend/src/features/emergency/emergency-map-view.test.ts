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

  /** 데스크톱 좌측 패널이 같은 안내를 이미 세운다 — 둘 다 그리면 한 화면에 두 번 뜬다 */
  it('지도 위 안내는 lg 미만에서만 그린다', () => {
    const at = code.indexOf('PositionNotice reason={board.fallback}')
    const block = code.slice(Math.max(0, at - 400), at)

    expect(block).toContain('lg:hidden')
  })

  /** 바깥 플로팅 컨테이너가 `pointer-events-none` 이라 면에서 다시 켜지 않으면 안 눌린다 */
  it('지도 위 안내 면은 포인터 이벤트를 다시 켠다', () => {
    const at = code.indexOf('PositionNotice reason={board.fallback}')
    const block = code.slice(Math.max(0, at - 400), at)

    expect(block).toContain('pointer-events-auto')
  })
})
