import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * `PlaceMapView` 는 카카오 SDK·훅·브라우저 위치를 함께 쓰는 클라이언트 컴포넌트라 node
 * 환경에서 통째로 렌더할 수 없다. **배치는 소스에서 읽히므로** 그 자리를 여기서 잠근다 —
 * `emergency-map-view.test.ts` 가 같은 이유로 같은 방식을 쓴다.
 */
const source = readFileSync(fileURLToPath(new URL('./place-map-view.tsx', import.meta.url)), 'utf8')
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/*
  #901 **D2** — 시트 `max` 가 지도 위 검색·보기 전환을 덮지 않는다.

  예전에는 `sheetMaxTopInset` 을 준 화면(담기, #370)만 px 경로를 탔고 `/places` 자신은
  기본값(85dvh)으로 떨어졌다. 그 값은 **비율**이라 윗변이 기기 높이를 따라가 짧은 기기일수록
  자기 플로팅 컨트롤을 더 덮었다 — 812 에서 2px 여유, 800 에서 0, **640 에서 24px 덮음**.
*/
describe('PlaceMapView — 시트 최대 단계의 윗변 (#901 D2)', () => {
  it('호출부가 주지 않으면 MAP_TOP_CONTROLS_INSET 로 떨어진다 — 85dvh 가 아니다', () => {
    // `<MapSheet` 의 여는 태그 안에 `toolbar={<PlaceMapFilterBar … />}` 가 들어 있어
    // 첫 `>` 로 자르면 태그가 중간에서 끊긴다 — 문자열 자체가 충분히 고유하다
    expect(code).toContain('maxTopInset={sheetMaxTopInset ?? MAP_TOP_CONTROLS_INSET}')
    expect(code).toContain('import { MAP_TOP_CONTROLS_INSET, MapSheet')
  })

  /** 담기 화면(#370)이 자기 헤더 높이를 알려 주는 길은 그대로 남는다 */
  it('호출부가 준 값이 여전히 이긴다', () => {
    expect(code).toContain('sheetMaxTopInset?: number | undefined')
  })
})

/*
  #1177 — 담기 지도가 그날 직전 장소에서 연다. **기준점이 없으면 `/places` 그대로다.**

  기준점은 마운트 때 값만 쓴다 — 담기 응답이 기준점을 바꿀 때마다 카메라가 옮겨지면
  연달아 담는 흐름(#370)이 끊긴다. 상태 전이(첫 `idle` 함정)는 `place-map-area.test.ts` 가 잰다.
*/
describe('PlaceMapView — 기준점에서 열기 (#1177)', () => {
  it('기준점은 마운트 때 한 번 얼린다', () => {
    expect(code).toContain('const [focus] = useState<LatLng | null>(initialFocus ?? null)')
  })

  it('기준점이 없으면 제주 기본 영역 · 목록 캐시 · 카메라 없음이다', () => {
    expect(code).toContain('focus === null ? INITIAL_PLACE_MAP_AREA : focusedPlaceMapArea(focus)')
    expect(code).toContain('const [researched, setResearched] = useState(focus !== null)')
    expect(code).toContain('focus === null ? null : { anchor: focus,')
    expect(code).toContain("useRef<FocusFraming | null>(focus === null ? null : 'pending')")
  })

  it('기준점 지도는 주변 조회가 오기 전까지 행 골격을 둔다 — 빈 상태가 먼저 깜빡이지 않는다', () => {
    expect(code).toContain('(focus !== null && nearbyQuery.isPending)')
  })
})

/*
  **대기 골격을 품는 캡션은 `p` 가 아니다** (#1177). `Skeleton` 은 `div` 라 `p` 안에 두면 HTML 이
  허락하지 않아 하이드레이션이 깨진다 — 기준점 지도가 서버 렌더 시점에 주변 조회를 기다리며
  처음 이 갈래를 서버에서 그렸을 때 실측으로 걸렸다.
*/
describe('PlaceMapView — 개수 캡션의 요소 (#1177)', () => {
  it('골격을 품을 수 있는 캡션이 p 로 열리지 않는다', () => {
    const caption = source.indexOf(
      '{listPending ? <Skeleton className="h-4.5 w-20" /> : countLine}',
    )
    const opener = source.lastIndexOf('<', source.lastIndexOf('className=', caption))

    expect(caption).toBeGreaterThan(0)
    expect(source.slice(opener, opener + 4)).toBe('<div')
  })
})

/*
  **기준점 지도의 두 실패 갈래** (#1177 지도 검토). 하나는 SDK 폴백이 기준점을 버리던 것, 하나는
  첫 주변 조회의 일시 장애를 "이 지역에는 표시할 곳이 없어요" 로 말하던 것이다.
*/
describe('PlaceMapView — 기준점 지도의 실패 갈래 (#1177)', () => {
  it('SDK 폴백 목록이 첫 장이 아니라 지금 목록(기준점이면 주변 조회)을 그린다', () => {
    const fallback = source.slice(source.indexOf('<PlaceListSection'))

    expect(fallback).toMatch(/places=\{places\}/)
    expect(fallback.slice(0, fallback.indexOf('/>'))).not.toContain('places={listPlaces}')
  })

  it('주변 조회의 일시 장애는 빈 상태가 아니라 재시도다 — 패널 · 시트 두 곳 모두', () => {
    const branches = source.match(/\) : nearbyFailed \? \(\s*nearbyErrorState/g) ?? []

    expect(branches).toHaveLength(2)
    expect(source).toMatch(/nearbyQuery\.isError && isRetriable\(nearbyQuery\.error\)/)
  })
})
