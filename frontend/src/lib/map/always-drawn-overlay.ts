import type { KakaoCustomOverlay, KakaoCustomOverlayOptions, KakaoMaps } from '@/types/kakao-maps'

/**
 * **화면 밖에 있어도 늘 그려 두는 오버레이** — 이슈 [#1015](https://github.com/8llow8llowMe/hondigagae/issues/1015).
 *
 * ### 왜 `CustomOverlay` 를 쓰지 않는가
 *
 * 카카오 `CustomOverlay` 는 **보이는 영역 밖의 오버레이를 DOM 에서 떼어 두고, 지도가
 * 멈춘(`idle`) 뒤에만 다시 붙인다.** 그래서 처음 화면 밖에 있던 핀은 지도를 끄는 동안
 * 끝까지 보이지 않다가 손을 놓아야 나타난다. dev 실측(2026-09-29, `/places` 지도 1024×704):
 * 끌기 도중 화면 안으로 들어온 핀 3개가 DOM 에 없었고, 멈춘 뒤 붙었다. 우리 코드에는
 * 핀을 숨기는 로직이 없다 — SDK 동작이다.
 *
 * `AbstractOverlay` 는 그리기를 우리에게 맡긴다: `onAdd` 에서 한 번 붙이고 `draw` 에서
 * 자리만 옮긴다. 붙인 요소는 지도 패널 안에 있어 **끌기와 함께 움직이고**, 컨테이너가
 * 넘치는 부분을 잘라 준다 (같은 실측에서 끌기 도중에도 보였다).
 *
 * ### 어디에 쓰는가 — 순번 핀만
 *
 * 화면 밖 핀까지 DOM 에 두는 비용은 핀 수에 비례한다. 하루 동선은 4~6곳이라 공짜에
 * 가깝지만, `/places` 지도는 수백 곳을 그리고 묶음으로 접는다 — 거기서는 SDK 의 떼어
 * 두기가 오히려 이득이다. 갈래는 `map-canvas.tsx` 의 `ordered` 가 가른다.
 *
 * ### `CustomOverlay` 와 같은 옵션을 같은 뜻으로 받는다
 *
 * 호출부가 두 갈래를 옵션 하나로 오가도록 **반환 타입도 `KakaoCustomOverlay` 다**
 * (`setMap` · `setZIndex`). `clickable` 은 SDK 가 해 주던 일을 직접 한다 — 누름을 지도에
 * 넘기지 않아 핀에서 시작한 끌기가 지도를 옮기지 않는다.
 */
export function createAlwaysDrawnOverlay(
  maps: KakaoMaps,
  {
    position,
    content,
    xAnchor = 0.5,
    yAnchor = 0.5,
    zIndex = 0,
    clickable = false,
  }: KakaoCustomOverlayOptions & { content: HTMLElement },
): KakaoCustomOverlay {
  const overlay = new maps.AbstractOverlay()

  const wrapper = content.ownerDocument.createElement('div')
  wrapper.style.position = 'absolute'
  // CustomOverlay 가 래퍼에 거는 것과 같다 — 이름표가 좁은 자리에서 줄바꿈되지 않게
  wrapper.style.whiteSpace = 'nowrap'
  wrapper.style.transform = anchorTransform(xAnchor, yAnchor)
  wrapper.style.zIndex = String(zIndex)
  wrapper.appendChild(content)

  if (clickable) {
    for (const type of PRESS_EVENTS) {
      // 막기만 하고 기본 동작은 건드리지 않는다 — passive 로 걸어 스크롤을 붙잡지 않는다
      wrapper.addEventListener(type, (event) => event.stopPropagation(), { passive: true })
    }
  }

  overlay.onAdd = () => {
    overlay.getPanels().overlayLayer.appendChild(wrapper)
  }
  overlay.draw = () => {
    /*
      **`pointFromCoords` 다 — `containerPointFromCoords` 가 아니다.** 래퍼가 붙는
      `overlayLayer` 는 끌기와 함께 움직이는 패널이라 좌표도 패널 기준이어야 한다. 컨테이너
      기준을 쓰면 처음에는 둘이 같아 맞아 보이다가, 끌기·`panTo` 로 패널이 밀린 뒤 다시
      그릴 때 **밀린 만큼 어긋난다** (dev 실측 100~150px, `CustomOverlay` 는 그대로).
    */
    const point = overlay.getProjection().pointFromCoords(position)
    wrapper.style.left = `${point.x}px`
    wrapper.style.top = `${point.y}px`
  }
  overlay.onRemove = () => {
    wrapper.remove()
  }

  return {
    setMap: (map) => overlay.setMap(map),
    setZIndex: (next) => {
      wrapper.style.zIndex = String(next)
    },
  }
}

/**
 * 지도가 끌기를 시작하는 누름. `click` 은 막지 않는다 — 막으면 핀 버튼이 죽는다.
 * 끌기는 누름에서 시작하므로 여기서 끊으면 된다.
 *
 * **`CustomOverlay({ clickable: true })` 와 같은 결과다** (dev 실측 · 2026-09-29): 핀에서
 * 시작한 끌기(pointer + mouse 순서)는 지도를 옮기지 않고, 핀 더블클릭은 **둘 다** 지도를
 * 확대한다. `dblclick` · `pointerdown` 까지 막으면 확대가 사라져 오히려 달라진다.
 */
const PRESS_EVENTS = ['mousedown', 'touchstart'] as const

/**
 * 좌표가 내용의 어느 점에 오는가. `CustomOverlay` 의 `xAnchor` · `yAnchor` 와 같은 뜻이다
 * — `0.5, 1` 이면 가운데 아래 끝, `0.5, 0.5` 면 한가운데.
 */
export function anchorTransform(xAnchor: number, yAnchor: number): string {
  return `translate(${-xAnchor * 100}%, ${-yAnchor * 100}%)`
}
