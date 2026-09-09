import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  isSelectionStillValid,
  PositionNotice,
  visibleCountLabel,
} from '@/features/emergency/emergency-map-view'
import type { PositionFailure, PositionResult } from '@/lib/geo/current-position'
import { messages } from '@/lib/messages'
import { facility } from '@/test/fixtures/emergency'

describe('visibleCountLabel', () => {
  it('선택되지 않았을 때는 messages.map.visibleCount 를 쓴다 — "지도에 보이는" 이 참인 상태다', () => {
    expect(visibleCountLabel(12, false)).toBe(messages.map.visibleCount.replace('{n}', '12'))
  })

  it('선택 중일 때는 messages.emergency.selectedCount 를 쓴다 — 지도 프레임과 목록이 어긋난 뒤라 "보이는" 이라고 말하지 않는다', () => {
    expect(visibleCountLabel(12, true)).toBe(messages.emergency.selectedCount.replace('{n}', '12'))
  })

  it('개수 자체는 선택 여부와 무관하게 그대로 진실이다', () => {
    const unselected = visibleCountLabel(4, false)
    const selected = visibleCountLabel(4, true)

    expect(unselected).toContain('4')
    expect(selected).toContain('4')
    // 문구가 다르다는 것도 함께 고정한다 — 같으면 B1 회귀다
    expect(unselected).not.toBe(selected)
  })

  it('해제됐지만 bounds 가 아직 stale 인 상태도 같은 두 번째 인자로 표현된다 — "지도에 보이는" 을 쓰지 않는다', () => {
    // `EmergencyMapView` 는 `selectedId !== null || boundsStale` 를 이 함수의
    // 두 번째 인자로 넘긴다. 이 함수 입장에서는 "선택 중"과 "해제됐지만 stale"을
    // 구분하지 않는다 — 둘 다 지도 프레임에 대한 주장을 하면 안 되는 상태라
    // 같은 `true` 로 들어오고, 같은 문구("목록 {n}곳")를 낸다.
    const deselectedButStale = visibleCountLabel(136, true)

    expect(deselectedButStale).toBe(messages.emergency.selectedCount.replace('{n}', '136'))
    expect(deselectedButStale).not.toBe(messages.map.visibleCount.replace('{n}', '136'))
  })
})

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
