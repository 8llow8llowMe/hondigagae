/**
 * 재검색 판정이 **카메라가 놓은 중심**을 보는지 — 이슈 #578.
 *
 * **소스를 문자열로 읽는다.** `EmergencyMapView` 는 카카오 SDK·`useMap`·위치 훅을
 * 한꺼번에 잡고 있어 node 환경 렌더에 mock 이 여럿 필요한데, 여기서 지키려는 것은
 * 렌더 결과가 아니라 **배선 계약**이다: 판정이 무엇과 비교하는가.
 * `place-map-panel-slide.test.ts` 가 쓰는 방식과 같다.
 *
 * **순수 함수 검사로는 이 결함을 못 잡았다.** `research-offer.test.ts` 는
 * `shouldOfferResearch` 만 봤고 함수 자체는 사양대로 맞았다 — 틀린 것은 **호출부가
 * 무엇을 넘기는가** 였다. 그래서 그 자리를 따로 잠근다.
 */
import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as source } from '@/test/source'

const mapView = source('src/features/emergency/emergency-map-view.tsx')
const mapCanvas = source('src/features/map/map-canvas.tsx')

describe('재검색 판정은 카메라가 놓은 중심과 비교한다 (#578)', () => {
  /*
    **`board.anchor` 를 넘기면 안 된다.** 카메라는 기준점을 화면 위쪽 35% 지점에 놓으므로
    지도 중심은 기준점보다 남쪽이고, 기준점과 비교하면 그 의도된 오프셋이 사용자의
    이동으로 읽힌다 — 조작 0회에서 버튼이 뜨고 누를 때마다 지도가 남하했다.
  */
  it('판정에 기준점이 아니라 카메라가 놓은 중심을 넘긴다', () => {
    expect(mapView).toMatch(/shouldOfferResearch\(\{[\s\S]{0,120}origin: cameraCenter/)
    expect(mapView).not.toMatch(/shouldOfferResearch\(\{[\s\S]{0,120}anchor:/)
  })

  it('그 중심은 MapCanvas 가 알려 준 값이다', () => {
    expect(mapView).toContain('onCameraApplied={setCameraCenter}')
  })

  /*
    놓은 자리를 아는 곳은 `MapCanvas` 뿐이다 — 컨테이너 크기와 확대 단계가 거기에만
    있고, 둘이 있어야 `framedCamera` 가 위도 폭을 환산할 수 있다.
  */
  it('MapCanvas 는 카메라를 적용한 자리를 그대로 알린다', () => {
    expect(mapCanvas).toMatch(
      /cameraAppliedRef\.current\?\.\(\{\s*lat: next\.lat,\s*lng: next\.lng/,
    )
  })

  /*
    **사용자가 끄는 동안에는 갱신되지 않아야 한다.** `camera` 가 기준점·반경에만
    의존하므로 드래그는 카메라 effect 를 다시 돌리지 않는다 — 그래서 이 값이 "우리가
    놓은 자리" 로 남고, 드래그가 벌린 거리를 그대로 잰다. 의존성에 `bounds` 류가
    끼어들면 그 성질이 깨진다.
  */
  it('카메라는 기준점·반경·재검색 여부에만 의존한다 — 지도 영역에 의존하지 않는다', () => {
    const board = source('src/features/emergency/use-emergency-board.ts')
    const deps = /useMemo\([\s\S]*?\[(anchor\?\.lat[^\]]*)\]/.exec(board)?.[1]

    expect(deps).toBeDefined()
    expect(deps).toContain('anchor?.lat')
    expect(deps).toContain('radius')
    // `bounds`·`center` 류가 끼면 드래그가 카메라를 다시 돌려 기준 자리가 따라 움직인다
    expect(deps).not.toMatch(/bounds|boundsCenter/)
  })

  /*
    **재검색으로 옮긴 자리는 정중앙에 놓는다** (#578). 기본 프레이밍은 첫 화면의 규칙이고,
    재검색의 기준점은 사용자가 방금 보고 있던 지도 중심이라 같은 규칙을 걸면 화면이
    통째로 남쪽으로 밀린다 (실측 약 4km).

    **권역 세그먼트도 같은 길이다** (#639) — 사용자가 직접 지목한 자리라 성격이 같다.
  */
  it('재검색·권역 상태에서는 카메라가 기준점을 정중앙에 놓는다', () => {
    const board = source('src/features/emergency/use-emergency-board.ts')
    expect(board).toMatch(
      /searchCenter === null && regionCode === null \? \{\} : \{ anchorRatio: 0\.5 \}/,
    )
  })
})
