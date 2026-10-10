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
    expect(mapView).toMatch(
      /shouldOfferResearch\(\{[\s\S]{0,120}origin: selectedCoord \?\? cameraCenter/,
    )
    expect(mapView).not.toMatch(/shouldOfferResearch\(\{[\s\S]{0,120}anchor:/)
  })

  it('그 중심은 MapCanvas 가 알려 준 값이다', () => {
    expect(mapView).toContain('onCameraApplied={setCameraCenter}')
  })

  /*
    **선택은 판정을 막지 않고 기준점을 옮긴다.**

    예전에는 `selected: selectedId !== null` 로 아예 막았고, 그래서 시설을 고른 뒤에는
    사용자가 지도를 직접 끌어도 버튼이 뜨지 않았다 — 옆 동네를 확인하려면 선택부터
    풀어야 했다. 그렇다고 `cameraCenter` 로만 재면 반대로 **고르자마자** 버튼이 뜬다:
    선택-확대가 지도를 그 핀으로 옮기는데 그것은 우리가 한 일이다 (브라우저 실측 —
    카카오는 이 애니메이션 이동에서도 `idle` 을 내므로 `bounds` 가 실제로 갱신된다).

    **우리가 옮겨 놓은 자리(그 핀)를 기준으로 삼으면 둘이 동시에 만족된다** — 고른
    직후에는 이동량이 0 이라 안 뜨고, 거기서 반경의 30% 를 넘게 끌면 고른 상태 그대로
    뜬다. 둘 중 한쪽만 고치는 변경이 조용히 통과하면 안 된다.
  */
  it('고른 동안에는 그 핀이 기준점이다 — 막지 않는다', () => {
    expect(mapView).toMatch(/shouldOfferResearch\(\{[\s\S]{0,200}suppressed: boundsStale/)
    expect(mapView).not.toMatch(/shouldOfferResearch\(\{[\s\S]{0,200}suppressed: selectedId/)

    // 핀 좌표는 `visible` 에서 찾는다 — 선택이 살아 있으면 그 행이 거기 남아 있다
    const memo = mapView.slice(
      mapView.indexOf('const selectedCoord = useMemo'),
      mapView.indexOf('const offerResearch'),
    )
    expect(memo).toContain('visible.find((item) => item.facilityId === selectedId)')
    expect(memo).toContain('toLatLng(entry)')
  })

  /*
    **확대·축소 갈래는 이 화면에서 켜지 않는다.** 반경은 URL 이 소유하는 칩 값이고
    (`useEmergencyNav`) 재검색은 그것을 그대로 둔 채 기준점만 옮긴다 — 줌으로 뜬 버튼을
    눌러도 조회 범위가 안 바뀌어 버튼이 거짓말을 한다. 화면에서 역산하는 `/places` 만 쓴다.
  */
  it('반경이 URL 소유라 줌 갈래를 켜지 않는다', () => {
    expect(mapView).not.toMatch(/shouldOfferResearch\(\{[\s\S]{0,200}originScreenRadius/)
  })

  /*
    놓은 자리를 아는 곳은 `MapCanvas` 뿐이다 — 컨테이너 크기와 확대 단계가 거기에만
    있고, 둘이 있어야 `framedCamera` 가 위도 폭을 환산할 수 있다.

    **보고하는 값은 `setCenter` 에 넣은 값 그 자체여야 한다** (#873). `keepLevel` 갈래가
    생기면서 실제로 놓는 위도가 `next.lat` 이 아니라 **지금 단계로 다시 환산한 `lat`**
    이 됐다 — 둘 중 하나만 바뀌면 바깥이 "우리가 놓은 자리" 를 잘못 알고, 조작 0회에서
    재검색 버튼이 뜨는 #578 이 그대로 재발한다. 그래서 같은 식별자를 쓰는지 잰다.
  */
  it('MapCanvas 는 카메라를 적용한 자리를 그대로 알린다', () => {
    const effect = mapCanvas.slice(
      mapCanvas.indexOf('const next = framedCamera('),
      mapCanvas.indexOf('}, [camera, status])'),
    )

    expect(effect).toMatch(/map\.setCenter\(new maps\.LatLng\(lat, next\.lng\)\)/)
    expect(effect).toMatch(/cameraAppliedRef\.current\?\.\(\{ lat, lng: next\.lng \}\)/)
  })

  /*
    **재검색은 확대 단계를 건드리지 않는다** (#873). 카메라가 늘 `spanMeters`(= 반경 × 2)
    에서 단계를 역산하는 바람에, 기준점만 옮기려던 조작이 줌을 풀어 버렸다
    (실측: level 4 → 8, 중심은 0m 그대로).

    **판정은 "재검색 상태인가" 가 아니라 "직전 조작이 무엇이었나" 다.** 상태로 재면
    재검색 뒤에 반경 칩을 만졌을 때도 유지돼 "반경 넓히기" 가 화면에 안 먹는다.
  */
  it('재검색만 확대 단계를 유지하고 반경·권역·내 위치는 다시 맞춘다', () => {
    const board = source('src/features/emergency/use-emergency-board.ts')

    expect(board).toContain('keepLevel: keepZoom')
    // 상태(`searchCenter !== null`)로 판정하면 반경 조작이 먹지 않는다
    expect(board).not.toMatch(/keepLevel: searchCenter/)

    const keeps = (fn: string) => {
      const start = board.indexOf(fn)
      return board.slice(start, board.indexOf('}', board.indexOf('setKeepZoom', start)))
    }
    expect(keeps('const researchAt = useCallback')).toContain('setKeepZoom(true)')
    for (const fn of [
      'const researchAtRegion = useCallback',
      'const locate = useCallback',
      'const setRadius = useCallback',
      'const widenRadius = useCallback',
    ]) {
      expect(keeps(fn)).toContain('setKeepZoom(false)')
    }
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
