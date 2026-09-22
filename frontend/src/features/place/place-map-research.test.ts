/**
 * 장소 찾기 지도 보기의 **재검색 배선** — 이슈 #396 을 이 화면에도 들인 자리.
 *
 * **소스를 문자열로 읽는다.** `PlaceMapView` 는 카카오 SDK·`useMap`·위치 훅을 한꺼번에
 * 잡고 있어 node 환경 렌더에 mock 이 여럿 필요하고, 여기서 지키려는 것은 렌더 결과가
 * 아니라 **배선 계약**이다: 무엇이 조회를 켜고, 목록이 어느 영역을 세는가.
 * `place-map-search.test.ts` · `research-offer-origin.test.ts` 와 같은 방식이다.
 *
 * **#240 의 결정을 뒤집은 자리라 특히 잠근다.** 그때는 *"지도를 옮기는 것이 곧 '여기를
 * 보여 줘' 다"* 로 자동 재조회를 확정했고, 그 전제가 **한 곳을 골라 확대하는 조작**에서
 * 깨졌다 — 확대는 우리가 그 핀으로 옮겨 준 결과인데 그때마다 목록이 다시 조회돼 방금
 * 보던 결과가 사라졌다. 근거 없이 자동 재조회로 되돌아가는 변경이 조용히 통과하면 안 된다.
 */
import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import { readSourceWithoutComments as source } from '@/test/source'

const mapView = source('src/features/place/place-map-view.tsx')
const emergencyMapView = source('src/features/emergency/emergency-map-view.tsx')

describe('조회는 버튼만 켠다 (#396)', () => {
  /*
    `enabled` 가 `researched` 다. 예전에는 `true` 라 `movedBounds` 가 바뀔 때마다 —
    즉 `idle` 마다 — 조회가 나갔다.
  */
  it('주변 조회의 enabled 가 researched 다 — idle 이 아니다', () => {
    expect(mapView).toContain('useNearbyPlaces(searchCenter, searchRadius, filters, researched)')
    expect(mapView).not.toContain('movedBounds')
  })

  /* 켜는 곳이 한 군데여야 한다 — 버튼 핸들러 */
  it('researched 를 켜는 곳은 재검색 핸들러뿐이다', () => {
    expect(mapView.match(/setResearched\(true\)/g)).toHaveLength(1)

    const handler = mapView.slice(
      mapView.indexOf('const researchHere = useCallback'),
      mapView.indexOf('if (failure !== null)'),
    )
    expect(handler).toContain('setSearchedBounds(bounds)')
    expect(handler).toContain('setResearched(true)')
  })

  /*
    첫 `idle` 은 **기준 자리만** 놓는다. 그때 조회까지 켜면 프리페치한 목록 캐시를
    들어오자마자 버리게 되고, 첫 화면이 반경 밖이라 비어 보인다 (실제로 그랬다).
  */
  it('첫 idle 은 기준 자리만 놓고 조회를 켜지 않는다', () => {
    const handler = mapView.slice(
      mapView.indexOf('const handleBounds = useCallback'),
      mapView.indexOf('const researchHere = useCallback'),
    )

    expect(handler).toContain('if (!userMoved) setSearchedBounds(next)')
    expect(handler).not.toContain('setResearched')
  })
})

describe('목록은 조회한 자리를 센다 (#396)', () => {
  /*
    **`bounds` 로 거르면 재조회를 막아도 목록이 흔들린다** — 지도를 옮기거나 한 곳을
    골라 확대하는 것만으로 목록이 줄어든다. `/emergency` 가 선택 순간에 `frozenBounds`
    로 얼려 막는 것과 같은 결함이고, 이 화면은 조회 자리가 곧 목록의 자리라 그 하나로
    항상 얼려 둔다.
  */
  it('영역 필터의 기준이 searchedBounds 다 — bounds 가 아니다', () => {
    const memo = mapView.slice(
      mapView.indexOf('const visible = useMemo'),
      mapView.indexOf('const mutedKey'),
    )

    expect(memo).toContain('if (searchedBounds === null) return places')
    expect(memo).toContain('isWithinBounds(searchedBounds, coord)')
    expect(memo).not.toMatch(/isWithinBounds\(bounds,/)
  })

  /* 조회 중심·반경도 같은 자리에서 나온다 — 목록과 조회가 다른 곳을 가리키면 안 된다 */
  it('조회 중심·반경이 같은 searchedBounds 에서 나온다', () => {
    expect(mapView).toContain('boundsCenter(searchedBounds)')
    expect(mapView).toContain('boundsRadiusMeters(searchedBounds)')
  })

  /*
    지도가 조회 자리에서 벗어난 동안에는 "지도에 보이는" 이라고 말하지 않는다 —
    목록이 세는 영역과 화면이 다르기 때문이다. `/emergency` 와 같은 함수를 쓴다.
  */
  it('캡션이 벗어난 동안 지도 프레임을 주장하지 않는다', () => {
    expect(mapView).toContain(
      'visibleCountLabel(visible.length, !isSameViewport(searchedBounds, bounds))',
    )
  })
})

describe('버튼은 /emergency 와 같은 컨트롤이다 (#396)', () => {
  const button = mapView.slice(
    mapView.indexOf('{offerResearch &&'),
    mapView.indexOf('pointer-events-none absolute inset-x-0 top-5'),
  )

  it('문구·자리가 두 화면에서 같다', () => {
    expect(button).toContain('messages.map.researchHere')
    expect(button).toContain('map-research-offset')
    expect(button).toContain('onClick={researchHere}')

    // 같은 일을 하는 컨트롤이 화면마다 다르게 생기면 안 된다
    expect(emergencyMapView).toContain('messages.map.researchHere')
    expect(emergencyMapView).toContain('map-research-offset')
    expect(messages.map.researchHere).toBe('이 지역에서 재검색')
  })

  /*
    **이 화면만 줌 갈래를 켠다.** 조회 반경을 화면에서 역산하므로 축소가 곧 "더 넓게
    찾아 줘" 다 — 중심이 한 픽셀도 안 움직여도 재조회할 이유가 생긴다. 반경이 URL
    소유인 `/emergency` 는 켜지 않는다 (`research-offer-origin.test.ts` 가 그쪽을 잠근다).
  */
  it('확대·축소만으로도 권하도록 originScreenRadius 를 넘긴다', () => {
    expect(mapView).toMatch(/shouldOfferResearch\(\{[\s\S]{0,200}originScreenRadius: searchRadius/)
  })
})
