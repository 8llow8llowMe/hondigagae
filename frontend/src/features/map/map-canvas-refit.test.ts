import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments } from '@/test/source'

/**
 * 컨테이너 크기가 바뀌면 카메라를 다시 맞추는가 — 이슈 #982.
 *
 * ### 왜 소스를 읽나
 *
 * `MapCanvas` 는 `dynamic(..., { ssr: false })` 이고 SDK 없이는 effect 가 돌지 않는다 —
 * node 환경에서 관찰자를 불러 볼 방법이 없다 (`map-canvas-consumers.test.ts` 와 같은 처지).
 * 계산(`levelForBoxMeters`)은 `viewport.test.ts` · `route.test.ts` 가 수치로 잠그고,
 * 여기서는 **배선**만 잠근다.
 *
 * ### 무엇을 잠그나
 *
 * - 동선 카드만 켠다. 원 카메라 화면(`/emergency` 등)은 시트·패널이 크기를 자주 바꿔,
 *   켜면 사용자가 보던 화면이 튄다
 * - 사용자가 지도를 옮겼거나 핀을 골랐으면 되잡지 않는다
 * - 관찰자를 effect 정리에서 끊는다 (`external-api-guide.md` — effect 에는 cleanup)
 */

const mapCanvas = readSourceWithoutComments('src/features/map/map-canvas.tsx')

/** 카메라 effect 본문 — `research-offer-origin.test.ts` 와 같은 경계로 자른다 */
function cameraEffect(): string {
  const start = mapCanvas.indexOf('const next = framedCamera(')
  const end = mapCanvas.indexOf('}, [camera, status])')

  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)

  return mapCanvas.slice(start, end)
}

describe('MapCanvas — 크기가 바뀌면 다시 맞춘다 (#982)', () => {
  /*
    리뷰 H-1 — 카메라 memo 를 정류점 배열 참조에 걸면 부모가 다시 그릴 때마다 새 카메라가
    되어 사용자가 끌어 둔 지도가 되돌아간다. 값 서명(`routeCameraKey`)에 건다.
  */
  it('동선 카드는 카메라 memo 를 값 서명에 건다', () => {
    const card = readSourceWithoutComments('src/features/plan/plan-route-card.tsx')

    expect(card).toContain('routeCameraKey(selectedDay, model.stops)')
    expect(card).toContain('}, [cameraKey])')
  })

  it('동선 카드가 되잡기를 켠다', () => {
    const card = readSourceWithoutComments('src/features/plan/plan-route-card.tsx')

    expect(card).toContain('refitOnResize: true')
  })

  it.each([
    'src/features/emergency/use-emergency-board.ts',
    'src/features/place/place-mini-map.tsx',
    'src/features/walk-course/walk-course-start-map.tsx',
  ])('원 카메라 화면은 켜지 않는다 — %s', (path) => {
    expect(readSourceWithoutComments(path)).not.toContain('refitOnResize')
  })

  it('켠 카메라에서만 관찰자를 달고 정리에서 끊는다', () => {
    const effect = cameraEffect()

    expect(effect).toContain('if (camera.refitOnResize !== true) return')
    expect(effect).toContain('new ResizeObserver(')
    expect(effect).toContain('return () => observer.disconnect()')
  })

  it('사용자가 옮긴 뒤에는 되잡지 않는다', () => {
    const effect = cameraEffect()

    expect(effect).toContain('if (movedSinceCameraRef.current) return')
    // 새 카메라는 새 틀이다 — 옮김 표시를 지우고 맞춘다
    expect(effect).toMatch(/movedSinceCameraRef\.current = false\s+apply\(\)/)
  })

  it('끌기 · 확대 입력과 핀 선택이 옮김으로 표시된다', () => {
    expect(mapCanvas).toMatch(
      /const notify = \(\) => \{\s+movedSinceCameraRef\.current = true\s+userMoveRef\.current\?\.\(\)/,
    )
    expect(mapCanvas).toMatch(
      /const level = selectedLevel \?\? map\.getLevel\(\)\s+movedSinceCameraRef\.current = true/,
    )
  })

  /* SDK 가 새 크기를 모른 채 단계·중심을 놓으면 중심이 어긋난다 */
  it('다시 맞추기 전에 relayout 한다', () => {
    expect(cameraEffect()).toMatch(/map\.relayout\(\)\s+apply\(\)/)
  })
})
