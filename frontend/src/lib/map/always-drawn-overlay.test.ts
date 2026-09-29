import { describe, expect, it } from 'vitest'

import { anchorTransform, createAlwaysDrawnOverlay } from '@/lib/map/always-drawn-overlay'
import type { KakaoLatLng, KakaoMaps } from '@/types/kakao-maps'

/**
 * 화면 밖에서도 그려 두는 오버레이 — 이슈 [#1015](https://github.com/8llow8llowMe/hondigagae/issues/1015).
 *
 * vitest 가 `environment: 'node'` 라 `document` 가 없다 (`docs/testing-guide.md` §1). SDK 와
 * DOM 을 **쓰는 만큼만** 흉내 낸 가짜로 배선을 본다 — SDK 가 부르는 세 훅(`onAdd` ·
 * `draw` · `onRemove`)이 무엇을 하는지가 이 파일의 대상이다.
 */

type FakeElement = {
  style: Record<string, string>
  children: FakeElement[]
  parent: FakeElement | null
  listeners: Map<string, (event: { stopPropagation: () => void }) => void>
  ownerDocument: { createElement: () => FakeElement }
  appendChild: (child: FakeElement) => void
  remove: () => void
  addEventListener: (
    type: string,
    handler: (event: { stopPropagation: () => void }) => void,
  ) => void
}

function fakeElement(): FakeElement {
  const element: FakeElement = {
    style: {},
    children: [],
    parent: null,
    listeners: new Map(),
    ownerDocument: { createElement: () => fakeElement() },
    appendChild(child) {
      child.parent = element
      element.children.push(child)
    },
    remove() {
      if (element.parent === null) return
      element.parent.children = element.parent.children.filter((c) => c !== element)
      element.parent = null
    },
    addEventListener(type, handler) {
      element.listeners.set(type, handler)
    },
  }
  return element
}

/** SDK 가 하는 일을 대신한다: `setMap` 이 `onAdd` → `draw`, `setMap(null)` 이 `onRemove` */
function fakeMaps(layer: FakeElement, point: { x: number; y: number }) {
  class FakeAbstractOverlay {
    onAdd?: () => void
    draw?: () => void
    onRemove?: () => void
    private attached = false

    getPanels() {
      return { overlayLayer: layer as unknown as HTMLElement }
    }

    /*
      **`pointFromCoords` 만 준다** — 패널(`overlayLayer`) 기준 좌표다. 컨테이너 기준인
      `containerPointFromCoords` 는 끌기·`panTo` 로 패널이 밀린 뒤 그만큼 어긋난다
      (실측 100~150px, 명세 D13-2). 그쪽을 부르면 여기서 `undefined` 로 터진다.
    */
    getProjection() {
      return { pointFromCoords: () => point }
    }

    setMap(map: object | null) {
      if (map !== null && !this.attached) {
        this.attached = true
        this.onAdd?.()
        this.draw?.()
      } else if (map === null && this.attached) {
        this.attached = false
        this.onRemove?.()
      }
    }
  }

  return { AbstractOverlay: FakeAbstractOverlay } as unknown as KakaoMaps
}

const POSITION = {} as KakaoLatLng
const MAP = {} as never

function setup(options: { yAnchor?: number; zIndex?: number; clickable?: boolean } = {}) {
  const layer = fakeElement()
  const content = fakeElement()
  const overlay = createAlwaysDrawnOverlay(fakeMaps(layer, { x: 120, y: 48 }), {
    position: POSITION,
    content: content as unknown as HTMLElement,
    ...options,
  })
  return { layer, content, overlay }
}

describe('createAlwaysDrawnOverlay — SDK 의 세 훅', () => {
  it('지도에 올리면 내용을 감싼 래퍼가 overlayLayer 에 붙는다', () => {
    const { layer, content, overlay } = setup()

    overlay.setMap(MAP)

    expect(layer.children).toHaveLength(1)
    expect(layer.children[0]?.children[0]).toBe(content)
  })

  it('그릴 때 좌표를 패널 픽셀로 바꿔 left/top 에 놓는다', () => {
    const { layer, overlay } = setup()

    overlay.setMap(MAP)

    expect(layer.children[0]?.style.left).toBe('120px')
    expect(layer.children[0]?.style.top).toBe('48px')
    expect(layer.children[0]?.style.position).toBe('absolute')
  })

  it('지도에서 내리면 래퍼를 떼어 낸다 — 다시 그릴 때 누적되지 않는다', () => {
    const { layer, overlay } = setup()

    overlay.setMap(MAP)
    overlay.setMap(null)

    expect(layer.children).toHaveLength(0)
  })
})

describe('createAlwaysDrawnOverlay — CustomOverlay 와 같은 옵션', () => {
  it('zIndex 를 래퍼에 싣고 setZIndex 로 바꾼다', () => {
    const { layer, overlay } = setup({ zIndex: 3 })

    overlay.setMap(MAP)
    expect(layer.children[0]?.style.zIndex).toBe('3')

    overlay.setZIndex(7)
    expect(layer.children[0]?.style.zIndex).toBe('7')
  })

  it('clickable 이면 누름을 지도에 넘기지 않는다 — 핀에서 시작한 끌기가 지도를 옮기지 않는다', () => {
    const { layer, overlay } = setup({ clickable: true })
    overlay.setMap(MAP)

    const wrapper = layer.children[0]
    let stopped = 0
    for (const type of ['mousedown', 'touchstart']) {
      wrapper?.listeners.get(type)?.({ stopPropagation: () => (stopped += 1) })
    }

    expect(stopped).toBe(2)
  })

  it('clickable 이 아니면 아무것도 막지 않는다 — 핀 위에서 시작한 끌기도 지도를 옮긴다', () => {
    const { layer, overlay } = setup({ clickable: false })
    overlay.setMap(MAP)

    expect(layer.children[0]?.listeners.size).toBe(0)
  })
})

describe('anchorTransform — 좌표가 내용의 어느 점에 오는가', () => {
  it('기본은 가운데 아래가 아니라 한가운데다 (xAnchor 0.5 · yAnchor 0.5)', () => {
    expect(anchorTransform(0.5, 0.5)).toBe('translate(-50%, -50%)')
  })

  it('이름표는 아래 끝이 좌표를 가리킨다 (yAnchor 1)', () => {
    expect(anchorTransform(0.5, 1)).toBe('translate(-50%, -100%)')
  })
})
