/**
 * **확대하며 그 지점으로 간다 — 사본이 둘이면 한쪽만 고쳐진다** (이슈 #873).
 *
 * 핀을 고르는 경로는 순서를 제대로 정해 뒀다: `anchor` 로 목표를 화면에 붙인 채
 * `animate` 확대 → `ZOOM_MS` 뒤 중심 맞추기, 그리고 `prefers-reduced-motion` 분기.
 * 근거는 `zoomToward` 머리주석에 있다 — *"둘을 동시에 걸 수 없다. 같은 변환을 두
 * 애니메이션이 함께 밀면 중간에서 튄다."*
 *
 * **묶음 마커는 그 결론을 안 물려받고 있었다.** 옵션 없는 `setLevel(level - 2)` 뒤
 * 2ms 만에 `panTo` 였고, 그래서 확대가 **지도 중심** 기준으로 즉시 점프해 누른 묶음이
 * 커서에서 멀어진 뒤 성격이 다른 애니메이션이 이어졌다 (브라우저 실측:
 * `setLevel(6) opts: null` → 2ms → `panTo`).
 *
 * **소스를 문자열로 읽는다.** `MapCanvas` 는 카카오 SDK 를 잡고 있어 node 환경에서
 * 렌더할 수 없고, 여기서 지키려는 것은 렌더 결과가 아니라 **호출 계약**이다.
 */
import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as source } from '@/test/source'

const mapCanvas = source('src/features/map/map-canvas.tsx')

/**
 * 마커로 잘라 낸 구간. **못 찾으면 바로 실패시킨다** — `indexOf` 가 -1 이면 `slice` 가
 * 조용히 파일 전체(또는 끝까지)를 잡아, `not.toContain` 류가 엉뚱한 곳을 보고 통과하거나
 * 실패한다. 이 파일을 쓰면서 실제로 밟았다: `': pinElement('` 가 주석 제거 뒤 줄바꿈으로
 * 갈려 -1 이었다.
 */
function between(from: string, to: string): string {
  const start = mapCanvas.indexOf(from)
  const end = mapCanvas.indexOf(to)

  expect(start, `마커를 못 찾았다: ${from}`).toBeGreaterThan(-1)
  expect(end, `마커를 못 찾았다: ${to}`).toBeGreaterThan(start)

  return mapCanvas.slice(start, end)
}

const helper = between('function zoomToward(', 'export type MapPin')
const clusterHandler = () => between('? clusterElement(', 'const overlay = new maps.CustomOverlay(')

describe('zoomToward — 확대와 이동의 순서 (#873)', () => {
  /*
    `anchor` 가 없으면 확대가 지도 중심 기준으로 걸린다 — 누른 자리가 커서에서 멀어진다.
    `animate` 가 없으면 확대는 즉시 점프인데 뒤따르는 `panTo` 는 애니메이션이라 튄다.
  */
  it('확대는 목표를 anchor 로 붙인 채 animate 로 건다', () => {
    expect(helper).toMatch(
      /map\.setLevel\(level, \{ animate: \{ duration: ZOOM_MS \}, anchor: target \}\)/,
    )
  })

  /* 동시에 걸면 같은 변환을 두 애니메이션이 함께 밀어 중간에서 튄다 */
  it('중심 맞추기는 확대가 끝난 뒤(ZOOM_MS)에 예약한다', () => {
    expect(helper).toMatch(/setTimeout\([\s\S]{0,160}panTo\(target\)[\s\S]{0,40}\}, ZOOM_MS\)/)
    // 언마운트·SDK 실패를 대비해 예약 시점에 생존을 다시 본다
    expect(helper).toContain('mapRef.current?.panTo(target)')
  })

  /*
    지도의 이동·확대는 SDK 가 JS 로 그리는 것이라 `app/globals.css` 의
    `prefers-reduced-motion` 규칙이 닿지 않는다 — 여기서 직접 판정해야 한다.
  */
  it('어지럼을 줄여야 하는 사용자에게는 애니메이션 없이 옮긴다', () => {
    const branch = helper.slice(helper.indexOf('if (prefersReducedMotion())'))
    expect(branch).toContain('map.setCenter(target)')
    expect(branch).toMatch(/if \(zoomIn\) map\.setLevel\(level\)/)
  })

  /* 예약한 이동을 취소할 수 있어야 한다 — 호출부가 effect 면 그대로 cleanup 이 된다 */
  it('뒷정리 함수를 돌려준다', () => {
    expect(helper).toContain('return () => clearTimeout(timer)')
  })
})

describe('두 호출부가 같은 함수를 쓴다 (#873)', () => {
  it('선택 핀도 묶음 마커도 zoomToward 를 부른다', () => {
    expect(mapCanvas.match(/zoomToward\(\{/g)).toHaveLength(2)
  })

  /*
    **사본이 돌아오지 않게 잰다.** 묶음 마커가 제 손으로 `setLevel` + `panTo` 를 부르면
    다시 갈라진다 — 그 둘을 부르는 곳은 `zoomToward` 안과, 확대를 다루지 않는
    카메라/중심 effect 뿐이어야 한다.
  */
  it('묶음 마커는 스스로 setLevel·panTo 를 부르지 않는다', () => {
    const handler = clusterHandler()

    expect(handler).toContain('zoomToward({')
    expect(handler).not.toContain('map.setLevel(')
    expect(handler).not.toContain('map.panTo(')
  })

  /*
    **끝 상태가 같다** — 누른 자리가 화면 중앙에 온다. 묶음도 핀과 같은 함수를 타므로
    `anchor` 확대 뒤의 `panTo(target)` 가 그것을 보장한다. 두 단계 확대는 그대로다:
    한 단계면 같은 묶음이 다시 묶여 두 번 눌러야 풀리는 구역이 생긴다.
  */
  it('묶음은 두 단계 확대를 유지한다', () => {
    expect(clusterHandler()).toMatch(/level: Math\.max\(1, map\.getLevel\(\) - 2\)/)
  })
})
